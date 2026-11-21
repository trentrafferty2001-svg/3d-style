# Changelog

Versions are pinned by commit (tags can't be pushed from the cloud sessions; the owner may add matching tags on
GitHub). Use the full commit id in a channel's rules file.

## v1.6.0 (21 Nov 2026) = commit 27e99269b5a60d3470e3bad46643e943bd019d5f
Farm set: rice-fish paddies (backlog item 2, fifth and last set; item 2 is complete). The channels stay on v1.0.0 until
the owner moves them.

- `farm2.js`: code-made paddy materials (`farmMats`: wet mud, grassy dike earth, thatch, a far rice carpet, wood, hills),
  `conicalHat(F)` and `paddyFarmer()`; `paddySite({ seed, impacts, clear })` (flooded plots between rounded dikes,
  see-through water with rings at the shins, rice rows, stilted hut, broadleaf trees, hills, carp swimming in lanes; layout
  in `FS`, `paddyHeightAt`); `clear` takes circles or boxes. The old builders (`riceClumps`, `carp`, ...) are unchanged.
- `water.js`: `flowWaterMaterial` takes `opacity`. `roman.js`: `oliveGeo(seed, { cols, n, spread })` for other trees.
- Test scene `shots_fa.js`.

## v1.5.0 (21 Nov 2026) = commit 167a87133dcf28fa0befcbb72899882f1eacbf04
Persia set (backlog item 2, fourth set). The channels stay on v1.0.0 until the owner moves them.

- `persia.js`: code-made kahgel, adobe, desert and stone (`persiaMats`, same keys plus adobe/stone/wood/metal); the
  builders (yakhchal whole and cut-away, shade wall, freezing channel, qanat wells, desert ground) upgraded with round and
  world-scale UVs (same API); `palm()` returns the Nile set's swaying palm (`palmOld` kept); `persiaSite()` (a Yazd lane:
  windcatchers, doors in arched niches, dome, yakhchal, palms, a jub fed by a stone spout) and `persianWorker2()`.
- `water.js`: `flowWaterMaterial` impact strength (`userData.uImp`) so rings and foam fade when nothing lands.
- `indus.js` exports `cylUV`. Test scene `shots_pe.js`.

## v1.4.0 (21 Nov 2026) = commit 6a5d0370935029151622b25347aef37ac572ed8c
Egypt set (backlog item 2, third set). The channels stay on v1.0.0 until the owner moves them.

- `egypt.js`: code-made materials (`egyptMats`: core limestone, Tura casing, mud brick, desert sand, red clay); the
  builders (pyramid, ramp, quarry, barge, sledge, jar, steep ramp, tomb, Nile) upgraded with them, rounded blocks and
  world-scale UVs (same API; old `egyptian()` kept for old shot files); `egyptSite()` (work site, distant pyramid and
  ramp, blocks, Nile fields and palms) and `egyptWorker()`.
- `water.js`: `wetPatch()` (damp ground that spreads), `liveStream()` (a stream rebuilt each frame); see-through splash.
- QA: `swallow_scan.py` (code hidden behind a `//` comment); `probe_rome.mjs` checks every character (`_FS`) and skips
  `noGround` effects. Test scene `shots_eg.js`.

## v1.3.1 (21 Nov 2026) = commit afdc60ca1e3df75a91d4645544a345022620f5d7
Water fix requested by the owner (the Indus drain's water read as a milky rod onto flat paint). Channels stay on v1.0.0.

- `water.js` (new, reusable): `flowWaterMaterial` (ripples carried along a flow, impact rings, foam at the landing
  point with a thin wake, murky body, controllable reflections), `streamMaterial` (see-through tapering stream with
  bright edges, streaks and break-up), `splash` (seeded droplets, pure function of time).
- `indus.js`: the drain uses them; the stream leaves the pipe's lip in a parabola and lands on the foam; the pipe has an
  inner bore and a rim. `probe_rome.mjs` skips airborne effects (`userData.noGround`).

## v1.3.0 (21 Nov 2026) = commit 4f243cb8cf3c9e37078d086ff10992b5ca1f9492
Indus set (backlog item 2, second set). The channels stay on v1.0.0 until the owner moves them.

- `indus.js`: a Mohenjo-daro lane. Fired brick in English bond, packed earth, mud plaster, painted pots; a covered brick
  drain with water and one lifted cover; a terracotta pipe from an upper floor with a pouring stream; doorways,
  windows and beam ends; a well square with a round wedge-brick well; a pipal tree; weeds; `indusWorker()`.
- `roman.js`: shared texture, geometry and vegetation helpers exported; `groundAt` refreshes ground matrices
  (a mesh added late raycast at the origin).
- `kokoro_say.py`: Mohenjo-daro pronunciation. Test scene `shots_in.js`.

## v1.2.0 (21 Nov 2026) = commit 64f49d79b43e21e0bb20f5292ee3326817146541
Roman set (backlog item 2, first set). The channels stay on v1.0.0 until the owner moves them.

- `roman.js`: detailed code-made Roman materials (travertine ashlar, brick, basalt paving, marble or stucco, plaster,
  wood, roof tiles, dusty ground), `worldUV`, rounded `block`, fluted `column2`, `amphora`, `settle`, and `romanSite()`,
  a Roman street with portico, shops, olive, cypresses and umbrella pines in the wind, all grounded; `romanWorker()`.
- Character: `toon({ outfit: 'tunic' })`, a belted wool tunic that follows the body (loose shell, skirt on the kilt bone, sleeves).
- `rome.js`: Pantheon, aqueduct, formwork, trough and columns rebuilt with the new materials and world-scale UVs (same API).
- Engine: bump-normal guard in `main.js` (edge-on faces made white sparkles); `nile.js` exports its wind helpers.
- QA: `probe_rome.mjs`, `sparkle_scan.py`, `make_ambience.py`; test scene `shots_rm.js`. The shaduf demo is unchanged.

## v1.1.0 (21 Nov 2026) = commit 9d7718b562eceac2e1c096d2d82b69a2a3c167d8
New look features (backlog items 6 + 7). The channels stay on v1.0.0 until the owner moves them.

- Skin (`toon.js` `skinShading`, settings in `SKIN`): wrap lighting with a warm subsurface term, warm sky light and
  reflections on skin, a soft view rim, slight roughness variation, albedo desaturated in linear light (`sat: 0.56`).
  Sheen 0.5 to 0.2. Inner ears share the shading and follow the skin tone.
- Surfaces: roughness maps on wood and clay (`nile.js` `roughTex`) and the kilt's linen, average roughness unchanged.
- Film grain once per output frame (`main.js`, `STYLE.grain`, default 0.022, `?grain=0` turns it off).

## v1.0.1 (20 Nov 2026) = commit d8f962507d15953200ef6eea03366f8a18e8033b
Fixes. The channels stay on v1.0.0 until the owner moves them.

- Rope: it now tilts with the bucket's swing (`nile.js`; the rotation was stuck inside a comment, so the rope hung
  straight down and ended up to 40 cm from the bail while the bucket swung).
- Demo hands: grab and let-go heights and starting grips moved so every grip is within the arm's reach
  (`shots_dm.js`; palms were up to 8.3 cm off the rope at full stretch, now at most 5.6 cm, the palm's own offset).
- QA: `probe_rope.mjs`, grip-aware `probe_hands.mjs` with a PASS line, `pop_scan.py`.

## v1.0.0 (20 Nov 2026) = commit 9df268009364ad0306a48d02f21ba89bcec7ffcc
First release, moved from `tools/style-v2/` and `tools/kaggle-render/` in video-studio.

- Engine: springs, anticipation and overshoot; 30 fps sub-frame motion blur with jittered antialiasing; PCF soft
  shadows; GTAO; NaN-safe bloom; planar water reflections via per-frame prerender hooks; shader cache keys for
  parameterised materials.
- Character (`toon.js`): smooth skinned body, kilt with pendulum swing and linen flutter, face rig (eyes with lids,
  lash lines and a natural gaze limit; shaped lips and individual teeth in a sculpted mouth hollow; brows; ears), IK.
- Set (`nile.js`): sculpted terrain with detail textures, mud-brick platform, shaduf, swaying grass, papyrus and palms,
  pebbles, reflective river with shallows tint and shore foam.
- QA: grounding, feet, hands, bucket-vs-body, hands-on-hips and kilt probes; face test bench; framing search.
- Kaggle: free T4 GPU renderer (EGL onto NVIDIA's driver), one-command job runner. About 6× faster than the
  20-runner GitHub farm.
