// Simulated rope probe (sim.js bakeRope; scenes set window._ROPE = { rope, radius, bodies(t), groundAt, held(t) } under
// ?dbg). Every frame (30 fps) of the clip:
//  1. no stretch: every segment within 3% of its rest length (a stretched rope reads as rubber)
//  2. never under the ground (more than 3 mm)
//  3. never through a body (legs, torso, feet capsules) by more than 5 mm, except the points in a holding hand's fist
// For hands on the rope run probe_grasp.mjs too (window._HOLDS).
// usage (from the engine folder): node probe_simrope.mjs <engine dir> <duration s>  -> PASS / FAIL
import { chromium } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.argv[2], DUR = Number(process.argv[3] || 5);
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': p.endsWith('.js') || p.endsWith('.mjs') ? 'text/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); res.end(d); }); }).listen(0);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const pg = await b.newPage({ viewport: { width: 90, height: 160 } });
pg.on('pageerror', e => console.log('ERR', e.message));
await pg.goto(`http://localhost:${server.address().port}/index.html?render=1&res=90&mb=1&noao&dbg`); await pg.waitForFunction(() => window.renderAt && window.ready);
const out = await pg.evaluate(async (DUR) => {
  window.renderAt(0); const R = window._ROPE; if (!R) return { ok: false, log: ['no window._ROPE'] };
  const log = []; let ok = true, stretch = 0, stAt = 0, under = 0, unAt = 0, inside = 0, inAt = '';
  for (let f = 0; f <= Math.floor(DUR * 30); f++) { const t = f / 30, P = R.rope.at(t), n = P.length, L = R.rope.L;
    for (let i = 0; i < n - 1; i++) { const e = Math.abs(P[i].distanceTo(P[i + 1]) - L) / L; if (e > stretch) { stretch = e; stAt = t; } }
    for (const p of P) { const u = R.groundAt(p.x, p.z) + R.radius - p.y; if (u > under) { under = u; unAt = t; } }
    const held = R.held(t).filter(([, h]) => h).map(([i]) => i);
    for (let i = 0; i < n; i++) { if (held.some(h => Math.abs(h - i) <= 1)) continue;
      for (const c of R.bodies(t)) { const ab = c.b.clone().sub(c.a), k = Math.max(0, Math.min(1, P[i].clone().sub(c.a).dot(ab) / ab.lengthSq()));
        const d = c.r + R.radius - P[i].distanceTo(c.a.clone().addScaledVector(ab, k)); if (d > inside) { inside = d; inAt = `${t.toFixed(2)} s point ${i}`; } } } }
  log.push(`stretch: at most ${(stretch * 100).toFixed(2)}% at ${stAt.toFixed(2)} s (want < 3%)`); if (stretch > 0.03) ok = false;
  log.push(`under the ground: at most ${(under * 1000).toFixed(1)} mm at ${unAt.toFixed(2)} s (want < 3)`); if (under > 0.003) ok = false;
  log.push(`into a body: at most ${(inside * 1000).toFixed(1)} mm (${inAt}) (want < 5)`); if (inside > 0.005) ok = false;
  return { ok, log };
}, DUR);
console.log(out.log.join('\n')); console.log(out.ok ? 'PASS' : 'FAIL'); await b.close(); server.close();
