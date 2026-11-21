# Changelog

Versions are pinned by commit (tags can't be pushed from the cloud sessions; the owner may add matching tags on
GitHub). Use the full commit id in a channel's rules file.

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
