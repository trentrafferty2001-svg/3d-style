# 3d-style

A code-built 3D cartoon style for short vertical explainer videos (1080×1920, 30 fps): a smooth skinned character with
a face rig, detailed sets, real motion blur, physically driven secondary motion and a QA kit. It is rendered with
three.js in headless Chromium, on a free Kaggle GPU (about 20 minutes per 45 s video) or on CPU runners.

The reference is the shaduf demo (`engine/src/shots_dm.js`, 7.5 s): a farmer hauls a bucket into the Nile, lets go, and
the mud counterweight lifts it.

| Folder | What |
|---|---|
| `engine/` | The renderer: `index.html`, `render.mjs` (headless Chrome → frames → ffmpeg), `src/main.js` (post-processing, motion blur, captions), `src/toon.js` (character), `src/nile.js` (set builders), `src/anim.js` (springs and motion helpers), `src/shots_dm.js` (the demo), `src/shots_ft.js` (face test bench). |
| `scripts/` | Camera framing and search, QA probes, a 30 fps block renderer, Kokoro voice, timing export, the sound mix. |
| `kaggle/` | Free GPU rendering on Kaggle: the notebook worker and a one-command job runner. |
| `examples/shaduf-demo/` | The demo's script, voice timings and sound events. |
| `IMPROVEMENTS.md` | Status of the improvement work, its rules and the backlog. |
| `STYLE.md` | How the style works, setup, how to make a video, the QA checklist and lessons learned. **Read it first.** |

## Versions

Each release is a commit listed in `CHANGELOG.md` (v1.0.0 = `9df2680`). Channels pin that commit, so an upgrade never
changes a video mid-production: `git clone https://github.com/trentrafferty2001-svg/3d-style && git -C 3d-style checkout <commit>`. Each
render job also bundles its own copy of the engine, so finished videos stay reproducible. See `CHANGELOG.md`.

## Credits

Engine based on [claude-animation-skills](https://github.com/artemnovitckii/claude-animation-skills) (MIT, see
`engine/LICENSE-claude-animation-skills.txt`). Poppins font: SIL Open Font License (`engine/fonts/OFL-poppins.txt`).
three.js (MIT) and the Kokoro voice model (Apache 2.0) are downloaded at setup, not included. `GTAOPass.js` and
`SimplexNoise.js` are vendored from three.js (MIT).
