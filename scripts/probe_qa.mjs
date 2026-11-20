// Automated QA for the shaduf demo: grounding, feet, bucket clearance, hands vs head, counterweight, camera.
import { chromium } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.argv[2];
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': p.endsWith('.js') ? 'text/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); res.end(d); }); }).listen(0);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const pg = await b.newPage({ viewport: { width: 90, height: 160 } });
pg.on('pageerror', e => console.log('ERR', e.message)); pg.on('console', m => { if (m.type() === 'log') console.log(m.text()); });
await pg.goto(`http://localhost:${server.address().port}/index.html?render=1&res=90&mb=1&noao&dbg`); await pg.waitForFunction(() => window.renderAt && window.ready);
const out = await pg.evaluate(async () => {
  const THREE = await import('three'); const R = []; const log = (s) => R.push(s);
  window.renderAt(5.0); const W = window._W, F = window._F, S = window._S; const scene = W.scene;
  let terrain = null, platform = null; scene.traverse(o => { if (o.isMesh && o.material && o.material.vertexColors && o.geometry.attributes.color && o.geometry.index && o.geometry.attributes.position.count > 50000) terrain = o; });
  scene.traverse(o => { if (o.isMesh && Math.abs(o.position.z - 1.225) < 0.05 && Math.abs(o.position.x - 0.875) < 0.05) platform = o; });
  log(`terrain ${!!terrain}, platform ${!!platform}`);
  const rc = new THREE.Raycaster(); const down = new THREE.Vector3(0, -1, 0);
  const groundAt = (x, z, objs = [terrain]) => { rc.set(new THREE.Vector3(x, 60, z), down); const h = rc.intersectObjects(objs, false)[0]; return h ? h.point.y : null; };
  // 1. instanced plants: base (instance origin) vs terrain surface; papyrus in water just needs to be below the surface
  const M = new THREE.Matrix4(), P = new THREE.Vector3();
  scene.traverse(o => {
    if (!o.isInstancedMesh || o.count < 2) return;
    let fl = 0, sk = 0, worst = null, n = 0;
    for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, M); P.setFromMatrixPosition(M).applyMatrix4(o.matrixWorld); const g = groundAt(P.x, P.z); if (g == null) continue; n++; const d = P.y - g; if (d > fl) { fl = d; worst = P.clone(); } sk = Math.min(sk, d); }
    log(`instanced (${o.count}, ${o.geometry.attributes.position.count} verts): max float ${fl.toFixed(3)} m at ${worst ? worst.toArray().map(v => v.toFixed(2)).join(',') : '-'}, deepest ${sk.toFixed(3)} m, n=${n}`);
  });
  // 2. palms / hut / jars / pillars: lowest point of each object vs terrain under its footprint
  const objs = []; scene.children.forEach(o => { if (o.isGroup && o !== F.root && o !== S) objs.push(o); });
  for (const o of objs) {
    const box = new THREE.Box3().setFromObject(o); if (!isFinite(box.min.y)) continue; const c = box.getCenter(new THREE.Vector3());
    if (box.max.y - box.min.y > 50) continue;
    const g = groundAt(o.position.x, o.position.z); if (g == null) continue;
    const flo = box.min.y - g; if (flo > 0.02) log(`FLOAT group at ${o.position.toArray().map(v => v.toFixed(1))}: bottom ${flo.toFixed(3)} m above ground`);
  }
  scene.children.forEach(o => { if (o.isMesh && o.geometry.type === 'LatheGeometry') { const box = new THREE.Box3().setFromObject(o); const g = groundAt(o.position.x, o.position.z); log(`jar at ${o.position.x.toFixed(2)},${o.position.z.toFixed(2)}: bottom-ground ${(box.min.y - g).toFixed(3)} m`); } });
  // shaduf pillar feet vs ground
  S.updateMatrixWorld(true); S.children.forEach(o => { if (o.isMesh && o.geometry.type === 'CylinderGeometry' && o.geometry.parameters.height < 0.2) { const p = o.getWorldPosition(new THREE.Vector3()); const g = groundAt(p.x, p.z); log(`pillar foot at x ${p.x.toFixed(2)}: bottom-ground ${(p.y - 0.08 - g).toFixed(3)} m`); } });
  // 3. over time: feet vs platform top, bucket clearance to the platform, hands vs head, counterweight vs ground, camera vs terrain
  const sole = (s) => { let m = null; F.bones[s + 'An'].traverse(o => { if (o.isMesh && o.geometry.type === 'CapsuleGeometry' && o.scale.z < 0.2) m = o; }); return m; };
  let feet = [9, -9], bucketMin = 9, handHead = 9, cwMin = 9, camMin = 9, kiltBad = 0;
  const bucket = S.userData.bucket, cw = S.userData.cw;
  for (let t = 0; t <= 7.5; t += 0.05) {
    const idx = window.renderAt(t);
    for (const s of ['l', 'r']) { const so = sole(s); const box = new THREE.Box3().setFromObject(so); const c = box.getCenter(new THREE.Vector3()); const g = groundAt(c.x, c.z, [platform]); if (g != null) { const d = box.min.y - g; feet[0] = Math.min(feet[0], d); feet[1] = Math.max(feet[1], d); } }
    // bucket: horizontal ray from its centre towards +x hits the platform side; clearance = hit distance - bucket radius
    const bc = bucket.getWorldPosition(new THREE.Vector3()); rc.set(bc, new THREE.Vector3(1, 0, 0)); const h = rc.intersectObject(platform, false)[0]; if (h) bucketMin = Math.min(bucketMin, h.distance - 0.2);
    const bb = new THREE.Box3().setFromObject(bucket); const pb = new THREE.Box3().setFromObject(platform); if (bb.intersectsBox(pb) && bb.max.x > 0.28) bucketMin = Math.min(bucketMin, -1);
    const head = F.bones.head.localToWorld(new THREE.Vector3(0, 0.075, 0.012));
    for (const s of ['l', 'r']) { const palm = F.bones[s + 'Wr'].localToWorld(new THREE.Vector3(0, -0.05, 0)); handHead = Math.min(handHead, palm.distanceTo(head) - 0.13); }
    const cp = cw.getWorldPosition(new THREE.Vector3()); cwMin = Math.min(cwMin, cp.y - 0.36 - (groundAt(cp.x, cp.z) ?? 0));
  }
  log(`feet: sole bottom vs platform top ranges ${feet[0].toFixed(3)} .. ${feet[1].toFixed(3)} m (want about -0.02 .. +0.02)`);
  log(`bucket clearance to platform side: min ${bucketMin.toFixed(3)} m (negative = collision)`);
  log(`hand to head surface: min ${handHead.toFixed(3)} m (negative = hand inside head)`);
  log(`counterweight bottom above ground: min ${cwMin.toFixed(3)} m`);
  return R.join('\n');
});
console.log(out); await b.close(); server.close();
