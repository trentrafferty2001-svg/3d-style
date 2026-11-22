"""Kaggle GPU render worker for the style-v2 engine.
Runs inside a Kaggle notebook (GPU + internet enabled). Downloads a job zip from a public GitHub repo
(JOB_REPO, branch BRANCH, folder FOLDER), sets up three.js r169 and Playwright Chromium, finds browser flags that put WebGL on the
NVIDIA GPU (it refuses to render on SwiftShader), renders the frames, encodes, and muxes the job's mix at -14 LUFS.
Outputs land in /kaggle/working: <job>.mp4, gpu_check.json, log.txt.
Config: JOB (job zip name without .zip), BRANCH (default render-farm), FRAMES_FROM/FRAMES_TO (optional, a test slice)."""
import json, os, subprocess, sys, time, zipfile, urllib.request

JOB = os.environ.get('JOB', 'style-v2-shaduf-v4'); BRANCH = os.environ.get('BRANCH', 'render-farm')
OUT = '/kaggle/working'; W = '/kaggle/temp/w'; os.makedirs(W, exist_ok=True)
LOG = open(f'{OUT}/log.txt', 'a')
def log(*a):
    s = ' '.join(str(x) for x in a); print(s, flush=True); LOG.write(s + '\n'); LOG.flush()
def run(cmd, **kw):
    log('$', cmd); r = subprocess.run(cmd, shell=True, capture_output=True, text=True, **kw); log(r.stdout[-3000:], r.stderr[-3000:]); r.check_returncode(); return r

t0 = time.time()
run('nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv || true')
FOLDER = os.environ.get('FOLDER', 'kaggle')  # kaggle/ on the render-farm branch: unlike jobs/, it does not start the GitHub farm
JOB_REPO = os.environ.get('JOB_REPO', 'OWNER/REPO')  # GitHub repo holding the job zips (kaggle_job.py fills this in)
url = f'https://raw.githubusercontent.com/{JOB_REPO}/{BRANCH}/{FOLDER}/{JOB}.zip'
urllib.request.urlretrieve(url, f'{W}/job.zip'); zipfile.ZipFile(f'{W}/job.zip').extractall(W)
job = json.load(open(f'{W}/job.json')); E = f'{W}/engine'
run('git clone -q --depth 1 --branch r169 --filter=blob:none --sparse https://github.com/mrdoob/three.js.git /kaggle/temp/three && cd /kaggle/temp/three && git sparse-checkout set build examples/jsm/postprocessing examples/jsm/shaders examples/jsm/utils examples/jsm/geometries')
run(f'mkdir -p {E}/node_modules && ln -sfn /kaggle/temp/three {E}/node_modules/three')
run(f'cd {E} && npm init -y >/dev/null && npm i -s playwright@1.49 && npx playwright install --with-deps chromium >/dev/null 2>&1; echo ok')
run('apt-get -qq update && apt-get -qq install -y ffmpeg libvulkan1 libegl1 >/dev/null 2>&1; echo ok')  # no Mesa drivers: they win over NVIDIA's
# NVIDIA's userspace driver is mounted but not registered for Vulkan/EGL: find its libraries and write the loader files
run(r'ldconfig -p | grep -iE "libEGL_nvidia|libGLX_nvidia|libnvidia-glcore|libvulkan" ; ls /usr/share/vulkan/icd.d /etc/vulkan/icd.d /usr/share/glvnd/egl_vendor.d 2>&1; find / -xdev \( -name "libEGL_nvidia.so*" -o -name "libGLX_nvidia.so*" \) 2>/dev/null | head; echo ok')
def find_lib(name):
    r = subprocess.run(f'ldconfig -p | grep -m1 "{name}" | sed "s/.*=> //"', shell=True, capture_output=True, text=True).stdout.strip()
    if not r: r = subprocess.run(f'find / -xdev -name "{name}*" 2>/dev/null | head -1', shell=True, capture_output=True, text=True).stdout.strip()
    return r
glx, egl = find_lib('libGLX_nvidia.so.0'), find_lib('libEGL_nvidia.so.0')
log('nvidia libs:', glx or '-', egl or '-')
os.makedirs('/kaggle/temp/icd', exist_ok=True)
if glx: json.dump({'file_format_version': '1.0.0', 'ICD': {'library_path': glx, 'api_version': '1.3.0'}}, open('/kaggle/temp/icd/nvidia_icd.json', 'w'))
if egl: json.dump({'file_format_version': '1.0.0', 'ICD': {'library_path': egl}}, open('/kaggle/temp/icd/10_nvidia.json', 'w'))


# find GPU flags: render.mjs takes extra Chromium flags from GLFLAGS; a tiny probe page reports the WebGL renderer
probe = r"""
import { chromium } from 'playwright';
const flags = JSON.parse(process.argv[2]);
const b = await chromium.launch({ args: flags, headless: true }); const p = await b.newPage();
await p.setContent('<canvas id=c></canvas>');
const r = await p.evaluate(() => { const g = document.getElementById('c').getContext('webgl2'); if (!g) return 'no webgl2';
  const e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); });
console.log(r); await b.close();
"""
open(f'{E}/probe.mjs', 'w').write(probe)
VK = {'VK_ICD_FILENAMES': '/kaggle/temp/icd/nvidia_icd.json', 'VK_DRIVER_FILES': '/kaggle/temp/icd/nvidia_icd.json'}
EG = {'__EGL_VENDOR_LIBRARY_FILENAMES': '/kaggle/temp/icd/10_nvidia.json'}
CANDIDATES = [
    (['--use-angle=gl-egl', '--use-gl=angle', '--enable-gpu', '--ignore-gpu-blocklist'], EG),   # works on Kaggle T4 (Nov 2026)
    (['--use-angle=vulkan', '--enable-features=Vulkan', '--disable-vulkan-surface', '--enable-gpu', '--ignore-gpu-blocklist'], VK),
    (['--use-gl=egl', '--enable-gpu', '--ignore-gpu-blocklist'], EG),
    (['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--disable-vulkan-surface', '--enable-gpu', '--ignore-gpu-blocklist', '--headless=new'], VK),
]
found = None; results = []
found_env = {}
for c, cenv in CANDIDATES:
    try: r = subprocess.run(['node', 'probe.mjs', json.dumps(c)], cwd=E, capture_output=True, text=True, timeout=120, env=dict(os.environ, **cenv)); rend = (r.stdout.strip() or r.stderr.strip()[-300:])
    except Exception as ex: rend = f'error {ex}'
    results.append({'flags': c, 'env': cenv, 'renderer': rend}); log('flags', c, cenv, '->', rend)
    if any(k in rend for k in ('NVIDIA', 'Tesla', 'T4', 'P100')) and 'SwiftShader' not in rend and 'llvmpipe' not in rend: found, found_env = c, cenv; break
json.dump({'gpu': found is not None, 'tried': results}, open(f'{OUT}/gpu_check.json', 'w'), indent=1)
if not found: log('NO GPU WEBGL: refusing to render on a software renderer'); sys.exit(2)

# render through the engine's own render.mjs, with the GPU flags injected
src = open(f'{E}/render.mjs').read()
src = src.replace("const browser = await chromium.launch({ args: [...GL, '--ignore-gpu-blocklist'] });",
                  "const browser = await chromium.launch({ args: process.env.GLFLAGS ? JSON.parse(process.env.GLFLAGS) : [...GL, '--ignore-gpu-blocklist'] });")
open(f'{E}/render.mjs', 'w').write(src)
fps = job.get('fps', 30); N = job['frames']
a = int(os.environ.get('FRAMES_FROM', 0)); b = int(os.environ.get('FRAMES_TO', N))
# frames leave the browser as JPEG at quality 98 (v1.13): a full-HD PNG screenshot is far slower to encode, and at 98 the
# frame is visually lossless (about 50 dB PSNR) before x264 compresses it anyway. A job can ask for PNG with "jpeg": 0.
JPEG = str(job.get('jpeg', 98))
env = dict(os.environ, GLFLAGS=json.dumps(found), RES='1080', CRF='10', PRESET='fast', **({'JPEG': JPEG} if JPEG != '0' else {}), **found_env)
t1 = time.time()
P = int(os.environ.get('PARTS', 2))  # parallel render processes (the machine has 2 GPUs and several CPU cores)
cuts = [a + (b - a) * k // P for k in range(P + 1)]
procs = [subprocess.Popen(f'cd {E} && node render.mjs video {W}/part{k}.mp4 {fps} {cuts[k] / fps} {cuts[k + 1] / fps + 0.0001} > {W}/part{k}.log 2>&1', shell=True, env=env) for k in range(P)]
codes = [p.wait() for p in procs]; log('part exit codes', codes)
for k in range(P): log(open(f'{W}/part{k}.log').read()[-400:])
assert all(c == 0 for c in codes), 'a render part failed'
open(f'{W}/list.txt', 'w').write(''.join(f"file '{W}/part{k}.mp4'\n" for k in range(P)))
run(f'ffmpeg -v error -y -f concat -safe 0 -i {W}/list.txt -c copy {W}/master.mp4')
run(f'ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 {W}/master.mp4')
dt = time.time() - t1; log(f'RENDERED {b - a} frames in {dt:.0f} s = {dt / max(1, b - a):.2f} s/frame')
run(f'ffmpeg -v error -y -i {W}/master.mp4 -c:v libx264 -preset slow -crf 15 -maxrate 12M -bufsize 24M -profile:v high -pix_fmt yuv420p -movflags +faststart {W}/video.mp4')
mix = (job.get('mixes') or {}).get('')
if mix and a == 0 and b == N:
    run(f'ffmpeg -v error -y -i {W}/video.mp4 -i {W}/{mix} -map 0:v -map 1:a -c:v copy -af apad,loudnorm=I=-14:TP=-1.5:LRA=11 -ar 44100 -c:a aac -b:a 192k -shortest -movflags +faststart {OUT}/{JOB}.mp4')
else:
    run(f'cp {W}/video.mp4 {OUT}/{JOB}_frames_{a}_{b}.mp4')
log(f'DONE in {time.time() - t0:.0f} s total')
