// Lip-sync probe (any scene that sets window._F and window._TALK under ?dbg and imports a vo_X.js with "phones"):
//  1. lips shut: at the middle of every m / b / p the mouth gap is under 1.5 mm
//  2. f / v: the lower lip tucks (gap under 3 mm) with the top teeth showing
//  3. open vowels (ɑ a æ I W ɔ, long enough to see) open past 6 mm
//  4. rounded sounds (u w O) make the mouth narrower than at rest
//  5. silence: shut before the line and after it ends
//  6. every m / b / p is seen shut on at least two 30 fps frames (shorter closures flash past unseen)
//  7. no snaps: the gap never changes by more than two thirds of the line's widest opening between two 30 fps frames
//     (lips may close over a single frame on m/b/p, as in real speech; a full open-to-shut flip reads as a glitch)
// usage (from the engine folder): node probe_lips.mjs <engine dir> <vo module, e.g. src/vo_lp.js>  -> PASS / FAIL
import { chromium } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.argv[2], VOMOD = process.argv[3];
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': p.endsWith('.js') || p.endsWith('.mjs') ? 'text/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); res.end(d); }); }).listen(0);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const pg = await b.newPage({ viewport: { width: 90, height: 160 } });
pg.on('pageerror', e => console.log('ERR', e.message));
await pg.goto(`http://localhost:${server.address().port}/index.html?render=1&res=90&mb=1&noao&dbg`); await pg.waitForFunction(() => window.renderAt && window.ready);
const out = await pg.evaluate(async (vomod) => {
  const { VO } = await import('/' + vomod); const log = []; let ok = true; window.renderAt(0.02);
  // the face is updated by the scene: render the frame (cheap at 90 px) and read the mouth it drew
  const at = (t) => { window.renderAt(t); const F = window._F; return { gap: F.mouthGap, w: F.mouthW }; }; // _F is rebuilt per shot
  const rest = at(0.02);
  const fail = (m) => { ok = false; log.push('FAIL ' + m); };
  let nP = 0, nF = 0, nV = 0, nR = 0, worstP = 0, worstF = 0, worstV = 1, worstR = 0;
  for (const L of VO) for (const [s, a, e] of L.phones) {
    const lead = window._TALK ? window._TALK.lead : 0.04, at0 = L.audioAt ?? L.start, mid = at0 + (a + e) / 2 - lead, m = at(mid); // the lips lead the sound
    if ('mbp'.includes(s)) { nP++; worstP = Math.max(worstP, m.gap); if (m.gap > 0.0015) fail(`${s} at ${mid.toFixed(2)} s: lips ${(m.gap * 1000).toFixed(1)} mm apart`); }
    if ('fv'.includes(s)) { nF++; worstF = Math.max(worstF, m.gap); if (m.gap > 0.003) fail(`${s} at ${mid.toFixed(2)} s: gap ${(m.gap * 1000).toFixed(1)} mm`); }
    if ('ɑaæIWɔ'.includes(s) && e - a >= 0.06) { nV++; worstV = Math.min(worstV, m.gap); if (m.gap < 0.006) fail(`${s} at ${mid.toFixed(2)} s: only ${(m.gap * 1000).toFixed(1)} mm open`); }
    if ('uwO'.includes(s) && e - a >= 0.05) { nR++; worstR = Math.max(worstR, m.w / rest.w); log.push(`  rounded ${s} at ${mid.toFixed(2)} s: ${(m.w / rest.w * 100).toFixed(0)}% of rest`); if (m.w > rest.w * 0.97) fail(`${s} at ${mid.toFixed(2)} s: not rounded (width ${(m.w / rest.w * 100).toFixed(0)}% of rest)`); }
  }
  log.push(`m/b/p: ${nP}, widest ${(worstP * 1000).toFixed(2)} mm (want < 1.5)`);
  log.push(`f/v: ${nF}, widest ${(worstF * 1000).toFixed(2)} mm (want < 3)`);
  log.push(`open vowels: ${nV}, smallest ${(worstV * 1000).toFixed(1)} mm (want > 6)`);
  log.push(`rounded: ${nR}, widest ${(worstR * 100).toFixed(0)}% of the resting width (want < 97%)`);
  // closures seen on frames: for each m/b/p, the 30 fps frames inside [start - lead - 40 ms, end - lead + 40 ms] that are shut
  let fewest = 99, fewAt = 0;
  for (const L of VO) for (const [s, a, e] of L.phones) { if (!'mbp'.includes(s)) continue; const lead = window._TALK ? window._TALK.lead : 0.04;
    let n = 0; const at0 = L.audioAt ?? L.start; for (let f = Math.ceil((at0 + a - lead - 0.04) * 30); f <= Math.floor((at0 + e - lead + 0.04) * 30); f++) if (at(f / 30).gap < 0.0015) n++;
    if (n < fewest) { fewest = n; fewAt = at0 + a; } }
  log.push(`m/b/p seen shut on at least ${fewest} frames (want >= 2; fewest at ${fewAt.toFixed(2)} s)`); if (fewest < 2) fail('a closure flashes past');
  const A = (L) => L.audioAt ?? L.start, first = A(VO[0]) + VO[0].phones[0][1], last = A(VO.at(-1)) + VO.at(-1).phones.at(-1)[2];
  const before = at(Math.max(0, first - 0.25)).gap, after = at(last + 0.35).gap;
  log.push(`silence: ${(before * 1000).toFixed(2)} mm before, ${(after * 1000).toFixed(2)} mm after (want < 1)`); if (before > 0.001 || after > 0.001) fail('mouth open in silence');
  let jump = 0, jt = 0, prev = null, top = 0; for (let t = first - 0.2; t < last + 0.3; t += 1 / 30) { const g = at(t).gap; top = Math.max(top, g); if (prev != null && Math.abs(g - prev) > jump) { jump = Math.abs(g - prev); jt = t; } prev = g; }
  log.push(`largest frame-to-frame change: ${(jump * 1000).toFixed(1)} mm at ${jt.toFixed(2)} s (want < ${(top * 667).toFixed(1)}, two thirds of the widest ${(top * 1000).toFixed(1)} mm)`); if (jump > top * 2 / 3) fail('mouth snaps');
  return { ok, log };
}, VOMOD);
console.log(out.log.join('\n')); console.log(out.ok ? 'PASS' : 'FAIL'); await b.close(); server.close();
