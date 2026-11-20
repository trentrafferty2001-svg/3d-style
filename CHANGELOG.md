# Changelog

Versions are pinned by commit (tags can't be pushed from the cloud sessions; the owner may add matching tags on
GitHub). Use the full commit id in a channel's rules file.

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
