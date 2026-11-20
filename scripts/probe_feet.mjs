import { chromium } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.argv[2];
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': p.endsWith('.js') ? 'text/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); res.end(d); }); }).listen(0);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const pg = await b.newPage({ viewport: { width: 90, height: 160 } });
pg.on('pageerror', e => console.log('ERR', e.message));
await pg.goto(`http://localhost:${server.address().port}/index.html?render=1&res=90&mb=1&noao&dbg`); await pg.waitForFunction(() => window.renderAt && window.ready);
console.log(await pg.evaluate(async () => {
  const THREE = await import('three'); const out = [];
  window.renderAt(0); let F = window._F;
  for (let t = 0; t <= 7.5; t += 0.1) {
    window.renderAt(t); F = window._F; // shot 2 has its own farmer
    const row = ['l', 'r'].map(s => { const a = F.bones[s + 'An'].getWorldPosition(new THREE.Vector3()); return (a.y - 0.55 - 0.075).toFixed(3); });
    if (Math.max(...row.map(Number)) > 0.01 || Math.min(...row.map(Number)) < -0.01) out.push(`t=${t.toFixed(1)} ankle above target l ${row[0]} r ${row[1]}`);
  }
  return out.join('\n') || 'all ankles on target';
}));
await b.close(); server.close();
