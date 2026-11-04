// node bake.js opts.json out.png  — renders a sprite atlas from a 3D model in headless Chromium
const { chromium } = require('playwright'), fs = require('fs'), path = require('path'), http = require('http');
const opts = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), out = process.argv[3];
const root = __dirname, srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); r.end(d); }); }).listen(0, async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage();
  p.on('console', m => console.log('page:', m.text())); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(`http://127.0.0.1:${srv.address().port}/render.html`); await p.waitForFunction(() => window.ready);
  const r = await p.evaluate(o => window.renderAtlas(o), opts);
  fs.writeFileSync(out, Buffer.from(r.png.split(',')[1], 'base64')); delete r.png; if (r.mask) fs.writeFileSync(out.replace(/\.png$/, '-mask.png'), Buffer.from(r.mask.split(',')[1], 'base64')); delete r.mask; fs.writeFileSync(out.replace(/\.png$/, '.atlas.json'), JSON.stringify(r)); console.log(JSON.stringify(r));
  await b.close(); srv.close(); });
