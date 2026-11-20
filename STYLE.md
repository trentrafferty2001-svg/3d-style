# Style v2: the upgraded 3D cartoon look

A self-contained copy of the reel engine with the v2 upgrades, plus the shaduf demo (7.5 s) that shows them.
This is the upgraded style in its own repo (it started as `tools/style-v2/` in video-studio). Each video's render job
bundles its own copy of the engine, so a video stays reproducible whatever changes here later.

## What changed from the v1 look

| # | Upgrade | Where |
|---|---|---|
| 1 | **Motion that feels animated, not tweened.** Spring step responses (overshoot and settle), `springKeys` (spring-driven keyframes that blend), `wobble` follow-through, `easeInBack`/`easeOutBack` anticipation and overshoot, smooth noise for idle motion, an organic `handheld` camera and `camPath` (Catmull-Rom) moves. All pure functions of time. | `engine/src/anim.js` (bottom section) |
| 2 | **30 fps with real motion blur.** Each output frame averages `mb` sub-frames across a 180 degree shutter, in linear light. Cuts never blend two shots. | `engine/src/main.js` (`MB`, `drawScene`, accumulation) |
| 3 | **Grounded lighting.** GTAO ambient occlusion (from the explainer-channel kit), `STYLE.shadow = 'pcf'` so `light.shadow.radius` actually softens shadows (`PCFSoftShadowMap` ignores it), 4096 shadow maps on hero shots, a fill and a rim light. | `main.js`, each shots file |
| 4 | **Clean edges and highlights.** Every sub-frame gets a sub-pixel (Halton) camera jitter, so motion blur doubles as supersampled antialiasing and smooths AO noise. A sanitise pass before bloom replaces NaN/Inf pixels (they used to bloom into one-frame white blotches) and caps extreme highlights. | `main.js` |
| 5 | **Assets with more care.** A new character (`toon.js`): one smooth skinned body with no visible joints, sculpted head with eyelids, brows, mouth shapes and eye look-at, five-finger hands that curl, sandals, pleated linen kilt that follows the thighs, two-bone IK for arms and legs, FK trunk with twist. A new set (`nile.js`): sculpted river-bank terrain with wet and dry soil, mud platform, detailed shaduf (plastered pillars, bark-textured tapered pole, lumpy mud counterweight with rope lashings, clay bucket with water inside), wind-blown instanced grass and papyrus, date palms with hundreds of leaflets, a mud-brick hut. Physically driven secondary motion: a simulated bucket pendulum, ballistic splash and drip particles, ripple rings. | `engine/src/toon.js`, `engine/src/nile.js`, `engine/src/shots_dm.js` |

### Quality pass 2 (Nov 2026)

| Area | What it does | Where |
|---|---|---|
| Face and acting | Eye darts, timed blinks (one on the release), wide-eyed "phew" with a round mouth, flaring nostrils while straining, a real grin (mouth line, teeth and opening all follow one smile curve, cheeks lift), heavier breathing, hands to hips, weight shift, a proud nod, then a look out over the river. Head turns arrive late and settle (simulated lag). | `toon.js` `face()`, `shots_dm.js` `rig()` |
| Cloth | The kilt's hem hangs on its own bone, swung by a damped pendulum driven by the hips' movement plus a breeze; a vertex-shader ripple makes the linen flutter towards the hem. | `toon.js` (kilt bone, `kiltFlutter`), `shots_dm.js` (`KILT`) |
| Light | Warm bounce from the sand onto undersides; denser haze for aerial perspective. | `shots_dm.js` `world()` |
| Surfaces | Dried-mud cracks and grain (uv laid along the bank slope so nothing stretches), mud-brick platform with mud mortar and plaster smears, cracked plaster pillars, painted clay bucket that darkens and turns glossy when wet, tree rings on log ends, pebbles placed by raycasting the real terrain. | `nile.js` (`detailTextures`, `pebbles`) |
| Water | Planar reflection (mirrored camera with oblique clipping, half-res HDR, rendered per sub-frame via `scene.userData.prerender`), rippled and blended by Fresnel; lighter tint in the shallows and broken foam where water meets the bank and platform, from a precomputed depth/edge map. | `nile.js` `river()`, `main.js` prerender hook |

Extra QA for this pass: `probe_akimbo.mjs` (fists on the hips: on the surface, never inside), `probe_kilt.mjs` (the hem really
swings), `search_endcam.mjs` (end camera that keeps the bucket clear of the face and sees it).

### Character pass (Nov 2026)

- **Eyes:** off-white balls set into recentred sockets, an iris with a darker rim and a lighter ring round the pupil,
  a lash line on each upper lid, upper lids that follow the gaze, and a natural gaze limit (about 20 degrees). Before
  this, the far eye could roll into the corner and show a bulging white eye.
- **Mouth:** one shape drives it. Tapered upper and lower lips follow the smile curve and wrap round the face, the
  dark opening is filled exactly between the inner lip lines, and individual teeth sit along them (upper row for a
  grin, both rows for a clench). It sits in a hollow sculpted into the head. Before this, the teeth were one white bar.
- **Face shape:** stronger jaw and chin, a slimmer nose bridge and tip, ears with a bowl and lobe, thinner tapered brown
  brows, a shorter, thicker neck with a fuller shoulder slope.
- **Test bench:** `engine/src/shots_ft.js` renders 12 close-ups (neutral, grin, strain, phew; front, three-quarter,
  profile; the gaze pushed sideways). Point `main.js` at it (`mkengine.sh ft`) and check it after any face change.

Sound follows the same idea: effects are locked to the animation by exporting its timing (`scripts/events.mjs`)
and the pole creak follows the pole's angular speed (`scripts/make_audio_dm.py`).

## Per-video settings

A shots file can export `STYLE = { shadow: 'pcf', mb: 6, shutter: 0.5 }`. URL overrides for quick checks:
`?mb=1` (no blur, fast stills), `?noao`, `?nodof`, `?fps=30`, `?dbg`.

## Setup (fresh container, paths as used here)

```bash
mkdir -p /home/claude/deps && cd /home/claude/deps
git clone --depth 1 --branch r169 --filter=blob:none --sparse https://github.com/mrdoob/three.js.git three
cd three && git sparse-checkout set build examples/jsm/postprocessing examples/jsm/shaders examples/jsm/utils examples/jsm/geometries
git clone --depth 1 --branch v1.0.0 https://github.com/trentrafferty2001-svg/3d-style /home/claude/3d-style
cp -R /home/claude/3d-style/engine /home/claude/style2 && cd /home/claude/style2
mkdir -p node_modules && ln -sfn /home/claude/deps/three node_modules/three && ln -sfn "$(npm root -g)/playwright" node_modules/playwright
pip install scipy onnxruntime   # voice + mix
```

## Making a video in this style

The `.mjs` scripts import `playwright`/`three` from the engine's `node_modules`: copy them into the engine folder
and run them from there (e.g. `cp scripts/probe_hands.mjs /home/claude/style2/ && node probe_hands.mjs /home/claude/style2 2.0`).
`frame.mjs` and `search.mjs` import three from `/home/claude/deps/three`.

1. Script and voice as in `HANDOFF.md` (Kokoro `af_heart`), then `scripts/plan_vo.py` writes `src/vo_X.js`.
2. Copy `shots_dm.js` as a template and point `main.js` at it. Keep every function of time pure: anything that needs
   history (pendulums, hand-over-hand grips, crossings) is simulated once into a table when the shot is built.
3. Frame cameras with numbers, not guesses: `node scripts/frame.mjs` projects key points through a camera and says
   whether they fit the 9:16 frame; `node scripts/search.mjs` finds the camera that frames them biggest.
   A 9:16 frame is only ~1.2 m wide at 3.5 m with a 34 degree lens.
4. Fast stills: `GL=swiftshader RES=720 QS=mb=1 node render.mjs stills 0.5,1.2,... out_dir`, then
   `python3 scripts/sheet.py out_dir` for a contact sheet. Check every shot.
5. Measure what stills hide: `scripts/probe_hands.mjs` (palm-to-rope distance, reach) and a 360p preview with a
   frame-difference scan for pops (any spike that is not a cut is a bug).
6. Final: render on Kaggle's free GPU (`kaggle/README.md`, about 20 minutes per 45 s video). Fallbacks: the GitHub farm,
   or locally `ENGINE=... PARTS=... FPS=30 bash scripts/render30.sh "b00 0 15" "b01 15 30" ...` (3 workers on a
   4-core box: about 50 s per final 1080p frame per worker at mb=6), or the GitHub render farm
   (`render-farm` branch of the-ai-frontier-media; set `"fps": 30` in job.json).
7. Sound: `node scripts/events.mjs <engine> events.json`, then `python3 -I scripts/make_audio_dm.py plan.json events.json mix.wav`,
   master to -14 LUFS, and run `earshot critique` on the final MP4.

## QA before every final render (all must pass)

Run these from the engine folder (copy the scripts in; they need `?dbg`, which `shots_dm.js` honours):

| Check | Tool | Pass |
|---|---|---|
| Grounding: every grass tuft, reed, palm, jar, pillar vs the real terrain surface | `probe_qa.mjs` | float < 2 cm, nothing hovering |
| Feet on the platform over the whole clip | `probe_qa.mjs`, `probe_feet.mjs` | soles within the surface texture (about ±2 cm) |
| Hands on the rope (grip) and within reach | `probe_hands.mjs` | under 6 cm while gripping |
| Nothing of the character inside the bucket (body, head, hands, feet) | `probe_bucket_body.mjs` | "no body part inside" |
| Clearances: bucket vs platform, counterweight vs ground, hands vs head | `probe_qa.mjs` | all positive |
| Pops: frame-to-frame difference scan of a 360p preview and of the final | see `projects/shaduf-demo/NEXT_STEPS.md` | only spikes at cuts |
| Dense look: a still every 0.25 s viewed at 400 px wide, plus zooms on faces and edges | `render.mjs stills` | read every frame, top to bottom |
| Sound | `earshot critique`, `earshot sheet` | 0 critical/major, cuts on a hit |

## Lessons from the demo (don't repeat these)

- three.js caches patched shaders by the patch function's source text. Every material made by the same
  `onBeforeCompile` function shares one program unless it sets `customProgramCacheKey`: grass, papyrus and palm
  wind (and the water ripple strength) were mixing up. Always give parameterised patches a key.
- Wind on tall plants: sway must be measured from where the plant is attached (palm crown), and every part that
  sways together (leaflets and their midrib) must be in the same mesh. Give swaying meshes a matching
  `customDepthMaterial`, or their shadows stand still.
- Shape blends need smooth weights, not `if (nz < 0)` switches: a hard switch leaves a visible crease. Anything
  that hugs a surface (hair cap) must be shaped by the same function as the surface.
- Feet must sit on the flat part of a platform: toes over a rounded edge hover.
- A probe that never fires may be blind: print its closest approach once to prove it measures (the first bucket
  probe skipped the head and hands).

- Lathe profiles must run bottom to top, or the normals point inwards (dark, see-through limbs).
- Skin weights on a tube are measured from its top: the end inside the head must follow the head.
- Quasi-static "lean against acceleration" swings explode on spring keys; simulate a damped pendulum instead.
- Clearcoat on dozens of droplets, or a glossy water surface facing the sun, blooms into haze. Keep drops at
  roughness 0.3; the sanitise pass catches the rest.
- Ropes must reach the bucket's bail; hands must grip within reach (check with the probe, not by eye).
- In JS, `-(x) ** 2` is a syntax error; render.mjs now exits on the first page error instead of hanging.

Engine based on [claude-animation-skills](https://github.com/artemnovitckii/claude-animation-skills) (MIT, see
`engine/LICENSE-claude-animation-skills.txt`). Poppins font: SIL OFL. three.js (MIT) and the Kokoro voice model
(Apache 2.0) are downloaded at setup.
