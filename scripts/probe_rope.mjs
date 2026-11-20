// Rope probe: the rope's lower end must meet the top of the bucket's bail, and its upper end the pole tip, over the
// whole clip (v1.0.0 bug: the rope never tilted with the bucket's swing, so it ended in mid-air beside the bail).
// usage (from the engine folder): node probe_rope.mjs <engine dir>   -> PASS when both gaps stay under 1.5 cm
import { chromium } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.argv[2];
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': p.endsWith('.js') ? 'text/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); res.end(d); }); }).listen(0);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const pg = await b.newPage({ viewport: { width: 90, height: 160 } });
pg.on('pageerror', e => console.log('ERR', e.message));
await pg.goto(`http://localhost:${server.address().port}/index.html?render=1&res=90&mb=1&noao&dbg`); await pg.waitForFunction(() => window.renderAt && window.ready);
const r = await pg.evaluate(async () => {
  const THREE = await import('three'); const out = { bail: 0, tip: 0, tb: 0, tt: 0, swing: 0, n: 0 };
  for (let t = 0; t <= window.DURATION + 1e-6; t += 0.02) {
    window.renderAt(t); const S = window._S; S.updateMatrixWorld(true);
    const { rope, bucket } = S.userData;
    const lo = new THREE.Vector3(0, -0.5, 0).applyMatrix4(rope.matrixWorld), hi = new THREE.Vector3(0, 0.5, 0).applyMatrix4(rope.matrixWorld);
    const apex = new THREE.Vector3(0, 0.225, 0).applyMatrix4(bucket.matrixWorld); // bail torus r 0.18, scale.y 1.25
    const tip = S.tipWorld();
    const gb = lo.distanceTo(apex), gt = hi.distanceTo(tip); out.n++;
    if (gb > out.bail) { out.bail = gb; out.tb = t; } if (gt > out.tip) { out.tip = gt; out.tt = t; }
    out.swing = Math.max(out.swing, Math.hypot(apex.x - tip.x, apex.z - tip.z)); // proves the bucket really swings here
  }
  return out;
});
console.log(`rope probe: ${r.n} samples, largest sideways bucket offset ${(r.swing * 100).toFixed(1)} cm (must be > 0, or the probe is blind)`);
console.log(`  rope end to bail top: max ${(r.bail * 100).toFixed(2)} cm at ${r.tb.toFixed(2)} s`);
console.log(`  rope top to pole tip: max ${(r.tip * 100).toFixed(2)} cm at ${r.tt.toFixed(2)} s`);
console.log(r.bail < 0.015 && r.tip < 0.015 && r.swing > 0.01 ? 'PASS' : 'FAIL');
await b.close(); server.close();
