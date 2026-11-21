// Grip probe (any scene that, under ?dbg, sets window._HOLDS = [{ F, s, cyl: { a, b, r } }] each frame for every hand
// holding a rope, handle or tool, placed with F.hold() or F.grasp()). Over the clip, every 0.05 s:
//  1. contact: at least 3 of the 5 fingers (thumb included) touch the surface (gap under 5 mm)
//  2. no finger sinks into it by more than 3 mm (skin may press a little)
//  3. the palm is on it: the palm's centre within 4.5 cm of the surface (the grip lies across the base of the fingers,
//     ~3.3 cm from the palm's centre by design) and its skin not inside it
//  4. the wrist bends less than 75 degrees
//  5. the arm reaches: the wrist target is within the arm's length (F.reachShort)
// usage (from the engine folder): node probe_grasp.mjs <engine dir> [duration s]  -> PASS / FAIL
import { chromium } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.argv[2], DUR = Number(process.argv[3] || 0);
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': p.endsWith('.js') || p.endsWith('.mjs') ? 'text/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); res.end(d); }); }).listen(0);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const pg = await b.newPage({ viewport: { width: 90, height: 160 } });
pg.on('pageerror', e => console.log('ERR', e.message));
await pg.goto(`http://localhost:${server.address().port}/index.html?render=1&res=90&mb=1&noao&dbg`); await pg.waitForFunction(() => window.renderAt && window.ready);
const out = await pg.evaluate(async (DUR) => {
  const THREE = await import('three'); const V = THREE.Vector3;
  const segDist = (p1, q1, p2, q2) => { const d1 = q1.clone().sub(p1), d2 = q2.clone().sub(p2), r = p1.clone().sub(p2), a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r), c = d1.dot(r), bb = d1.dot(d2), den = a * e - bb * bb;
    let s = den > 1e-12 ? Math.min(1, Math.max(0, (bb * f - c * e) / den)) : 0, t = (bb * s + f) / e;
    if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (bb - c) / a)); }
    return p1.clone().addScaledVector(d1, s).distanceTo(p2.clone().addScaledVector(d2, t)); };
  const dur = DUR || window.DURATION || 5; const log = []; let ok = true;
  let fewest = 9, fewAt = 0, sink = 0, sinkAt = 0, palmFar = 0, palmIn = 0, bend = 0, bendAt = 0, n = 0;
  for (let t = 0; t < dur - 1e-6; t += 0.05) {
    window.renderAt(t); const H = window._HOLDS || []; if (!H.length) continue;
    for (const h of H) { n++; const { F, s, cyl } = h, R = cyl.r;
      const lines = F.fingerLines(s); let touching = 0;
      for (const f of lines) { let g = 1e9; for (const [p, q, r] of f) g = Math.min(g, segDist(p, q, cyl.a, cyl.b) - R - r);
        if (g < 0.005) touching++; if (-g > sink) { sink = -g; sinkAt = t + ` ${s} finger ${lines.indexOf(f)}`; } }
      if (touching < fewest) { fewest = touching; fewAt = t; }
      const palm = F.bones[s + 'Wr'].localToWorld(new V(0, -0.055, 0)), pg = segDist(palm, palm, cyl.a, cyl.b) - R;
      if (pg > palmFar) { palmFar = pg; window._pfAt = t + ' ' + s; } if (pg < 0.012) palmIn = Math.max(palmIn, 0.012 - pg);  // the palm's skin is ~1.7-2 cm from its centre
      const short = (F.reachShort && F.reachShort[s]) || 0; if (short > (window._short || 0)) { window._short = short; window._shortAt = t + ' ' + s; }
      const wb = F.wristBend(s); if (wb > bend) { bend = wb; bendAt = t; }
    } }
  if (!n) return { ok: false, log: ['no holds found (window._HOLDS)'] };
  log.push(`${n} hand-frames checked`);
  log.push(`fingers touching: at least ${fewest} of 5 (want >= 3; fewest at ${fewAt.toFixed(2)} s)`); if (fewest < 3) ok = false;
  log.push(`deepest finger in the surface: ${(sink * 1000).toFixed(1)} mm at ${typeof sinkAt === 'number' ? sinkAt.toFixed(2) : sinkAt} s (want < 3; finger 4 = thumb)`); if (sink > 0.003) ok = false;
  log.push(`palm centre to surface: at most ${(palmFar * 100).toFixed(1)} cm (${window._pfAt}) (want < 4.5); palm skin inside it by ${(palmIn * 1000).toFixed(1)} mm (want < 3)`); if (palmFar > 0.045 || palmIn > 0.003) ok = false;
  log.push(`arm too short by at most ${((window._short || 0) * 100).toFixed(1)} cm ${window._shortAt || ''} (want 0)`); if ((window._short || 0) > 0.002) ok = false;
  log.push(`largest wrist bend: ${(bend * 180 / Math.PI).toFixed(0)} deg at ${bendAt.toFixed(2)} s (want < 75)`); if (bend > 75 * Math.PI / 180) ok = false;
  return { ok, log };
}, DUR);
console.log(out.log.join('\n')); console.log(out.ok ? 'PASS' : 'FAIL'); await b.close(); server.close();
