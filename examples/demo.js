const MDParser = require('../');
const Koa = require('koa');
const app = new Koa();

let mdParser = new MDParser(__dirname, {
  urlPrefix: '/docs'
});

app.use(mdParser.getMiddleware());

app.use(async (ctx, next) => {
  const start = new Date().getTime(); // 当前时间
  await next(); // 调用下一个middleware
  const ms = new Date().getTime() - start; // 耗费时间
  ctx.set('X-Response-Time', `${ms}ms`);
});

let port = 3003
app.listen(port);
console.log(`start at: http://127.0.0.1:3003`);
