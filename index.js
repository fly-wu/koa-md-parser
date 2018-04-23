const fs = require('fs')
const util = require('util')
const path = require('path')
const marked = require('marked')
const highlightjs = require('highlight.js')
const fm = require('front-matter')
const readFile = util.promisify(fs.readFile)
const glob = util.promisify(require('glob'))
const Debug = require('debug')
const debug = Debug('koa-md-parser')
// uncomment this line to enable debug of koa-md-parser
Debug.enable('koa-md-parser')

class MDParser {
  constructor(destDir, options) {
    destDir = destDir || path.join(__dirname, 'examples');
    options = options || {};
    // prefix must be ASCII code
    options.urlPrefix = (options.urlPrefix || null);
    this.destDir = destDir;
    this.options = options;

    this.setMarked();
    this.fileMap = {};

    Promise.all([this.readMdFiles(this.destDir), this.readMenuFiles(this.destDir)]).then(data => {
      // console.log(data)
      this.fileMap = Object.assign(data[0], data[1]);
      debug('%s: %o', 'files found', Object.keys(this.fileMap));
    }).catch(err => {
      console.log('parse fail!');
      console.log(err);
    });
  }

  get(filePath) {
    let result = null;
    if (filePath) {
      if (filePath.startsWith('/')) {
        filePath = filePath.substring(1);
      }
      if (this.fileMap.hasOwnProperty(filePath)) {
        result = this.fileMap[filePath];
      }
    }
    return result;
  }

  safeDecodeURIComponent(text) {
    try {
      return decodeURIComponent(text)
    } catch (e) {
      return text
    }
  }

  /**
   * return a middleware for koa
   * @returns {function(*, *)}
   */
  getMiddleware() {
    return async (ctx, next) => {
      let options = this.options;
      let urlPrefix = options.urlPrefix;
      let urlPath = this.safeDecodeURIComponent(ctx.path);
      let filePath = null;
      if (null != urlPrefix) {
        if (urlPath.indexOf(urlPrefix) !== 0) {
          return await next();
        }
        filePath = urlPath.slice(urlPrefix.length)
      }
      let parserResult = this.get(filePath);
      if (null === parserResult) {
        return await next();
      }
      ctx.set('content-encoding', 'application/json')
      ctx.body = {
        code: 0,
        content: parserResult
      };
      return;
    }
  }


  /**
   * add some custom action for marked.Renderer
   */
  setMarked() {
    // Use highlight.js for code blocks
    const renderer = new marked.Renderer()
    renderer.code = (code, language) => {
      const validLang = !!(language && highlightjs.getLanguage(language))
      const highlighted = validLang ? highlightjs.highlight(language, code).value : code
      return `<pre><code class="hljs ${language}">${highlighted}</code></pre>`
    }
    renderer.heading = (text, level) => {
      const patt = /\s?{([^}]+)}$/
      let link = patt.exec(text)
      if (link && link.length && link[1]) {
        text = text.replace(patt, '')
        link = link[1]
      } else {
        link = text.toLowerCase().replace(/[^\wА-яіІїЇєЄ\u4e00-\u9eff一-龠ぁ-ゔァ-ヴー々〆〤\u3130-\u318F\uAC00-\uD7AF]+/gi, '-')
      }
      return '<h' + level + ' id="' + link + '">' + text + '</h' + level + '>'
    }
    marked.setOptions({
      renderer
    })
  }

  // Get doc file and sent back it's attributes and html body
  async parseMdFile(filePath, cwd) {
    let file = await readFile(path.resolve(cwd, filePath), 'utf-8')
    // transform markdown to html
    file = fm(file)
    return {
      attrs: file.attributes,
      body: marked(file.body)
    }
  }
  /**
   * find and parse all file end with .md under target directory
   * @param cwd: dest directory
   */
  async readMdFiles(cwd) {
    cwd = cwd || process.cwd()
    let docPaths = await glob('*/**/*.md', {
      cwd: cwd,
      ignore: 'node_modules/**/*',
      nodir: true
    })
    let promises = []
    let results = {}
    docPaths.forEach((it) => {
      let promise = this.parseMdFile(it, cwd)
      promise.then((fileContent) => {
        let key = it.replace(/\.md$/, '');
        results[key] = fileContent;
      })
      promises.push(promise)
    })
    await Promise.all(promises)
    return results
  }

  /**
   * find and parse all the files end with .json under the target directory
   * @param cwd
   * @returns {Promise.<{}>}
   */
  async readMenuFiles(cwd) {
    cwd = cwd || process.cwd()
    let menuPaths = await glob('*/**/menu.json', {
      cwd: cwd,
      ignore: 'node_modules/**/*',
      nodir: true
    })
    let promises = []
    let results = {}
    menuPaths.forEach((filePath) => {
      let promise = readFile(path.resolve(cwd, filePath), 'utf-8')
      promise.then((fileContent) => {
        results[filePath] = JSON.parse(fileContent)
      })
      promises.push(promise)
    })
    await Promise.all(promises)
    return results
  }
}

module.exports = MDParser;