import { chromium } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.argv[2];
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': p.endsWith('.js') ? 'text/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); res.end(d); }); }).listen(0);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const pg = await b.newPage({ viewport: { width: 90, height: 160 } });
await pg.goto(`http://localhost:${server.address().port}/index.html?render=1&res=90&mb=1&noao`); await pg.waitForFunction(() => window.renderAt && window.ready);
const out = await pg.evaluate(async () => { const m = await import('./src/shots_dm.js'); const a = []; for (let i = 0; i <= Math.round(m.DURATION * 100); i++) a.push(+m.poleA(i / 100).toFixed(5)); return { duration: m.DURATION, splash: m.T_SPLASH, out: m.T_OUT, pole: a }; });
fs.writeFileSync(process.argv[3], JSON.stringify(out)); console.log('ok', out.duration, out.splash, out.out);
await b.close(); server.close();
