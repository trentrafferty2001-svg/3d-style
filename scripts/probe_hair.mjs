// Hair probe (v1.15): for every character in window._FS (or window._F), every frame at the step:
//  1. hats: no hair, beard or headcloth point outside a hat that covers it (a ray from the head's centre out through each
//     point must not cross the hat's surface first)
//  2. beards keep clear of the mouth: no beard point within 1.5 mm of the lips or the dark opening, whatever the mouth does
//  3. braids and headcloth tails never go into the neck, torso or shoulders (they hang from the head, which turns)
// usage (from the engine folder): node probe_hair.mjs <engine dir> <duration> [step]   -> PASS / FAIL
import { chromium } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const [ROOT, DUR, STEP] = [process.argv[2], Number(process.argv[3] || 5), Number(process.argv[4] || 0.1)];
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': p.endsWith('.js') ? 'text/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); res.end(d); }); }).listen(0);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const pg = await b.newPage({ viewport: { width: 90, height: 160 } });
pg.on('pageerror', e => console.log('ERR', e.message));
await pg.goto(`http://localhost:${server.address().port}/index.html?render=1&res=90&mb=1&noao&dbg`); await pg.waitForFunction(() => window.renderAt && window.ready);
const out = await pg.evaluate(async ({ DUR, STEP }) => {
  const THREE = await import('three'); const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const rc = new THREE.Raycaster(); let hatOut = { d: 0 }, mouth = { d: 9 }, hang = { d: 0 }, nHair = 0, nHat = 0, nBeard = 0, nHang = 0;
  // a mesh's points in world space; hair shells carry hairOff (offset from the scalp): points under the skin are skipped
  const pts = (o, every = 1) => { const a = o.geometry.attributes.position, off = o.geometry.attributes.hairOff, r = []; o.updateMatrixWorld(true);
    for (let i = 0; i < a.count; i += every) { if (off && off.getX(i) <= 0) continue; const P = V().fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld); P.i = i; r.push(P); } return r; };
  for (let t = 0; t <= DUR + 1e-6; t += STEP) {
    window.renderAt(t);
    for (const F of (window._FS || [window._F])) {
      F.root.updateMatrixWorld(true); const hair = [], beard = [], hangs = [], lips = [], body = [];
      F.bones.head.traverse(o => { if (!o.isMesh) return; if (['hair', 'fringe', 'headcloth', 'braid'].includes(o.name)) hair.push(o); if (o.name === 'beard') beard.push(o);
        if (o.name === 'braid' || (o.name === 'headcloth' && o.geometry.type === 'TubeGeometry')) hangs.push(o); });
      F.root.traverse(o => { if (o.isMesh && o.material === F.M.lip) lips.push(o); if (o.isMesh && o.material === F.M.mouth && o.visible) lips.push(o);
        if (o.isSkinnedMesh && (o.material === F.M.skin || ['tunic', 'sleeve', 'neckline'].includes(o.name))) { o.skeleton.update(); body.push(o); } });
      nHair += hair.length; nBeard += beard.length;
      // 1. hats
      if (F.hat) { nHat++; const hatMeshes = []; F.hat.traverse(o => { if (o.isMesh) hatMeshes.push(o); }); F.hat.updateMatrixWorld(true);
        const C = F.bones.head.localToWorld(V(0, 0.08, 0.01));
        for (const o of [...hair, ...beard]) for (const P of pts(o, 3)) { const d = P.clone().sub(C), L = d.length(); rc.set(C, d.divideScalar(L)); rc.far = L;
          const h = rc.intersectObjects(hatMeshes, false)[0]; if (h && L - h.distance > hatOut.d) hatOut = { d: L - h.distance, t, name: o.name }; } }
      // 2. beard vs mouth
      if (beard.length && lips.length) { const L = lips.flatMap(o => pts(o, 1));
        for (const o of beard) for (const P of pts(o, 2)) for (const Q of L) { const d = P.distanceTo(Q); if (d < mouth.d) mouth = { d, t }; } }
      // 3. hanging braids and ends vs the body (inside test against the nearest posed body vertex and its normal)
      if (hangs.length) { nHang += hangs.length; const B = [], HC = F.bones.head.localToWorld(V(0, 0.08, 0.01));
        for (const m of body) { const a = m.geometry.attributes.position, n = m.geometry.attributes.normal; for (let i = 0; i < a.count; i += 2) { const P = m.getVertexPosition(i, V()).applyMatrix4(m.matrixWorld);
          if (P.distanceTo(F.bones.neck.getWorldPosition(V())) < 0.35 && P.distanceTo(HC) > 0.1 * F.root.scale.x) B.push(P); } } // (not the neck's top, hidden inside the head)
        const ctr = F.bones.chest.getWorldPosition(V()), nk = F.bones.neck.getWorldPosition(V());
        for (const o of hangs) for (const P of pts(o, 2)) { let best = 9, bq = null; for (const Q of B) { const d = P.distanceToSquared(Q); if (d < best) { best = d; bq = Q; } }
          if (!bq) continue; // inside if the point is nearer the body's axis (chest to neck line) than the nearest body point
          const ax = nk.clone().sub(ctr), h = Math.min(1, Math.max(0, P.clone().sub(ctr).dot(ax) / ax.dot(ax))), A = ctr.clone().addScaledVector(ax, h);
          const inside = P.distanceTo(A) < bq.distanceTo(A) - 0.002; if (inside && Math.sqrt(best) > hang.d) hang = { d: Math.sqrt(best), t, name: o.name, P: P.toArray().map(x => x.toFixed(3)), Q: bq.toArray().map(x => x.toFixed(3)), A: A.toArray().map(x => x.toFixed(3)) }; } }
    }
  }
  const log = [`hair pieces checked: ${nHair}, beards: ${nBeard}, hats: ${nHat}, hanging braids/ends: ${nHang}`]; let ok = nHair > 0;
  if (!ok) log.push('FAIL no hair found');
  if (nHat) { log.push(`hats: worst point outside its hat ${(hatOut.d * 1000).toFixed(1)} mm${hatOut.d ? ` (${hatOut.name}, ${hatOut.t.toFixed(1)} s)` : ''} (want 0)`); if (hatOut.d > 0) ok = false; }
  if (nBeard) { log.push(`beard to lips or mouth: min ${(mouth.d * 1000).toFixed(1)} mm at ${mouth.t.toFixed(1)} s (want > 1.5 mm)`); if (mouth.d < 0.0015) ok = false; }
  if (nHang) { log.push(`braids/ends inside the body: worst ${(hang.d * 1000).toFixed(1)} mm${hang.d ? ` (${hang.name}, ${hang.t.toFixed(1)} s)` : ''} (want 0)${hang.P ? ` point ${hang.P} body ${hang.Q} axis ${hang.A}` : ''}`); if (hang.d > 0) ok = false; }
  log.push(ok ? 'PASS' : 'FAIL'); return log.join('\n');
}, { DUR, STEP });
console.log(out); await b.close(); server.close();
