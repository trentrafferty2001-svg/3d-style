// Motion-blur budget probe (adaptive motion blur, main.js): renders every frame at a small size with mb=<max> and reports
// how many sub-frames each frame used and how far things moved on screen (pixels at the final 1080x1920 size).
// usage (from the engine folder): node probe_mb.mjs <engine dir> <duration s> [max mb, default 6]
import { chromium } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.argv[2], DUR = Number(process.argv[3] || 5), MBX = Number(process.argv[4] || 6);
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': p.endsWith('.js') || p.endsWith('.mjs') ? 'text/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); res.end(d); }); }).listen(0);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const pg = await b.newPage({ viewport: { width: 90, height: 160 } });
pg.on('pageerror', e => console.log('ERR', e.message));
await pg.goto(`http://localhost:${server.address().port}/index.html?render=1&res=1080&mb=${MBX}&noao&nodof&fps=30`); await pg.waitForFunction(() => window.renderAt && window.ready);
const r = await pg.evaluate(async ({ DUR }) => { const out = []; for (let f = 0; f < Math.round(DUR * 30); f += 3) { window.renderAt(f / 30); const m = window._mbLast || { px: 0, n: 0 }; out.push([f, m.px, m.n]); } return out; }, { DUR });
const used = r.reduce((s, x) => s + x[2], 0), full = r.length * MBX;
console.log(r.map(([f, px, n]) => `${f}:${px.toFixed(1)}px->${n}`).join(' '));
console.log(`sub-frames: ${used} of ${full} at a fixed mb=${MBX} (${(100 * used / full).toFixed(0)}%), sampled every 3rd frame`);
await b.close(); server.close();
