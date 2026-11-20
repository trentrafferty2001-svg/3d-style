// hands on hips: palm centre vs the torso/kilt surface (nearest skinned vertex), and whether it sits inside the body
import { chromium } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.argv[2];
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': p.endsWith('.js') ? 'text/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); res.end(d); }); }).listen(0);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const pg = await b.newPage({ viewport: { width: 90, height: 160 } });
pg.on('pageerror', e => console.log('ERR', e.message));
await pg.goto(`http://localhost:${server.address().port}/index.html?render=1&res=90&mb=1&noao&dbg`); await pg.waitForFunction(() => window.renderAt && window.ready);
console.log(await pg.evaluate(async () => {
  const THREE = await import('three'); const out = []; const v = new THREE.Vector3();
  for (let t = 4.8; t <= 7.5; t += 0.1) {
    window.renderAt(t); const F = window._F; const hipC = F.bones.hips.getWorldPosition(new THREE.Vector3());
    const row = [];
    for (const s of ['l', 'r']) {
      const palm = F.bones[s + 'Wr'].localToWorld(new THREE.Vector3(0, -0.05, 0)); let best = 9, bestP = null;
      F.root.traverse(o => { if (!o.isSkinnedMesh || (o.name !== 'torso' && o.name !== 'kilt')) return; const n = o.geometry.attributes.position.count; for (let i = 0; i < n; i += 2) { o.getVertexPosition(i, v); v.applyMatrix4(o.matrixWorld); const d = v.distanceTo(palm); if (d < best) { best = d; bestP = v.clone(); } } });
      // inside test: palm closer to the hip axis than the surface point is
      const axis = (p) => Math.hypot(p.x - hipC.x, p.z - hipC.z); const inside = axis(palm) < axis(bestP) - 0.005;
      row.push(`${s} ${(best * 100).toFixed(1)}cm${inside ? ' INSIDE' : ''}`);
    }
    out.push(`t=${t.toFixed(1)} ${row.join('  ')}`);
  }
  return out.join('\n');
}));
await b.close(); server.close();
