import { chromium } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.argv[2];
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': p.endsWith('.js') ? 'text/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); res.end(d); }); }).listen(0);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const pg = await b.newPage({ viewport: { width: 90, height: 160 } });
pg.on('pageerror', e => console.log('ERR', e.message));
await pg.goto(`http://localhost:${server.address().port}/index.html?render=1&res=90&mb=1&noao&dbg`); await pg.waitForFunction(() => window.renderAt && window.ready);
console.log(await pg.evaluate(async () => {
  const THREE = await import('three'); const out = []; const v = new THREE.Vector3();
  for (let t = 0; t <= 7.5; t += 0.05) {
    window.renderAt(t); const F = window._F, S = window._S;
    const bucket = S.userData.bucket; bucket.updateMatrixWorld(true); const inv = bucket.matrixWorld.clone().invert();
    let worst = 0, part = '';
    F.root.traverse(o => {
      if (!o.isMesh) return; // every part: skinned body, head, face, hands, feet
      const n = o.geometry.attributes.position.count;
      for (let i = 0; i < n; i += 3) {
        if (o.isSkinnedMesh) o.getVertexPosition(i, v); else v.fromBufferAttribute(o.geometry.attributes.position, i);
        v.applyMatrix4(o.matrixWorld).applyMatrix4(inv); // into bucket space (bucket axis = y, rim at y=0, base at -0.345)
        const r = Math.hypot(v.x, v.z); if (v.y < -0.345 || v.y > 0.012) continue;
        const pen = 0.19 - r; if (pen > worst) { worst = pen; part = o.geometry.type + (o.isSkinnedMesh ? '(skinned)' : ''); }
      }
    });
    if (worst > 0.005) out.push(`t=${t.toFixed(2)} body inside bucket by ${(worst * 100).toFixed(1)} cm (${part})`);
  }
  return out.join('\n') || 'no body part inside the bucket at any time';
}));
await b.close(); server.close();
