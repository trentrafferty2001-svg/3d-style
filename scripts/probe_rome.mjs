// Roman set probe (shots_rm.js or any scene that sets window._SITE and window._F under ?dbg):
//  1. every prop (columns, stepping stones, amphorae, olive trunk): its lowest vertices vs the ground right under them
//  2. every instanced plant (grass, olive, cypresses, pines): instance origin vs the ground under it
//  3. the worker's soles vs heightAt over the whole clip
//  4. palms vs the tunic's cloth (skirt, shell, sleeves): no palm inside the cloth
// usage (from the engine folder): node probe_rome.mjs <engine dir>   -> PASS / FAIL per check
import { chromium } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.argv[2];
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': p.endsWith('.js') ? 'text/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); res.end(d); }); }).listen(0);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const pg = await b.newPage({ viewport: { width: 90, height: 160 } });
pg.on('pageerror', e => console.log('ERR', e.message));
await pg.goto(`http://localhost:${server.address().port}/index.html?render=1&res=90&mb=1&noao&dbg`); await pg.waitForFunction(() => window.renderAt && window.ready);
const out = await pg.evaluate(async () => {
  const THREE = await import('three'); const log = []; let ok = true;
  window.renderAt(0.5); const S = window._SITE, FS = window._FS || [window._F]; S.updateMatrixWorld(true); // every character the scene lists
  const rc = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
  const groundAt = (x, z) => { rc.set(new THREE.Vector3(x, 40, z), down); const h = rc.intersectObjects(S.userData.ground, false)[0]; return h ? h.point.y : null; };
  // 1. props: the lowest 3% of each prop's vertices, each against the ground right under it
  const v = new THREE.Vector3();
  for (const p of S.userData.props) {
    const pts = []; p.traverse(o => { if (!o.isMesh) return; const a = o.geometry.attributes.position; for (let i = 0; i < a.count; i += 2) { v.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld); pts.push(v.clone()); } });
    pts.sort((a, b) => a.y - b.y); const low = pts.slice(0, Math.max(3, Math.floor(pts.length * 0.03)));
    let gap = 1e9, sink = 0; for (const q of low) { const g = groundAt(q.x, q.z); if (g == null) continue; gap = Math.min(gap, q.y - g); sink = Math.max(sink, g - q.y); }
    const name = p.type + (p.children.length ? `(${p.children.length})` : '') + ` at ${p.position.x.toFixed(1)},${p.position.z.toFixed(1)}`;
    if (gap > 0.02) { ok = false; log.push(`FLOAT ${name}: lowest point ${(gap * 100).toFixed(1)} cm above the ground`); }
    else log.push(`  ok ${name}: contact ${(gap * 100).toFixed(1)} cm, sunk ${(sink * 100).toFixed(1)} cm`);
  }
  // 2. instanced plants: origin vs ground
  const M = new THREE.Matrix4(), P = new THREE.Vector3();
  S.traverse(o => { if (!o.isInstancedMesh || o.userData.noGround) return; let fl = -1, n = 0; // (noGround: splash drops and other airborne effects)
    for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, M); P.setFromMatrixPosition(M).applyMatrix4(o.matrixWorld); const g = groundAt(P.x, P.z); if (g == null) continue; n++; fl = Math.max(fl, P.y - g); }
    if (fl > 0.02) { ok = false; log.push(`FLOAT instanced (${o.count}): an origin ${(fl * 100).toFixed(1)} cm above the ground`); } else log.push(`  ok instanced (${o.count}, ${n} over ground): highest origin ${(fl * 100).toFixed(1)} cm vs ground`); });
  // 3 + 4 over the clip
  let soleLo = 9, soleHi = -9, palmIn = 9, tP = 0;
  for (let t = 0; t <= window.DURATION; t += 0.1) {
    window.renderAt(t);
    for (const F of FS) { F.root.updateMatrixWorld(true); const cloth = []; F.root.traverse(o => { if (o.isSkinnedMesh && ['kilt', 'tunic', 'sleeve'].includes(o.name)) cloth.push(o); });
    for (const s of ['l', 'r']) {
      // sole: the lowest point of the foot meshes under the ankle bone
      let lo = 9, at = null; F.bones[s + 'An'].traverse(o => { if (!o.isMesh) return; const a = o.geometry.attributes.position; for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld); if (v.y < lo) { lo = v.y; at = v.clone(); } } });
      const d = lo - window._SITE.userData.heightAt(at.x, at.z); soleLo = Math.min(soleLo, d); soleHi = Math.max(soleHi, d);
      // palm centre vs cloth: nearest cloth vertex, and whether the palm is nearer the body axis than that vertex
      const palm = F.bones[s + 'Wr'].localToWorld(new THREE.Vector3(0, -0.05, 0)); let best = 9;
      for (const o of cloth) { const a = o.geometry.attributes.position; for (let i = 0; i < a.count; i += 2) { o.getVertexPosition(i, v); v.applyMatrix4(o.matrixWorld); const dd = v.distanceTo(palm); if (dd < best) best = dd; } }
      if (best < palmIn) { palmIn = best; tP = t; }
    }
    }
  }
  log.push(`soles vs ground: ${(soleLo * 100).toFixed(1)} .. ${(soleHi * 100).toFixed(1)} cm (want about -2 .. +2)`); if (soleLo < -0.025 || soleHi > 0.025) ok = false;
  log.push(`palm centre to nearest cloth vertex: min ${(palmIn * 100).toFixed(1)} cm at ${tP.toFixed(1)} s (want > 3 cm: the palm is ~2 cm thick)`); if (palmIn < 0.03) ok = false;
  log.push(ok ? 'PASS' : 'FAIL'); return log.join('\n');
});
console.log(out); await b.close(); server.close();
