import { chromium } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.argv[2];
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': p.endsWith('.js') ? 'text/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); res.end(d); }); }).listen(0);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const pg = await b.newPage({ viewport: { width: 90, height: 160 } });
await pg.goto(`http://localhost:${server.address().port}/index.html?render=1&res=90&mb=1&noao&dbg`); await pg.waitForFunction(() => window.renderAt && window.ready);
console.log(await pg.evaluate(() => { const o = []; for (let t = 0; t <= 7.5; t += 0.25) { window.renderAt(t); const k = window._F.bones.kilt.rotation; o.push(`${t.toFixed(2)}:${(k.x * 57.3).toFixed(1)}/${(k.z * 57.3).toFixed(1)}`); } return 'kilt swing deg (fwd/side): ' + o.join(' '); }));
await b.close(); server.close();
