# Kaggle GPU renderer (free)

Renders a style-v2 job on a free Kaggle T4 GPU. Tested 20 Nov 2026 with the shaduf demo:
**225 frames at 1080p, 6 motion-blur sub-frames, in 174 s (0.77 s a frame, 2 parallel parts); about 5 minutes in all**
against 31 minutes on the 20-runner GitHub farm. Frames match the farm's (mean difference under 1/255), the pop scan
and `earshot critique` pass.

## Use
1. Build the job zip as for the farm (`mkjob.sh`, with `"fps": 30`) and push it to **`kaggle/`** on the `render-farm`
   branch of the-ai-frontier-media. Do not put it in `jobs/`: a push there starts the GitHub farm. Move it to `jobs/`
   only if Kaggle fails or the weekly GPU quota is used up.
2. `KAGGLE_OWNER=<kaggle username> JOB_REPO=<github owner/repo> KAGGLE_API_TOKEN=proxy-injected python3 -I kaggle/kaggle_job.py <job-name>`
   (needs `pip install kaggle`). For The Ai Frontier channels JOB_REPO is the render-farm repo (`the-ai-frontier-media`).
   It pushes a private notebook to the owner's Kaggle account, waits, downloads `<job-name>.mp4` to
   `/home/claude/kaggle_renders/<job-name>/`, and prints the GPU it used and the timings.
3. Publish the MP4 the usual way (render-out branch / release) and run the normal QA.

## Limits and notes
- Kaggle's free GPU allowance on this account is **6 hours a week** (resets Saturday 00:00 UTC). A 45 s video at
  6 sub-frames is about 20 minutes, so roughly 15 videos a week. When the quota runs out, use the GitHub farm.
- The token is a new-style Kaggle API token (`KGAT_`), saved as a **bearer** network secret for the Kaggle API host.
- `render_kaggle.py` finds NVIDIA's EGL driver (mounted but not registered in Kaggle's container), writes the loader
  file, and launches Chromium with `--use-angle=gl-egl`. It refuses to render on a software renderer.
- Do not install Mesa drivers in the notebook: they take priority over NVIDIA's.
