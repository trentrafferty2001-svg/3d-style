# Changelog

## v1.0.0 (20 Nov 2026)
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
