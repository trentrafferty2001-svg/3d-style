// Cloth probe (v1.14): no skin pokes out through a character's clothes, over the whole clip.
// For every character in window._FS (or window._F) wearing cloth (meshes named tunic, kilt, sleeve), every frame at 0.1 s:
// the body's skinned vertices (torso, arms, legs) and the cloth's skinned vertices (plus the legs' push on the skirt,
// clothPush, the same function as the shader) are posed on the CPU. For each body vertex the ray from the bone inside it
// (the nearest bone segment) out through the vertex is tested against the cloth's triangles: if it crosses the cloth
// before it reaches the vertex by more than the tolerance, that vertex shows through the cloth.
// Also: the belt sits on the cloth (no gap over 6 mm between the belt tube and the cloth under it).
// usage (from the engine folder): node probe_cloth.mjs <engine dir> <duration> [step]   -> PASS / FAIL
import { chromium } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const [ROOT, DUR, STEP] = [process.argv[2], Number(process.argv[3] || 5), Number(process.argv[4] || 0.1)];
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': p.endsWith('.js') ? 'text/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); res.end(d); }); }).listen(0);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const pg = await b.newPage({ viewport: { width: 90, height: 160 } });
pg.on('pageerror', e => console.log('ERR', e.message));
await pg.goto(`http://localhost:${server.address().port}/index.html?render=1&res=90&mb=1&noao&dbg`); await pg.waitForFunction(() => window.renderAt && window.ready);
const out = await pg.evaluate(async ({ DUR, STEP }) => {
  const THREE = await import('three'); const { clothPush } = await import('/src/toon.js');
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), TOL = 0.002, CELL = 0.03;
  const log = []; let worst = { d: 0 }, beltGap = 0, nChk = 0, nChars = 0; const dirs = [];
  // segment p->q vs triangle (Moller-Trumbore): parameter along the segment, or -1
  const e1 = V(), e2 = V(), pv = V(), tv = V(), qv = V();
  const segTri = (o, dir, a, b2, c) => { e1.subVectors(b2, a); e2.subVectors(c, a); pv.crossVectors(dir, e2); const det = e1.dot(pv); if (Math.abs(det) < 1e-12) return -1;
    const inv = 1 / det; tv.subVectors(o, a); const u = tv.dot(pv) * inv; if (u < 0 || u > 1) return -1; qv.crossVectors(tv, e1); const v = dir.dot(qv) * inv; if (v < 0 || u + v > 1) return -1;
    return e2.dot(qv) * inv; };
  const segDist = (p, a, b2) => { const ab = b2.clone().sub(a), h = Math.min(1, Math.max(0, p.clone().sub(a).dot(ab) / ab.dot(ab))); return [a.clone().addScaledVector(ab, h), p.distanceTo(a.clone().addScaledVector(ab, h))]; };
  for (let t = 0; t <= DUR + 1e-6; t += STEP) {
    window.renderAt(t);
    for (const F of (window._FS || [window._F])) {
      // bone matrices of a skinned mesh are only refreshed when it is drawn: refresh them, or a character of a shot not on
      // screen is read with its skin in an old pose and its bones in the new one
      F.root.updateMatrixWorld(true); const cloth = [], body = [];
      F.root.traverse(o => { if (!o.isSkinnedMesh) return; o.skeleton.update(); if (['tunic', 'kilt', 'sleeve'].includes(o.name)) cloth.push(o); else if (o.material === F.M.skin && o.name !== 'neckline') body.push(o); });
      if (!cloth.length) continue; if (t === 0) nChars++;
      const B = F.bones, W = (n) => B[n].getWorldPosition(V());
      // the legs, as clothPush wants them (cloth mesh space)
      const legs = ['l', 'r'].flatMap(s => [s + 'Hip', s + 'Kn', s + 'An'].map(n => cloth[0].worldToLocal(W(n))));
      // posed cloth triangles in world space, in a grid
      const grid = new Map(), key = (x, y, z) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`, tris = [];
      for (const m of cloth) { const g = m.geometry, pa = g.attributes.position, idx = g.index, P = [], nm = m.name;
        for (let i = 0; i < pa.count; i++) { const v = m.getVertexPosition(i, V()); P.push(clothPush(v, pa.getY(i), legs).applyMatrix4(m.matrixWorld)); }
        const n = idx ? idx.count : pa.count; for (let i = 0; i < n; i += 3) { const tri = [0, 1, 2].map(k => P[idx ? idx.getX(i + k) : i + k]); tri.nm = nm; const ti = tris.push(tri) - 1;
          const lo = tri[0].clone().min(tri[1]).min(tri[2]), hi = tri[0].clone().max(tri[1]).max(tri[2]);
          for (let x = Math.floor(lo.x / CELL); x <= Math.floor(hi.x / CELL); x++) for (let y = Math.floor(lo.y / CELL); y <= Math.floor(hi.y / CELL); y++) for (let z = Math.floor(lo.z / CELL); z <= Math.floor(hi.z / CELL); z++) {
            const k = `${x},${y},${z}`; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(ti); } } }
      // each body vertex is tested from the bone that carries it (its largest skin weight): torso from the spine line,
      // an arm or leg vertex from that limb's bones (nearest of them)
      const SEG = { trunk: [['hips', 'neck']], lArm: [['lSh', 'lEl'], ['lEl', 'lWr']], rArm: [['rSh', 'rEl'], ['rEl', 'rWr']], lLeg: [['lHip', 'lKn'], ['lKn', 'lAn']], rLeg: [['rHip', 'rKn'], ['rKn', 'rAn']] };
      const segW = Object.fromEntries(Object.entries(SEG).map(([k, v]) => [k, v.map(([a, c]) => [W(a), W(c)])]));
      const group = (n) => /^[lr](Sh|El|Wr)$/.test(n) ? n[0] + 'Arm' : /^[lr](Hip|Kn|An)$/.test(n) ? n[0] + 'Leg' : 'trunk';
      for (const m of body) { const pa = m.geometry.attributes.position, si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight, bl = m.skeleton.bones;
        for (let i = 0; i < pa.count; i += 2) { const P = m.getVertexPosition(i, V()).applyMatrix4(m.matrixWorld);
          let bi = 0; for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, bi)) bi = k;
          let Q = null, best = 9; for (const [a, c] of segW[group(bl[si.getComponent(i, bi)].name)]) { const [q, d] = segDist(P, a, c); if (d < best) { best = d; Q = q; } }
          const dir = P.clone().sub(Q), L = dir.length(); if (L < 1e-4) continue; dir.divideScalar(L);
          // cells along the segment Q -> P
          const seen = new Set(), cand = []; for (let s = 0; s <= 1.0001; s += CELL * 0.5 / L) { const p = Q.clone().addScaledVector(dir, s * L), k = key(p.x, p.y, p.z);
            for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) for (const dz of [-1, 0, 1]) { const [x, y, z] = k.split(',').map(Number), kk = `${x + dx},${y + dy},${z + dz}`; if (seen.has(kk)) continue; seen.add(kk); for (const ti of grid.get(kk) || []) cand.push(ti); } }
          const grp = group(bl[si.getComponent(i, bi)].name), covers = grp === 'trunk' ? ['tunic', 'kilt'] : grp.endsWith('Arm') ? ['sleeve'] : ['kilt']; // each part against the cloth that covers it
          let hit = 9, hitNm = ''; for (const ti of new Set(cand)) { if (!covers.includes(tris[ti].nm)) continue; const [a, b2, c] = tris[ti], s = segTri(Q, dir, a, b2, c); if (s > 0 && s < hit) { hit = s; hitNm = tris[ti].nm; } }
          // the arm's cap is covered by the sleeve and the shell over it: it shows only if it is outside both. The shell is
          // tested from the spine outwards (from the arm's own bone the ray starts outside the shell whenever the arm swings
          // back, and crosses it on the way to a point that is hidden inside)
          let capHidden = false;
          if (grp.endsWith('Arm') && P.distanceTo(W(grp[0] + 'Sh')) < 0.08) { const [q2] = segDist(P, ...segW.trunk[0]), d2 = P.clone().sub(q2), L2 = d2.length(); d2.divideScalar(L2);
            let h2 = 9; for (const tri of tris) { if (tri.nm !== 'tunic') continue; const s2 = segTri(q2, d2, ...tri); if (s2 > 0 && s2 < h2) h2 = s2; }
            capHidden = !(h2 < L2 - TOL); }
          nChk++; if (hit < L - TOL && !capHidden) { const d = L - hit; if (d > worst.d) worst = { d, t, part: `${m.name || 'limb'} (${bl[si.getComponent(i, bi)].name}) through the ${hitNm}`, at: P.toArray().map(x => x.toFixed(2)).join(',') }; } } }
      // belt: the lowest point of the belt tube's inner side vs the cloth right under it
      if (t === 0) { const belt = []; B.hips.traverse(o => { if (o.isMesh && o.material === F.M.belt && o.geometry.type === 'TubeGeometry') belt.push(o); });
        for (const bm of belt) { const g0 = bm.geometry, pa = g0.attributes.position, rs = g0.parameters.radialSegments + 1, cen = W('hips'); let g = -9;
          for (let r = 0; r + rs <= pa.count; r += rs * 4) { // every 4th ring: its centre, then its point nearest the axis
            const ring = []; for (let j = 0; j < rs; j++) ring.push(V().fromBufferAttribute(pa, r + j).applyMatrix4(bm.matrixWorld));
            const c = ring.reduce((a, q) => a.add(q), V()).divideScalar(rs), rad = (q) => Math.hypot(q.x - cen.x, q.z - cen.z);
            const inner = ring.reduce((a, q) => rad(q) < rad(a) ? q : a), dir = V(c.x - cen.x, 0, c.z - cen.z).normalize(), O = V(cen.x, inner.y, cen.z);
            let hit = 9; for (const tri of tris) { const s = segTri(O, dir, ...tri); if (s > 0 && s < hit && s < rad(inner) + 0.01) hit = s; }
            if (hit < 9) g = Math.max(g, rad(inner) - hit); }
          log.push(`  belt: its inner side at most ${(g * 1000).toFixed(1)} mm off the cloth under it`); if (g > 0.006) beltGap = Math.max(beltGap, g); } }
    }
  }
  let ok = true;
  log.push(`characters with cloth: ${nChars}, body points checked: ${nChk}`);
  if (!nChk) { ok = false; log.push('FAIL nothing measured (no cloth or body found)'); }
  if (worst.d > 0) { ok = false; log.push(`FAIL skin through cloth: ${(worst.d * 1000).toFixed(1)} mm (${worst.part} at ${worst.at}, t ${worst.t.toFixed(1)} s)`); }
  else log.push('  no body point outside the cloth that covers it');
  if (beltGap > 0.006) { ok = false; log.push(`FAIL belt floats ${(beltGap * 100).toFixed(1)} cm off the cloth`); }
  log.push(ok ? 'PASS' : 'FAIL'); return log.join('\n');
}, { DUR, STEP });
console.log(out); await b.close(); server.close();
