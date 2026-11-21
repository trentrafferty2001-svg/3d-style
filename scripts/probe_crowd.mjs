// Crowd probe (every character in window._FS, the set in window._SITE, under ?dbg). Over the clip at 30 fps:
//  1. no foot skating: a foot on the ground (sole within 1.5 cm of it) in two frames running moves less than 3 mm
//     between them (a planted foot that slides reads as ice; skating feet also sweep through anything on the ground)
//  2. no two people overlap: torsos and heads keep at least 2 cm apart
//  3. every sole stays on or above the ground (no feet sunk more than 2 cm)
// usage (from the engine folder): node probe_crowd.mjs <engine dir> <duration s>  -> PASS / FAIL
import { chromium } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.argv[2], DUR = Number(process.argv[3] || 5);
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': p.endsWith('.js') || p.endsWith('.mjs') ? 'text/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); res.end(d); }); }).listen(0);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const pg = await b.newPage({ viewport: { width: 90, height: 160 } });
pg.on('pageerror', e => console.log('ERR', e.message));
await pg.goto(`http://localhost:${server.address().port}/index.html?render=1&res=90&mb=1&noao&dbg`); await pg.waitForFunction(() => window.renderAt && window.ready);
const out = await pg.evaluate(async (DUR) => {
  const THREE = await import('three'); const V = THREE.Vector3, log = []; let ok = true;
  const segDist = (p1, q1, p2, q2) => { const d1 = q1.clone().sub(p1), d2 = q2.clone().sub(p2), r = p1.clone().sub(p2), a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r), c = d1.dot(r), bb = d1.dot(d2), den = a * e - bb * bb;
    let s = den > 1e-12 ? Math.min(1, Math.max(0, (bb * f - c * e) / den)) : 0, t = (bb * s + f) / e;
    if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (bb - c) / a)); }
    return p1.clone().addScaledVector(d1, s).distanceTo(p2.clone().addScaledVector(d2, t)); };
  let skate = 0, skAt = '', overlap = 1e9, ovAt = '', sink = 0, siAt = '', prev = null, nChars = 0;
  for (let f = 0; f <= Math.floor(DUR * 30); f++) { const t = f / 30; window.renderAt(t);
    const FS = window._FS || [], S = window._SITE, G = S.userData.groundAt || S.userData.heightAt; nChars = Math.max(nChars, FS.length);
    const now = FS.map((F, ci) => ['l', 'r'].map(s => { const a = F.bones[s + 'An'].getWorldPosition(new V()), k = F.size || F.root.scale.x || 1; return { a, h: a.y - 0.075 * k - G(a.x, a.z), ci, s }; }));
    for (const feet of now) for (const ft of feet) { if (-ft.h > sink) { sink = -ft.h; siAt = `${t.toFixed(2)} s character ${ft.ci} ${ft.s}`; } }
    if (prev) for (let ci = 0; ci < now.length; ci++) for (let j = 0; j < 2; j++) { const a = now[ci][j], p = prev[ci] && prev[ci][j]; if (!p) continue;
      if (a.h < 0.015 && p.h < 0.015) { const m = Math.hypot(a.a.x - p.a.x, a.a.z - p.a.z); if (m > skate) { skate = m; skAt = `${t.toFixed(2)} s character ${ci} ${a.s}`; } } }
    prev = now;
    const caps = FS.map(F => { const k = F.size || F.root.scale.x || 1, bp = (n) => F.bones[n].getWorldPosition(new V());
      return [{ a: bp('hips'), b: bp('neck'), r: 0.15 * k }, { a: bp('head'), b: bp('head'), r: 0.13 * k }]; });
    for (let i = 0; i < caps.length; i++) for (let j = i + 1; j < caps.length; j++) for (const c1 of caps[i]) for (const c2 of caps[j]) {
      const g = segDist(c1.a, c1.b, c2.a, c2.b) - c1.r - c2.r; if (g < overlap) { overlap = g; ovAt = `${t.toFixed(2)} s characters ${i} and ${j}`; } } }
  log.push(`${nChars} characters`);
  log.push(`foot skating: a planted foot moved at most ${(skate * 1000).toFixed(1)} mm in a frame (${skAt}) (want < 3)`); if (skate > 0.003) ok = false;
  log.push(`closest two people: ${overlap > 1e8 ? 'n/a' : (overlap * 100).toFixed(1) + ' cm'} (${ovAt}) (want > 2 cm)`); if (overlap < 0.02) ok = false;
  log.push(`deepest sole under the ground: ${(sink * 100).toFixed(1)} cm (${siAt}) (want < 2)`); if (sink > 0.02) ok = false;
  return { ok, log };
}, DUR);
console.log(out.log.join('\n')); console.log(out.ok ? 'PASS' : 'FAIL'); await b.close(); server.close();
