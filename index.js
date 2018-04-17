const glob = pify(require('glob'))
const marked = require('marked')
const highlightjs = require('highlight.js')
const fm = require('front-matter')
const fs = require('fs')
const readFile = util.promisify(fs.readFile)

class MDParser {
  constructor(destDir) {
    destDir = destDir || process.cwd();
    this.destDir = destDir;
    this.setMarked();
  }

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

  async getFiles(cwd) {
    console.log('Building files...')
    cwd = cwd || process.cwd()
    let docPaths = await glob('*/**/*.md', {
      cwd: cwd,
      ignore: 'node_modules/**/*',
      nodir: true
    })
    let promises = []
    let tmpDocFiles = {}
    docPaths.forEach((path) => {
      let promise = getDocFile(path, cwd)
      promise.then((file) => {
        tmpDocFiles[path] = file
      })
      promises.push(promise)
    })
    await Promise.all(promises)
    _DOC_FILES_ = tmpDocFiles
    // Construct the doc menu
    await getMenu(cwd)
  }

  // Get doc file and sent back it's attributes and html body
  async getDocFile(path, cwd) {
    cwd = cwd || process.cwd()
    let file = await readFile(resolve(cwd, path), 'utf-8')
    // transform markdown to html
    file = fm(file)
    let _DOC_FILES_[path] = {
      attrs: file.attributes,
      body: marked(file.body)
    }
    return _DOC_FILES_[path]
  }
}

