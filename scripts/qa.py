#!/usr/bin/env python3
"""One-command QA (backlog item 10): runs every check in STYLE.md that applies to a shot file and prints PASS/FAIL,
so no check is skipped.

usage: python3 -I scripts/qa.py <shots file, e.g. shots_rp.js> <out dir> [--impacts s,s,...] [--quick]
  (run from the repo root; the engine is copied to <out dir>/engine with main.js pointed at the shot file)

Checks, chosen from what the shot file sets up under ?dbg:
  always      swallow scan (code hidden after a // comment), 360p preview + pop scan (cuts read from SHOTS),
              stills every 0.25 s + contact sheets, no-DOF stills + sparkle scan
  _SITE       probe_rome.mjs (props and plants on the ground, soles, palms vs cloth)
  _HOLDS      probe_grasp.mjs (fingers on ropes, handles, tools; wrist; reach)
  _ROPE       probe_simrope.mjs (simulated rope: stretch, ground, bodies)
  crowd.js    probe_crowd.mjs (foot skating, people overlapping, feet in the ground)
  characters  probe_cloth.mjs (no skin through the tunic or kilt, the belt on the cloth), probe_hair.mjs (hats, beards
              clear of the mouth, braids clear of the body)
  lipTracks   probe_lips.mjs with the scene's vo_X.js (closures, openings, rounding, silence)
  shaduf      the demo's own probes: probe_qa, probe_rope, probe_bucket_body, probe_feet, probe_hands
--quick skips the stills and the preview (probes and scans only). Sound (earshot) runs on the final MP4, not here.
Env: THREE_DIR (default /home/claude/deps/three), PLAYWRIGHT_DIR (default: npm root -g + /playwright)."""
import os, re, shutil, subprocess, sys

args = [a for a in sys.argv[1:] if not a.startswith('--')]
if len(args) < 2: sys.exit(__doc__)
shot, out = args[0], os.path.abspath(args[1])
quick = '--quick' in sys.argv
impacts = sys.argv[sys.argv.index('--impacts') + 1] if '--impacts' in sys.argv else ''
if impacts in args: args.remove(impacts)
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = open(os.path.join(REPO, 'engine', 'src', shot), encoding='utf-8').read()
three = os.environ.get('THREE_DIR', '/home/claude/deps/three')
pw = os.environ.get('PLAYWRIGHT_DIR') or os.path.join(subprocess.run(['npm', 'root', '-g'], capture_output=True, text=True).stdout.strip(), 'playwright')

# the scene's length and cuts: DURATION, and every shot's start after the first
_dm = re.search(r'export const DURATION\s*=\s*([\d.]+)\s*;', SRC); dur = float(_dm.group(1)) if _dm else None   # else asked from the page below
consts = {k: v for k, v in re.findall(r'(?:const|let)\s+(\w+)\s*=\s*([\w.]+\s*(?:/\s*[\d.]+)?)\s*[;,]', SRC)}
for _ in range(4):                                             # follow aliases (const CUT = T_LET)
    consts = {k: consts.get(v.strip(), v) for k, v in consts.items()}
def num(x):
    x = x.strip(); x = consts.get(x, x)
    try: return float(eval(x, {'__builtins__': {}}))   # numbers and a / b only (from the regex above)
    except Exception: return None
cuts = sorted({c for c in (num(m) for m in re.findall(r'\{\s*start:\s*([\w.\s/]+?),', SRC)) if c})

eng = os.path.join(out, 'engine'); os.makedirs(out, exist_ok=True)
shutil.rmtree(eng, ignore_errors=True); shutil.copytree(os.path.join(REPO, 'engine'), eng, ignore=shutil.ignore_patterns('node_modules'))
os.makedirs(os.path.join(eng, 'node_modules'), exist_ok=True)
os.symlink(three, os.path.join(eng, 'node_modules', 'three')); os.symlink(pw, os.path.join(eng, 'node_modules', 'playwright'))
for f in os.listdir(os.path.join(REPO, 'scripts')):
    if f.endswith('.mjs'): shutil.copy(os.path.join(REPO, 'scripts', f), eng)
main = os.path.join(eng, 'src', 'main.js'); m = open(main).read()
open(main, 'w').write(re.sub(r"from '\./shots_\w+\.js'", f"from './{shot}'", m))

if dur is None or not cuts:   # DURATION or the cut times are formulas (the shaduf demo): ask the page
    probe = os.path.join(eng, '_duration.mjs')
    open(probe, 'w').write("""import { chromium } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.argv[2]; const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'text/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); res.end(d); }); }).listen(0);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const pg = await b.newPage({ viewport: { width: 90, height: 160 } });
await pg.goto(`http://localhost:${server.address().port}/index.html?render=1&res=90&mb=1&noao`); await pg.waitForFunction(() => window.renderAt && window.ready);
console.log(JSON.stringify(await pg.evaluate(() => [window.DURATION, window.CUTS || []]))); await b.close(); server.close();""")
    import json as _json
    _d, _c = _json.loads(subprocess.run(['node', '_duration.mjs', '.'], cwd=eng, capture_output=True, text=True, timeout=600).stdout.strip().splitlines()[-1])
    dur = dur or float(_d); cuts = cuts or sorted(float(c) for c in _c)
results = []
def run(name, cmd, ok, cwd=eng, timeout=3600, env=None):
    print(f'-- {name}', flush=True)
    try: r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout, env={**os.environ, 'GL': 'swiftshader', **(env or {})})
    except subprocess.TimeoutExpired: results.append((name, False, 'timed out')); return ''
    txt = (r.stdout + r.stderr).strip(); good = r.returncode == 0 and ok(txt)
    results.append((name, good, txt.splitlines()[-1] if txt else '')); open(os.path.join(out, name.replace(' ', '_') + '.txt'), 'w').write(txt)
    return txt
PY = [sys.executable, '-I']; S = os.path.join(REPO, 'scripts')
last_pass = lambda t: t.strip().splitlines()[-1].strip().startswith('PASS') or t.strip().endswith('PASS')

run('swallow scan', PY + [os.path.join(S, 'swallow_scan.py'), os.path.join(REPO, 'engine', 'src'), S], lambda t: 'PASS' in t.splitlines()[-1], cwd=REPO)
if '_SITE' in SRC: run('probe rome', ['node', 'probe_rome.mjs', '.'], last_pass)
if '_HOLDS' in SRC: run('probe grasp', ['node', 'probe_grasp.mjs', '.', str(dur)], last_pass)
if '_ROPE' in SRC: run('probe simrope', ['node', 'probe_simrope.mjs', '.', str(dur)], last_pass)
if "from './crowd.js'" in SRC or 'walk(' in SRC: run('probe crowd', ['node', 'probe_crowd.mjs', '.', str(dur)], last_pass)
if re.search(r"\b(toon|extra|\w+Worker\d?|paddyFarmer|farmer2)\(", SRC):   # anyone in a tunic or kilt (v1.14)
    run('probe cloth', ['node', 'probe_cloth.mjs', '.', str(dur), '0.1'], last_pass)
    run('probe hair', ['node', 'probe_hair.mjs', '.', str(dur), '0.1'], last_pass)
if 'shaduf' in SRC.lower():   # the shaduf demo's own probes (STYLE.md QA table)
    def qa_ok(t):
        f = re.search(r'sole bottom vs platform top ranges ([-\d.]+) \.\. ([-\d.]+)', t); nums = [float(x) for x in re.findall(r'min ([-\d.]+) m', t)]
        return bool(f) and -0.02 <= float(f.group(1)) and float(f.group(2)) <= 0.02 and nums and min(nums) > 0
    run('probe qa (feet on the platform, bucket, hand-head and counterweight clearances)', ['node', 'probe_qa.mjs', '.'], qa_ok)
    run('probe rope (rope meets bail and pole tip)', ['node', 'probe_rope.mjs', '.'], last_pass)
    run('probe bucket body (nothing of him inside the bucket)', ['node', 'probe_bucket_body.mjs', '.'], lambda t: 'no body part inside' in t)
    run('probe feet (ankles on target)', ['node', 'probe_feet.mjs', '.'], lambda t: 'all ankles on target' in t)
    run('probe hands (hands on the rope, within reach)', ['node', 'probe_hands.mjs', '.', ','.join(f'{x * 0.05:.2f}' for x in range(int(dur * 20)))], lambda t: 'PASS' in t.strip().splitlines()[-1], timeout=5400)
vo = re.search(r"from '\./(vo_\w+\.js)'", SRC)
if 'lipTracks' in SRC and vo: run('probe lips', ['node', 'probe_lips.mjs', '.', 'src/' + vo.group(1)], last_pass)
if not quick:
    T = ','.join(f'{x / 4:.2f}' for x in range(0, int(dur * 4) + 1) if x / 4 < dur)
    run('stills', ['node', 'render.mjs', 'stills', T, os.path.join(out, 'stills')], lambda t: True, timeout=5400, env={'RES': '720', 'QS': 'mb=1'})
    subprocess.run(PY + [os.path.join(S, 'sheet.py'), os.path.join(out, 'stills')], capture_output=True)
    run('stills nodof', ['node', 'render.mjs', 'stills', T, os.path.join(out, 'nodof')], lambda t: True, timeout=5400, env={'RES': '720', 'QS': 'mb=1&nodof'})
    sp = run('sparkle scan', PY + [os.path.join(S, 'sparkle_scan.py'), os.path.join(out, 'nodof')], lambda t: 'PASS' in t.splitlines()[-1])
    if sp and 'FAIL' in sp.splitlines()[-1]:
        # a shading blow-up stays when supersampled; edge aliasing (a low sun grazing a rim or pebbles) averages away at the
        # 3 sub-frames every final frame gets (adaptive motion blur's minimum): re-render the flagged stills that way
        flagged = ','.join(sorted({m for m in re.findall(r't_([\d.]+)\.png:', sp)}, key=float))
        results.pop()
        mbmin = re.search(r'mbMin:\s*(\d+)', SRC); mbmin = mbmin.group(1) if mbmin else '3'   # the fewest sub-frames a final frame gets
        run('stills nodof mb' + mbmin, ['node', 'render.mjs', 'stills', flagged, os.path.join(out, 'nodof_mb3')], lambda t: True, timeout=5400, env={'RES': '720', 'QS': f'mb={mbmin}&nodof&mbfixed'})
        run(f'sparkle scan (flagged stills at {mbmin} sub-frames: aliasing clears, blow-ups stay)', PY + [os.path.join(S, 'sparkle_scan.py'), os.path.join(out, 'nodof_mb3')], lambda t: 'PASS' in t.splitlines()[-1])
    run('preview 360p', ['node', 'render.mjs', 'video', os.path.join(out, 'preview_360.mp4'), '30'], lambda t: True, timeout=5400, env={'RES': '360', 'QS': 'mb=1', 'JPEG': '95'})   # JPEG frames: far faster than PNG screenshots
    pop = PY + [os.path.join(S, 'pop_scan.py'), os.path.join(out, 'preview_360.mp4'), ','.join(f'{c:.4f}' for c in cuts)] + (['--impacts', impacts] if impacts else [])
    run('pop scan', pop, lambda t: t.strip().splitlines()[-1].startswith('PASS'))

print('\n== QA for', shot, f'({dur} s, cuts {", ".join(f"{c:.3f}" for c in cuts) or "none"})')
for name, good, line in results: print(f'{"PASS" if good else "FAIL"}  {name}: {line}')
allok = all(g for _, g, _ in results)
if not quick: print(f'Now look at every still: {os.path.join(out, "stills")}/sheet*.jpg (and zoom on faces, hands and edges).')
print('ALL PASS' if allok else 'FAIL'); sys.exit(0 if allok else 1)
