# Improving the 3D style: where we are and what's next

This file carries the improvement work from one session to the next. **Read it first when the job is to make the style
better** (not to make a channel video). At the end of every improvement session, update "Status" and the
session log at the bottom, then commit.

## Rules for improvement sessions (set by the owner)

- **No full videos yet.** The owner is still improving quality. Test on the shaduf demo (`engine/src/shots_dm.js`,
  7.5 s) or a short test scene, and send short clips or stills only.
- **No mistakes.** Every change passes the QA in `STYLE.md` before a clip goes to the owner: probes, stills every
  0.25 s viewed large, the pop scan, `earshot critique`. Nothing floating, no hands through bodies, no pops.
- **Free only.** Kaggle's free T4 GPU first (6 GPU hours a week, shared by both channels, resets Saturday 00:00 UTC),
  then the 20-runner GitHub farm (`render-farm` branch of `trentrafferty2001-svg/the-ai-frontier-media`).
- **Channels stay pinned.** Ancient Explained and The Explainer use v1.0.0 (`9df268009364ad0306a48d02f21ba89bcec7ffcc`)
  from January 2027. A new version only reaches them when the owner says so; then update the pins in
  video-studio's `PIPELINE_RULES.md` (branch `ancient-explained-remake`) and `EXPLAINER.md` (branch `explainer-channel`).
- December 2026 videos keep the old look; don't touch them.
- Release: work on a branch, PR into `main`, merge (the owner allows it), then add the version to `CHANGELOG.md`
  with its full commit id (v1.0.1 fixes, v1.1.0 features). Tags can't be pushed from cloud sessions.

## Status (22 Nov 2026)

New backlog (A-F below), session 3: A (cloth folds) is released as v1.14.0 and its clip sent; B (hair and beards) is in
progress, then C (hands up close), D, E, F. The channels stay on v1.0.0 until the owner starts January content.

### Earlier status (21 Nov 2026)

Overnight 21-22 Nov the owner asked Claude to keep improving whatever needs it and to report at 8am SAST. v1.10.0
(item 5: caustics), v1.11.0 (item 8: crowds, plus adaptive motion blur from item 9) v1.12.0 (god rays, the
last open part of item 6) and v1.13.0 (faster frame capture, talking extras) are released; v1.9.0 (item 4: rope and cloth), v1.8.0 (item 3: hands) and v1.7.0 (item 1: lip-sync)
before it, all waiting for the owner's verdict. Item 10 (one-command QA, `scripts/qa.py`) is in place. All ten backlog items now have work behind them; ask the owner which to deepen next.
v1.6.0 (the farm) completed item 2 (sets beyond the Nile): Rome, Indus, Egypt, Persia and the farm. Persia (v1.5.0),
Egypt (v1.4.0), water (v1.3.1) and Indus (v1.3.0) were liked by the owner.
v1.2.0 (Rome) before it; the owner liked the Roman test clip (21 Nov). v1.1.0
(skin, grain; the owner liked it) and v1.0.1 (fixes) before it. The channels stay on v1.0.0 until the owner moves them.

v1.2.0: a Roman street set (`roman.js`, `romanSite()`) with detailed code-made materials, fluted columns, rounded blocks,
wind vegetation and amphorae, all grounded; a tunic outfit for the character; `rome.js`'s old builders upgraded in
place; a bump-normal guard in `main.js` (edge-on sparkles) and two new QA tools (`probe_rome.mjs`, `sparkle_scan.py`).
Item 2 is done (all five sets). Next: the owner picks the next backlog item.

v1.1.0: skin that isn't flat orange plastic (wrap and warm subsurface term, warm sky light, a view rim that separates the
character from any background, roughness variation, linear-light desaturation), roughness maps on wood, clay and
linen, and film grain once per output frame. Not done from items 6 + 7, left for later if wanted: god rays and a
character-only key light per shot (the existing sky light, cool rim, bounce, vignette and grade were kept).

v1.0.1 fixed two v1.0.0 bugs found while making the baseline stills: the rope never tilted with the bucket's swing
(it ended in mid-air beside the bail from about 5.5 s), and some grips were out of the arm's reach (palms up to
8.3 cm off the rope). New QA: `probe_rope.mjs`, a grip-aware `probe_hands.mjs`, `pop_scan.py`.

Shipped in v1.0.0:

- **Motion:** springs, anticipation and overshoot, simulated pendulums and grips, handheld camera, camera paths.
- **Image:** 30 fps motion blur (mb=6 demo, mb=4 for channel videos) with jittered antialiasing, PCF soft shadows,
  GTAO, NaN-safe bloom.
- **Water and set:** planar water reflections with shallows tint and shore foam, detail textures, palms and grass
  in the wind.
- **Character:** reworked eyes (gaze limit, lids follow the gaze), shaped lips and individual teeth in a mouth hollow,
  kilt pendulum and flutter.
- **Rendering:** about 5 minutes on Kaggle for the 7.5 s demo, about 20 minutes per 45 s video.

## Improvement backlog (pick from the top, agree the pick with the owner)

Ordered by how much a viewer would notice. Each item names how to prove it worked.

0. *(Done in v1.1.0: items 6 + 7, light and grade + skin and materials; god rays added in v1.12.0.)*
   *(Done: item 2, sets: Rome v1.2.0, Indus v1.3.0, Egypt v1.4.0, Persia v1.5.0, farm v1.6.0. The loose `props*.js` builders
   were not redone: upgrade a prop when a video first needs it, with the set materials.)*
1. *(Done in v1.7.0: lip-sync, `lipsync.js` + `probe_lips.mjs`.)* **Lip-sync to the voice.** The mouth only follows a hand-made face timeline. Drive `face({open, oh, wide})`
   from the Kokoro word timings (`src/vo_X.js`) with simple vowel/consonant shapes, plus jaw follow-through.
   *Proof:* face close-up clip with the voice; check mouth shapes against the audio frame by frame.
2. **Sets beyond the Nile.** January videos cover other eras and places. `rome.js`, `persia.js`, `egypt.js`,
   `farm2.js` and `props*.js` are still at the old quality: give them the v2 treatment (detail textures, rounded
   edges, wind, grounding, cache keys). *Proof:* one test shot per set, plus `probe_qa.mjs` grounding.
3. *(Done in v1.8.0: `F.hold`/`F.grasp`, `probe_grasp.mjs`, the hand bench.)* **Hands.** Finger curl that wraps around ropes, handles and tools, contact checked by a probe, and relaxed
   hands that aren't stiff. *Proof:* hand probe under 6 cm while gripping, plus close-up stills.
4. *(Done in v1.9.0: `sim.js` bakeRope/bakeHem, `probe_simrope.mjs`.)* **Rope and cloth as real simulation.** A verlet chain for ropes (sag, swing, slack when let go) and a baked
   cloth table for the kilt hem, both simulated once at build time so frames stay pure functions of time.
   *Proof:* probes for rope through hands or bucket, pop scan.
5. *(Done: rings, foam, splash and wet ground in v1.3.1-v1.4.0; caustics in v1.10.0.)* **Water interaction.** Impact ripple rings, splash particles and spray, caustics on the shallows, and wet
   darkening that dries over time. *Proof:* dense stills around the splash, no bloom haze.
6. **Light and grade.** Sky environment lighting (PMREM) for softer fill, a rim light for the character, a gentle
   film look (subtle grain, vignette, one shared colour grade), and optional god rays.
   *Proof:* before/after stills side by side, highlights not clipping.
7. **Skin and materials.** Wrap lighting or a cheap subsurface term so skin isn't plastic, slight roughness
   variation on clay, wood and linen.
8. *(Done in v1.11.0: `crowd.js`, scale-aware IK, `probe_crowd.mjs`.)* **Crowds and extras.** Reuse `toon.js` with different builds, skin tones, clothes and faces for background people,
   driven by simple loops. *Proof:* bucket and body probes extended to all characters.
9. *(Done in v1.11.0 + v1.13.0: adaptive motion blur and JPEG frame capture, 1.7x faster on Kaggle. Static shadow-map caching not
   done: every scene has moving characters casting shadows, so the map has to be redrawn each sub-frame.)* **Speed.** Adaptive motion blur (fewer samples on slow shots, more on fast ones), and caching static shadow maps,
   so more videos fit in the 6 Kaggle hours.
10. *(Done in v1.9.0: `scripts/qa.py`.)* **One-command QA.** A single script that runs every probe, the pop scan and the stills sheet and prints
    PASS/FAIL, so no check is skipped.

## Next backlog (agreed with the owner, 22 Nov 2026)

The owner picked the order: items A-C first, then D-E, then F. Same rules as above (test scenes only, full QA via
`scripts/qa.py`, a short clip per item, docs, merge). The owner will use the newest version from January; when they say
they are starting January content, move the channel pins (see "Channels stay pinned") to the latest release.

A. *(Done in v1.14.0: folds, shoulders, belt, leg drape and push, creases, `probe_cloth.mjs`, cloth bench `shots_cl.js`.)*
   **Cloth folds.** Tunics and kilts are smooth shells (boxy shoulders in close-ups, only the hem swings). Folds and
   wrinkles that follow the body (bump/normal detail plus a few modelled folds at the belt, elbows and knees).
   *Proof:* close-up stills front and side, kilt probe, palm-vs-cloth probe.
B. **Hair and beards.** Hair is a smooth cap. A few hairstyles (short curls, braids, shaved with a fringe, a headcloth)
   and beards, seeded per character so crowds vary. *Proof:* face bench (`shots_ft.js`) stills, no hair through hats.
C. **Hands up close.** The palm is still an egg (mittens). Knuckles, a flatter, squarer palm, nails, finger pads.
   *Proof:* hand bench (`shots_hb.js`) before/after, `probe_grasp.mjs`.
D. **More ways to move.** Walking only in straight lines: turns, starts and stops, sitting, kneeling, running, steps.
   *Proof:* `probe_crowd.mjs` (skating, crossed legs) on each move.
E. **Carrying and handling.** Jar on the head, basket on the shoulder, picking up, putting down, handing over.
   *Proof:* `probe_grasp.mjs`, no prop floating or through bodies.
F. **Automatic framing checks.** Most test scenes needed manual camera fixes (cropped heads, faces hidden). A probe that
   flags a cropped head, a face turned away or a subject out of frame, run by `qa.py`.
Later: indoor scenes and firelight, animals, rivers and seas, weather (dust, smoke, rain), a faster crowd ground lookup
(crowd scenes render at 4 s a frame on Kaggle), code-made footsteps on sand, stone and water, a tongue and lower teeth.

Render farm: since 22 Nov the GitHub farm (the-ai-frontier-media, render-farm branch) also captures JPEG 98 frames. Test
(run 132, job `style3d-farmjpeg-hands`, against run 127 with PNG, same job): 18.6 min against 22.2 min end to end, but the
rendering itself took the same (139 against 141 runner-minutes, slowest chunk 9:20 against 9:28): the farm renders on the
CPU, where a frame takes about a minute and the screenshot is a small part of it. The 3.6 min saved came from joining
(43 s against 62 s) and above all publishing to the render-out branch (7:17 against 10:18), which varies run to run. The
video matches (43.1 dB average PSNR, 41.9 minimum, visually identical; both pass the pop scan). JPEG stays on; the farm's
slowest step is now pushing to the big render-out branch.

## How to work on an item

1. Set up as in `STYLE.md` → Setup (three.js r169, engine copy, Playwright).
2. Change the engine here in `engine/src/`, test with quick stills (`?mb=1`, 720p, SwiftShader) and the face bench
   (`shots_ft.js`) after any face change.
3. Run the full QA, then a short motion-blurred clip on Kaggle:
   `KAGGLE_OWNER=<Kaggle username> JOB_REPO=<job repo> KAGGLE_API_TOKEN=proxy-injected python3 -I kaggle/kaggle_job.py <job>`
   (the values are in the channels' rules files in video-studio; the token is a network secret on the owner's
   cloud environment, never in chat or code; the job zip goes in `kaggle/` on the `render-farm` branch; see `kaggle/README.md`).
4. Send the clip with SendUserFile. Wait for the owner's verdict before moving on.
5. Write what you learned in `STYLE.md` → Lessons, and update this file.

## Session log

- **20 Nov 2026:** v1.0.0 released and moved here from video-studio. Kaggle renderer working (EGL onto NVIDIA).
  The backlog above was written for the next session; no item started yet.
- **20 Nov 2026 (session 2):** Baseline stills of v1.0.0. Found and fixed the rope bug and the out-of-reach grips
  (v1.0.1, full QA, Kaggle render of the demo in 286 s, earshot launch-grade). Recommended items 6 + 7 over lip-sync:
  the voice is an off-screen narrator, so a talking farmer would mouth someone else's voice. The owner agreed to 6 + 7.
- **21 Nov 2026:** v1.1.0 (items 6 + 7). The skin's flat look was chroma, not light: the v1.0 albedo is about 8:1 red to
  blue in linear light; turning fill and rim up and down barely changed it, a grey test showed the shape was there.
  Full QA passed (all probes unchanged from v1.0.1, face bench, stills every 0.25 s, pop scan, earshot launch-grade,
  clipped pixels 0.38% vs 0.39%). Kaggle: 0.82 s a frame vs 0.79, so the shading is nearly free.
- **21 Nov 2026 (session 2, cont.):** Owner liked v1.1.0 and picked item 2 (sets), Rome first, since 3 of the 5 January
  videos are Greco-Roman. Built v1.2.0. QA caught and fixed: floating amphorae (loose bounding box), grass floating
  on a coarse ground mesh, palms inside the tunic's skirt, and a row of white dots on a door lintel. The dots took a
  long bisection: not shadows, lights, AO, DOF or reflections, but bump mapping on an edge-on face, now guarded in
  the engine. Shaduf demo unchanged (stills match v1.1 within render noise, all probes identical).
- **21 Nov 2026:** Owner's verdict on v1.2.0: likes the look of the Roman street. Next in item 2: Egypt (`egypt.js`).
- **21 Nov 2026 (cont.):** Owner chose the Indus set next (the Mohenjo-daro video is the first January post). Built
  v1.3.0 on roman.js's shared tools. QA caught: weeds floating 15 cm (a ground mesh added after the last matrix update
  raycast at the origin), palms against the kilt's flare, a worker who read as turning his back (head bowed too far),
  and water hidden in the drain's shadow. Kaggle: 0.68 s a frame. Kaggle's one-pass loudness gave -15.4 LUFS; the mix was
  remastered to -14 with the two-pass chain.
- **21 Nov 2026 (cont.):** Owner: the water in the Indus clip has to be fixed (a milky rod pouring onto flat paint). Built
  `water.js` (flowing surface with impact rings and foam, see-through tapering stream with streaks, splash droplets)
  and a thick-walled pipe. Also asked whether these sets are what future videos build on: yes, the set builders and
  materials are; the short test scenes are demos.
- **21 Nov 2026 (cont.):** Owner likes the water. Asked about Kaggle: it works; Saturday's quota reset crowds the shared
  GPU queue, so test clips now go to Kaggle and the farm at the same time and the first one back is used. Built v1.4.0
  (Egypt): materials, upgraded builders, `egyptSite`, a pouring scene with a wet patch. QA caught a pyramid that read as
  a wall (too close), polka-dot sand again, a wet patch that read as a glowing puddle, and a wet patch never added to the
  scene (a swallowing comment, now caught by `swallow_scan.py`).
- **21 Nov 2026 (cont.):** Owner happy with Egypt; carried on with Persia (v1.5.0): kahgel/adobe/desert/stone materials,
  upgraded builders, a Yazd lane with windcatchers and a jub fed by a spout, a worker filling a jar. QA caught a close-up
  shot from behind the worker (his back filled the frame), the jar's water disc poking through its neck, and a held jar
  listed as a grounded prop.
- **21 Nov 2026 (cont.):** Owner happy with Persia; finished item 2 with the farm (v1.6.0): paddy materials, a conical hat,
  `paddySite()` (flooded plots, dikes, rice rows, stilted hut, broadleaf trees, carp), a farmer watching carp swim past.
  QA caught a face hidden by the hat brim (head bowed too far), trees that read as beige rock piles, a back light's glint
  on the water over the carp, a background carp swimming across the lens, the hero carp swimming into a dike, and tree
  crowns the probe saw floating (their offset now lives in the geometry).
- **21 Nov 2026 (cont.):** Owner asked for items 1, 3 and 4 in order. Item 1, lip-sync (v1.7.0): Kokoro's per-sound timings
  exported (`kokoro_say.py`, `plan_vo.py`), `lipsync.js` (shapes per sound, co-articulation, jaw lag, closures held two
  frames), `face({ speech })`, `probe_lips.mjs`, a Roman worker talking to camera. QA caught the mouth's dark fill hidden
  behind the hollow's skin, a stretched m eating the o of "Rome", f leaving the jaw open, a comment swallowing the loop that
  builds the mouth opening (caught by `swallow_scan.py`), and palms turned to the camera on hanging arms.
- **21 Nov 2026 (cont.):** Item 3, hands (v1.8.0): three-joint fingers, a two-joint thumb posed by direction, a flatter palm,
  a relaxed cascade, `F.hold()` and `F.grasp()` (each joint closes until it touches the tool), `probe_grasp.mjs` and a
  hand bench (`shots_hb.js`); a mason with chisel and mallet. QA caught the left arm 6 cm short of the chisel, the mallet
  held like a sword (wrist bent 170 degrees), the thumb poking out of the back of the hand (there since v1.0), a thumb
  starting inside a thick handle, blows timed between frames (the mallet never seen touching the chisel), and two more
  comments that swallowed code (caught by `swallow_scan.py`). Kaggle queued for 90 minutes; the GitHub farm rendered it.
- **21 Nov 2026 (cont.):** Item 4, rope and cloth (v1.9.0): `sim.js` (a baked verlet rope with pins, body capsules and
  ground friction; the kilt hem as a pendulum driven by the hips), `probe_simrope.mjs`, a hauler who lets go of a sledge
  rope. QA caught a wide shot that missed the hauler, the rope's tail starting in a knot, the slack rope lying through
  his sandals (feet now collide), arms 14 cm short of the grips while leaning back, the rope between the fists
  stretched 47% (length rounded down), a rope that fell like a feather (damping per step too strong), a palm against the
  kilt, wrists bent 83 degrees (rope along the forearms: elbows now out), the rope coiled round a sandal, collision
  pushes that flung the rope or let it creep 1.3 m, and feet that skated on the sand (now planted in world space).
  Item 10 started alongside: `scripts/qa.py` runs every applicable check in one command.
- **22 Nov 2026 (overnight):** Item 5 finished with caustics (v1.10.0): `causticsMaterial()` on the jub floor, see-through
  jub water, running water and pour sounds in `make_ambience.py`, a midday jub test scene. QA found the jub in the wall's
  shadow (no caustics: a dedicated scene with the sun along the channel), opaque water hiding the bed, and two looks that
  didn't read as caustics (worms, then cracked tiles) before the curved, uneven net.
- **22 Nov 2026 (overnight, cont.):** Item 8, crowds (v1.11.0): `crowd.js` (seeded extras of different heights and looks,
  walking and chatting loops), scale-aware IK in toon.js, `probe_crowd.mjs`, a crowd murmur in `make_ambience.py`, a
  Roman street with five extras. QA caught a wide shot too narrow for both pavements, a close shot looking into empty
  desert, a walker passing in front of the camera, and feet skating 5 mm a frame (a stride longer than the legs reach).
  Item 9 in the same release: adaptive motion blur (sub-frames from on-screen motion), measured on Kaggle (8% faster on
  the busy demo at 44 dB PSNR; calm scenes use about half the sub-frames). `probe_rome.mjs` now checks the lower foot of
  a walker (the other one swings).
- **22 Nov 2026 (overnight, cont.):** God rays (v1.12.0), the optional part of item 6: an opt-in rays pass in main.js and a
  colonnade test scene. QA caught rays that washed the whole sky (threshold now only the sun), a first camera with nothing
  in front of the sun, and a walker who stayed out of frame. A crowd mix failed earshot because the music bed rings out
  at its end (now made longer and cut). The god-ray close-up also showed the crowd walkers' legs crossing on every step (a flipped
  side vector in `walk()`): fixed, a crossed-legs check added to `probe_crowd.mjs`, and the crowd clip rendered again.
- **22 Nov 2026 (overnight, cont.):** Item 9 again (v1.13.0): the speed test showed most of a GPU frame's time is not the
  3D render, and a full-HD PNG screenshot turned out to take 2.4 s on the CPU container against 79 ms for JPEG 98 (50.7 dB
  PSNR, visually lossless). Kaggle now captures JPEG 98: the demo renders at 0.45 s a frame (0.77 before v1.11), 1.7x
  faster, so the weekly 6 Kaggle hours now cover far more video. Chatting extras lip-sync made-up speech (`babble`).
- **22 Nov 2026 (overnight, cont.):** v1.13.1: `qa.py` runs the shaduf demo's probes and reads formula durations and cuts
  from the page, so every test scene (including the demo) is covered by the one command.
- **22 Nov 2026 (session 3):** The owner agreed a new backlog (A-F) and asked for A-C first. Checked the farm's JPEG test
  first (run 132 vs 127, see "Render farm" above: same video, the render time unchanged, the saving was in publishing).
  Item A, cloth folds (v1.14.0): fold fields on every garment, a shoulder that rounds into the sleeve, a belt laid on
  cloth cinched to the body, legs that drape and push the skirt in the shader, linen creases, `probe_cloth.mjs`, a cloth
  bench (`shots_cl.js`) and a test scene (`shots_cf.js`). QA caught: a belt floating 4 cm off the back (then 8 mm, from an
  angle measured before scaling), a hole behind a raised arm and the arm's cap through the shoulder (weights, then a
  rounding that pulled cloth into the skin), z-fighting between the sleeve and the shell, creases that stepped in 2x2-pixel
  blocks, a raised thigh splitting the skirt, cloth pushed in between the legs, a probe blind to all this until it was
  given the right bones and layers and proved on a broken copy, two swallowed lines (the scan now knows destructuring),
  and probes reading a stale skin pose for people of a shot not on screen.
