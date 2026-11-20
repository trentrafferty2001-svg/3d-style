"""Render a render-farm job on Kaggle's free GPU and download the finished MP4.
usage: KAGGLE_OWNER=<kaggle username> JOB_REPO=<github owner/repo> KAGGLE_API_TOKEN=proxy-injected \
       python3 -I kaggle_job.py <job-name> [out_dir]
The job zip must already be in the public repo JOB_REPO, branch render-farm (or BRANCH), as kaggle/<job-name>.zip.
(In the farm repo the kaggle/ folder does not start the GitHub farm; jobs/ does.) Needs the Kaggle API token saved as a bearer network secret for the Kaggle API host (the proxy
replaces the placeholder). Prints the GPU it used, the timings and the output path."""
import json, os, shutil, sys, time
from kaggle.api.kaggle_api_extended import KaggleApi

job = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else f'/home/claude/kaggle_renders/{job}'
here = os.path.dirname(os.path.abspath(__file__))
work = f'/tmp/kaggle_push_{job}'
shutil.rmtree(work, ignore_errors=True); os.makedirs(work); os.makedirs(out, exist_ok=True)

# the worker script, with this job's name baked in (Kaggle script kernels take no arguments)
import re
src = open(f'{here}/render_kaggle.py').read()
src, n = re.subn(r"JOB = os\.environ\.get\('JOB', '[^']*'\)", f"JOB = os.environ.get('JOB', {job!r})", src, count=1)
assert n == 1, 'could not set the job name in render_kaggle.py'
owner = os.environ.get('KAGGLE_OWNER'); job_repo = os.environ.get('JOB_REPO')
if not owner or not job_repo: sys.exit('set KAGGLE_OWNER (your Kaggle username) and JOB_REPO (GitHub owner/repo with the job zips)')
src, n2 = re.subn(r"JOB_REPO = os\.environ\.get\('JOB_REPO', '[^']*'\)", f"JOB_REPO = os.environ.get('JOB_REPO', {job_repo!r})", src, count=1)
assert n2 == 1, 'could not set JOB_REPO in render_kaggle.py'
if os.environ.get('BRANCH'): src = src.replace("BRANCH = os.environ.get('BRANCH', 'render-farm')", f"BRANCH = os.environ.get('BRANCH', {os.environ['BRANCH']!r})")
open(f'{work}/render_kaggle.py', 'w').write(src)  # only the JOB value changes; BRANCH etc. on the same line stay

api = KaggleApi()
# The SDK's login check sends the token in the request body, which the proxy cannot fill in; the real API calls send
# it in the Authorization header, which the proxy does replace. So skip the body check.
api._introspect_token = lambda tok: 'proxy'
api.authenticate()

slug = 'style-v2-render'
meta = {'id': f'{owner}/{slug}', 'title': slug, 'code_file': 'render_kaggle.py', 'language': 'python',
        'kernel_type': 'script', 'is_private': True, 'enable_gpu': True, 'enable_internet': True,
        'machine_shape': 'NvidiaTeslaT4', 'dataset_sources': [], 'competition_sources': [], 'kernel_sources': []}
json.dump(meta, open(f'{work}/kernel-metadata.json', 'w'), indent=1)
r = api.kernels_push(work)
print('pushed', getattr(r, 'ref', None), 'version', getattr(r, 'version_number', None), getattr(r, 'error', '') or '', flush=True)

ref = meta['id']; last = None; t0 = time.time()
while True:
    s = str(getattr(api.kernels_status(ref), 'status', '?'))
    if s != last: print(time.strftime('%H:%M:%S'), s, flush=True); last = s
    if any(k in s.lower() for k in ('complete', 'error', 'cancel')): break
    if time.time() - t0 > 3 * 3600: print('gave up waiting after 3 h'); break
    time.sleep(30)

api.kernels_output(ref, path=out)
log = open(f'{out}/log.txt').read() if os.path.exists(f'{out}/log.txt') else ''
for line in log.splitlines():
    if any(k in line for k in ('Tesla', 'RENDERED', 'DONE', 'refusing', 'exit codes')): print(line)
mp4 = f'{out}/{job}.mp4'
print('OUTPUT', mp4 if os.path.exists(mp4) else 'missing (see log.txt)')
