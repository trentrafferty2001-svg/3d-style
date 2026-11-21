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

### Light and skin pass (v1.1.0, Nov 2026)

- **Skin** (`toon.js` `skinShading`, settings in `SKIN`): light wraps a little past the terminator and comes back warm,
  like light scattered under skin (diffuse only; highlights keep the true angle). Sky light on skin is warmed, not
  lavender. A soft view-facing rim lifts the silhouette off any background. Roughness varies slightly over the body.
  The albedo is desaturated in linear light (`sat: 0.56`): the v1.0 skin was about 8:1 red to blue, which is what made it
  read as flat orange plastic. The inner ears use the same shading and follow the skin tone, so other skin tones work.
- **Surfaces** (`nile.js` `roughTex`, `toon.js` linen): roughness maps on wood, clay and the kilt's linen, with the
  base roughness raised so the average is unchanged; only the highlights break up.
- **Film grain** (`main.js`): fine monochrome grain, strongest in the midtones, new every frame, applied once per output
  frame after the motion-blur average so it looks the same at any `mb`. `STYLE.grain` sets it (default 0.022, 0 = off),
  `?grain=0` turns it off for a check.
- The existing sky lighting (PMREM), cool rim, warm bounce, vignette and grade are kept; item 6's "rim light" is done in
  the skin shader, so it works from every camera angle.

### Roman set (v1.2.0, Nov 2026)

- **`roman.js`**: detailed tileable materials made in code (travertine ashlar with chamfered joints, pores and weathering;
  Roman brick with thick mortar; polygonal basalt paving worn smooth; marble or stucco with faint veins; plaster with
  stains, hairline cracks and fallen patches; wooden planks; terracotta roof tiles; dusty ground), each with colour,
  bump and roughness. `worldUV(geo, tile)` gives any geometry real-size UVs, so a kerb and a wall show the stone at
  the same scale. `block()` (rounded edges), `column2()` (Attic base, fluted shaft with entasis, Tuscan capital),
  `amphora()`, `settle()` (rests an object on the ground by its exact lowest point).
- **`romanSite()`**: a Roman street, 1 unit = 1 m. Basalt road with a crown and Pompeii stepping stones, kerbs, travertine
  pavements, a fluted portico with a tiled lean-to roof, an ochre plaster wall with a painted dado, shop doors with
  shutters and windows, amphorae, an olive tree, cypresses and umbrella pines in the wind, grass and weeds. Layout
  constants are in `RS`; `romanHeightAt(x, z)` is the walkable top, and `site.userData.groundAt` raycasts the real meshes.
- **Character:** `toon({ outfit: 'tunic' })` (or `romanWorker()`) gives a belted wool tunic: the torso's own shape
  pushed out, loose (no muscles showing, soft folds, a little blousing over the belt), with the same skin weights so it
  follows every bend. The skirt swings on the kilt bone, and the sleeves are wide enough that the arms come out of their hems.
- **`rome.js`** keeps its API (Pantheon, aqueduct, formwork, quicklime trough, columns), now built with the new
  materials, fluted columns and world-scale UVs.
- **Test scene** `shots_rm.js` (5.5 s): a crane-down to a worker on the pavement who points down the street, then a close-up.
  **QA:** `probe_rome.mjs` (every prop's lowest points and every plant against the ground under it, soles, palms vs cloth).
  Sound for test clips: a Kokoro line (`kokoro_say.py`), The Explainer's code-made music bed (`music-bed.py` in the
  explainer-video repo's skill) ducked under the voice, `scripts/make_ambience.py` (wind, cicadas, birds) under that,
  and earshot one-shots (`bamboo_swish` into the cut, `cut_hit/air` on it), mastered to -14 LUFS with the two-pass
  loudnorm chain (the Kaggle job's one pass landed at -15.4 on a short clip: re-mux the mastered mix onto its video). Ambience alone fails
  `earshot critique` (no music, dead air), and music without a voice reads as code-synthesized.

### Indus set (v1.3.0, Nov 2026)

- **`indus.js`**: a Mohenjo-daro lane, c. 2500 BC. Materials: fired brick in English bond (1:2:4 bricks, alternating header
  and stretcher courses, thin mud mortar, worn edges, faint salt bloom), packed earth with small pebbles, mud plaster,
  red-slipped pots with black painted bands. `indusSite()`: tall blank brick walls on both sides with small doorways,
  windows and floor-beam ends, a house closing the far end, a covered brick drain along the street (one cover lifted and
  leaning on the wall, water running inside), a terracotta pipe from an upper floor down into the drain with a thin
  stream, a junction with a round brick well (wedge-brick ring, dark shaft) and pots, a pipal tree over the walls,
  weeds at the wall bases. Layout in `IS`, walkable top `indusHeightAt`, exact `site.userData.groundAt`.
  `indusWorker()` is the character in the kilt outfit, worn as a wrapped cotton cloth.
- Built from `roman.js`'s shared helpers (`triTex`, `tfbm`, `voro`, `courses`, `jointDist`, `worldUV`, `block`, `settle`,
  vegetation), so a new set is mostly a layout plus a few textures.
- **Test scene** `shots_in.js` (5.5 s): down the lane to a worker who points at the open drain, then a close-up of the
  drain and the pipe. QA as for the Roman set (`probe_rome.mjs` works on any set that sets `_SITE`).

### Water (v1.3.1, Nov 2026)

- **`water.js`**, for any set: `flowWaterMaterial()` (ripples carried along a flow direction, rings spreading from
  impact points, foam at the landing point with a thin wake drifting downstream, dark murky body, sky reflections
  controlled by `env`), `streamMaterial()` for a TubeGeometry stream (see-through body, bright edges, streaks rushing
  down, thinning with `taper`, breaking into drops near the end), and `splash()` (seeded droplets thrown up where a
  stream lands; call its `update(t)` every sub-frame through `scene.userData.updaters`; marked `noGround` so grounding
  probes skip it). All of it is a pure function of time.
- In the Indus drain: the stream leaves the pipe's lower lip in a parabola with the pipe's speed and lands where the
  water shader puts its rings and foam (`LAND`). The pipe has a dark inner bore and a rim, so it reads as thick terracotta.

### Egypt set (v1.4.0, Nov 2026)

- **`egypt.js`** keeps its API (pyramid, construction ramp, quarry, barge, sledge, water jar, steep ramp, workers' tomb,
  Nile), now with code-made materials (`egyptMats()`: core limestone with chisel marks and pits, smooth Tura casing,
  sun-dried mud brick with straw, desert sand with wind ripples, red clay), rounded textured blocks, world-scale UVs,
  rope loops that hug the block on the sledge, a lathe-turned clay jar, and the Nile on `flowWaterMaterial`. The old
  `egyptian()` worker (previous rig) stays for old shot files. New: `egyptWorker(i)` (the current character in a linen
  kilt with a cloth head cover) and `egyptSite()`: a flat work site in the desert with dunes beyond, a pyramid two-thirds
  built far off with a mud-brick ramp up its face (placed from the 51.8 deg slope), scattered blocks, Nile fields with
  palms. Layout in `ES`, walkable top `egyptHeightAt`.
- **`water.js`** gains `wetPatch()` (ground that darkens with a dull sheen as water soaks in, a ragged spreading edge)
  and `liveStream()` (a stream rebuilt every frame, e.g. poured from a jar in moving hands).
- **Test scene** `shots_eg.js` (5.5 s): haulers on the rope, a worker pouring water from a jar in front of the sledge's
  runners; close-up of the water hitting the sand and the patch spreading. Everything follows the poses: the jar is
  between the hands, the stream leaves its mouth under gravity, the rope runs through the haulers' grips.

### Persia set (v1.5.0, Nov 2026)

- **`persia.js`** keeps its API (yakhchal whole and cut-away, shade wall, freezing channel, qanat wells, desert ground,
  palms, ice) with code-made materials (`persiaMats()`: kahgel, the mud-and-straw plaster of Yazd; adobe brick; a
  red-ochre desert floor; dressed stone), lathe domes with round UVs (`cylUV` from indus.js) and world-scale UVs elsewhere.
  `palm()` now returns the Nile set's swaying date palm (the old flat-frond one is `palmOld`). The old `persianWorker()`
  (previous rig) stays; new `persianWorker2()` is the current character in a tunic and white cap.
- **`persiaSite()`**: a Yazd lane. Kahgel walls with patches worn back to the adobe, double wooden doors in arched niches,
  windows, windcatchers (towers with slatted vents) and a dome above the roofs, a yakhchal and palms beyond, desert dunes
  and mountains; a stone jub along the lane with flowing qanat water, fed by a stone spout at 1.5 m. Its stream ends in
  the jub (rings, foam and splash) or in whatever is held under it: `site.userData.streamTo(y)`, and
  `jubWater.userData.uImp` fades the rings and foam out when nothing lands. Layout in `PS`.
- **Test scene** `shots_pe.js` (5.5 s): a crane down from the windcatchers to a worker who lifts his jar under the spout;
  close on the jar filling.

### Farm set: rice-fish paddies (v1.6.0, Nov 2026)

- **`farm2.js`** keeps its builders (`riceClumps`, `clumpGrid`, `carp`, `farmer2`, `splash2`) and adds code-made paddy
  materials (`farmMats()`: wet mud, grassy dike earth, thatch, a rice carpet for far plots, wood, hills), a conical straw
  hat (`conicalHat(F)`) and `paddyFarmer()` (the current character in a tunic and the hat).
- **`paddySite({ seed, impacts, clear })`**: flooded plots between rounded grassy dikes (layout in `FS`, walkable height
  `paddyHeightAt`), see-through water (`flowWaterMaterial` with `opacity`) over the mud, with rings at the `impacts`
  (a farmer's shins); rice planted in rows in the near plots and a carpet beyond; a stilted hut with a thatched roof
  standing in the mud; broadleaf trees and hills; carp swimming in lanes between the rows (`site.userData.update(t)`).
  `clear` keeps rice out of circles `[x, z, r]` or boxes `[x0, x1, z0, z1]` (round a farmer, a strip for a low camera);
  the site's carp keep out of the boxes.
- `oliveGeo(seed, { cols, n, spread })` in roman.js now takes leaf colours, so the same tree makes olives or broadleaves.
- **Test scene** `shots_fa.js` (5.5 s): a farmer in the paddy, hands on hips, watching two carp swim past in front of
  him; close on a carp weaving between the stems.

### Lip-sync (v1.7.0, Nov 2026)

- **`lipsync.js`**: the mouth follows the voice's own sounds. `kokoro_say.py` now writes every sound (phoneme) of a line
  with its time (`phones` in timing.json, from Kokoro's predicted durations) and `plan_vo.py` carries them into
  `src/vo_X.js` (`phones`, `audioAt`). `const talk = lipTracks(VO)` gives a mouth shape for any time;
  `F.face({ ..., speech: talk(t) })` lays it over the expression (smile, brows and blinks still work).
- Shapes: lips shut on m/b/p (held at least two frames, stretched into the next sound), lower lip under the top teeth
  on f/v, rounded and toothless on o/oo/w/oi, spread on ee, open with the top teeth on ah/ai; neighbouring sounds blend
  (co-articulation, vowels weighted so short ones still open), the jaw follows a beat behind and starts closing just
  before a closure, and the mouth moves 40 ms before the sound (as real lips do). `talk(t).jaw` is there for small
  head nods on stressed sounds.
- **Probe** `scripts/probe_lips.mjs <engine> src/vo_X.js`: every m/b/p shut and seen shut on two frames or more, f/v
  tucked, open vowels open past 6 mm, rounded sounds narrower than rest, shut in silence, no open-to-shut flips.
- **Test scene** `shots_lp.js` (6.8 s): a Roman worker says one line to camera; chest-up, then close on the face.

### Hands (v1.8.0, Nov 2026)

- **Fingers** have three joints and the thumb two; the palm is flatter. `F.grip(l, r)` still curls 0..1, now with a
  relaxed cascade (the index least curled, the little finger most, open fingers fanned a little). The thumb is posed by
  direction (`thumbPose`): resting beside the index finger, swinging across the palm side to grip.
- **`F.hold(s, { a, b, r }, { u, up, thumbTo, pole })`** holds a rope, handle or tool (any cylinder, world points): the
  hand turns to lie across it with the forearm's side towards the elbow, the arm reaches the wrist, then
  **`F.grasp(s, cyl)`** closes each joint until its segment touches the surface, so fingers wrap thin ropes and thick
  poles alike. `F.wristBend(s)`, `F.reachShort[s]` and `F.fingerLines(s)` are there for probes.
- Lay a held tool across the fist, at about a right angle to the forearm (a hammer grip). Lined up with the forearm,
  like a sword, the wrist has to bend past 90 degrees. Swing a tool about the elbow, with the forearm and tool moving
  together, not about the hand.
- **Probe** `scripts/probe_grasp.mjs <engine> <duration>` (scenes set `window._HOLDS` under `?dbg`): at least 3 of 5
  fingers touching, none more than 3 mm in, the palm on the tool, the wrist under 75 degrees, the arm long enough.
- **Hand bench** `shots_hb.js` (8 stills: relaxed from two sides, half-curled, fist, rope, handle, pole from two
  sides): render it after any hand change and compare.
- **Test scene** `shots_hd.js` (5.3 s): an Egyptian mason dresses a block with a copper chisel and a club mallet.

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
git clone https://github.com/trentrafferty2001-svg/3d-style /home/claude/3d-style && git -C /home/claude/3d-style checkout <commit from the channel's rules>
cp -R /home/claude/3d-style/engine /home/claude/style2 && cd /home/claude/style2
mkdir -p node_modules && ln -sfn /home/claude/deps/three node_modules/three && ln -sfn "$(npm root -g)/playwright" node_modules/playwright
pip install scipy onnxruntime   # voice + mix
```

## Making a video in this style

The `.mjs` scripts import `playwright`/`three` from the engine's `node_modules`: copy them into the engine folder
and run them from there (e.g. `cp scripts/probe_hands.mjs /home/claude/style2/ && node probe_hands.mjs /home/claude/style2 2.0`).
`frame.mjs` and `search.mjs` import three from `/home/claude/deps/three`.

1. Script and voice as in `HANDOFF.md` (Kokoro `af_heart`), then `scripts/plan_vo.py` writes `src/vo_X.js` (words and
   sounds). A character who speaks on screen gets `speech: lipTracks(VO)(t)` in its `face()` (see `shots_lp.js`).
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
| Hands on the rope (grip) and within reach | `probe_hands.mjs` (sample densely, e.g. every 0.02 s) | its last line: under 6 cm while gripping (PASS) |
| Rope meets the bail and the pole tip over the whole clip | `probe_rope.mjs` | PASS (both gaps under 1.5 cm) |
| Nothing of the character inside the bucket (body, head, hands, feet) | `probe_bucket_body.mjs` | "no body part inside" |
| Clearances: bucket vs platform, counterweight vs ground, hands vs head | `probe_qa.mjs` | all positive |
| Pops: frame-to-frame difference scan of a 360p preview and of the final | `python3 -I scripts/pop_scan.py <mp4> <cut s,...>` | PASS (only spikes at cuts) |
| Dense look: a still every 0.25 s viewed at 400 px wide, plus zooms on faces and edges | `render.mjs stills` | read every frame, top to bottom |
| Sparkles: isolated white pixels from shading blow-ups (they hold still, so the pop scan misses them) | stills with `QS='mb=1&nodof'`, then `python3 -I scripts/sparkle_scan.py <dir>` | PASS (eye catchlights allowed) |
| Code after a `//` comment on the same line (silently disabled) | `python3 -I scripts/swallow_scan.py` | PASS |
| Sets: props and plants on the ground, soles and palms of every character | `probe_rome.mjs` (any scene that sets `_SITE` and `_F` or `_FS` under `?dbg`; airborne effects set `userData.noGround`) | PASS |
| Hands on ropes, handles and tools: contact, no fingers inside, wrist, reach | `probe_grasp.mjs <engine> <duration>`, hand bench `shots_hb.js` after hand changes | PASS |
| Lip-sync on a speaking character: closures, openings, rounding, silence, no flips | `probe_lips.mjs <engine> src/vo_X.js` | PASS |
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
- Never put a `//` comment in the middle of a line of code when editing: it silently swallows the rest of the line.
  It happened four times: the v1.0.0 rope, twice while building the Roman set (once a syntax error, once hidden), and
  once in Egypt, where a wet patch was silently never added to the scene. After editing, run `node --check` on a `.mjs`
  copy of each changed module and `python3 -I scripts/swallow_scan.py`, then read the changed lines.
- Bump mapping can blow up on a face seen exactly edge-on: three.js builds the bumped normal from screen-space
  derivatives, which degenerate there, and a few anti-aliasing samples on the top of a door lintel lit up to extreme
  values (a row of white dots after the highlight cap, blown into discs by depth of field). `main.js` now guards the
  bump normal (falls back to the true normal when it degenerates or tilts too far). It was found by bisecting:
  lights off one by one, shadow bias, AO, DOF, env reflections, then the material's maps one at a time.
- Water up close: a flat coloured plane reads as paint, an opaque tube as a milky rod, and a bare tube as paper. It needs
  motion in the surface (flowing ripples), reflections, transparency with bright edges, and contact: rings, foam and a
  splash where the stream lands. Keep the foam to the landing point and a thin wake, because more reads as snow. Keep a
  stream's wobble to a shimmer, because larger wobbles read as jelly.
- A mesh added to the ground list after the last `updateMatrixWorld()` raycasts as if it sat at the origin: the Indus
  well square's paving made weeds in the middle of the lane float 15 cm. `groundAt` now refreshes the ground meshes'
  matrices on every call.
- Staging: a head bowed all the way to look at something near the feet hides the face from a camera in front (it reads as
  the back of the head). Tilt the head part of the way and let the eyes do the rest. A point aimed straight down at the
  ground reads as a hanging arm: aim it a little above the target.
- A wide hat brim makes that worse: with the conical hat, even half a head tilt down hid the farmer's face. Aim the head
  at a point well above what he looks at (`headAt(target + 0.9 m up, 0.45)`) and let the eyes look down.
- Over water, a back light at the same height as the camera's downward angle puts its mirror glint right where the
  camera looks (a white blaze over the carp). Keep rim lights well above the camera's pitch in water scenes.
- Anything that moves on its own (the site's background carp) must stay out of the space the camera works in: a carp
  swam across the lens of the close-up, and the hero carp first swam into a dike. Check the path against the set's
  layout and the camera's clearing.
- Probes want an instance's origin on the ground: put a tree crown's offset into its geometry (`.translate`) rather than
  lifting the instance, or the probe reports a crown floating 60 cm up.
- Lip-sync: the mouth fill (the dark inside) must sit just behind the lips. Pushed 3 mm back, the mouth hollow's skin
  showed in front of it and an open "ah" read as a skin-coloured slot with a dark blob.
- Stretch a too-short closure forwards, never backwards: centring a 70 ms m on a 25 ms one ate the "o" of "Rome".
- A probe threshold must come from the real thing, not a round number. Lips can shut over one frame on m/b/p in real
  speech; what reads as a glitch is a closure too short to be seen, so the probe checks that each one is seen shut
  on two frames.
- Hanging hands: with a sideways `armIK` hint the palms turned to the camera; a forward hint puts them against the
  thighs.
- The `armIK` hint is the direction the thumb side of the hand faces (the hand's +z). Forward for hanging hands.
- A close-up bench finds what a full-body view hides: since v1.0 the thumb leaned out through the back of the hand (a
  bump on the back of the palm). Pose by direction, not by stacked rotation angles, when the sign of each angle is
  unclear.
- A grasp that starts from the rest pose can already be inside a thick handle and count as "touching" at once: open
  the joint wide first, then close it.
- Twice more while building the hands, a `//` comment swallowed code: once the loop that builds the mouth's opening,
  once the line that adds the palm to the hand. `swallow_scan.py` caught both before any render; run it after every
  edit.
- A rotated object's `Box3().setFromObject(o)` is loose (it boxes the geometry's box), so `settle()` must use the precise
  form, `setFromObject(o, true)`, or props float by several cm.
- Place plants and props on the ground mesh you actually render (raycast it), not on the height function it was built
  from: a 1 m grid differs from the function by several cm, and a ramp down to a pavement edge left grass floating 4.6 cm.
- Cloth over arms: a hanging hand beside a full skirt needs to sit clear of it (`probe_rome.mjs` palm check), and a
  spring that undershoots must be clamped where an undershoot pushes a hand into the body.
- Flat "plastic" skin was chroma, not lighting: turning fill and rim up or down barely changed it, while a grey test
  (`sat: 0`) showed the face had plenty of shape. Test the extreme value first to prove a setting is wired up and to
  see which knob matters.
- Before chasing a colour patch in the lighting, check what sits on top of it: a lavender patch on the shoulder at
  6.75 s was the caption's 30 px soft drop shadow, not the 3D render (raycast the pixel with `?dbg` to see what's there).
- In JS, `-(x) ** 2` is a syntax error; render.mjs now exits on the first page error instead of hanging.
- Keep code off the end of a `//` comment line. v1.0.0 shipped with the rope's rotation written after a comment on
  the same line, so the rope never tilted and ended in mid-air beside the swinging bucket. A probe for each attachment
  (`probe_rope.mjs`) catches what stills taken while the bucket hangs still miss.
- A probe must know what it measures: the old hand probe printed palm-to-rope distances without saying whether that
  hand was gripping or reaching, so grips 8 cm off the rope at full arm stretch passed by eye. It now reads the grip
  state (`?dbg` exposes it) and prints a PASS line. A two-bone arm reaches 0.605 m: keep every grip target at or under
  about 0.59 m from the shoulder, or the arm locks straight and the palm stops short.

Engine based on [claude-animation-skills](https://github.com/artemnovitckii/claude-animation-skills) (MIT, see
`engine/LICENSE-claude-animation-skills.txt`). Poppins font: SIL OFL. three.js (MIT) and the Kokoro voice model
(Apache 2.0) are downloaded at setup.
