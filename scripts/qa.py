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
  lipTracks   probe_lips.mjs with the scene's vo_X.js (closures, openings, rounding, silence)
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
dur = float(re.search(r'export const DURATION\s*=\s*([\d.]+)', SRC).group(1))
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
