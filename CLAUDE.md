# CLAUDE.md

This repo is the owner's 3D cartoon video style. Ancient Explained and The Explainer both use it for videos from
January 2027 (their pipelines live in the private repo `trentrafferty2001-svg/video-studio`; their rules files say which
version of this repo to use).

- Improving the style (not making a channel video)? Read `IMPROVEMENTS.md` first: rules, status and the backlog.
- Read `STYLE.md` first: setup, how to make a video, the QA checklist and lessons learned.
- Free providers only. Render on Kaggle's free GPU (`kaggle/README.md`); fall back to the GitHub farm when the weekly
  Kaggle GPU quota (6 hours, shared by both channels) is used up.
- Before any final render, pass the QA in `STYLE.md` (probes, face test bench after face changes, stills every 0.25 s
  viewed large, the pop scan, `earshot critique`). Nothing ships with floating objects, hands through bodies or pops.
- Never commit renders, audio, `node_modules` or keys. No personal details in code: the Kaggle username and the job
  repo come from environment variables.
- Changes: fix and improve here, then add the release to `CHANGELOG.md` with its version (`v1.0.1` for fixes, `v1.1.0` for
  new features) and full commit id. Tag pushes are blocked from the cloud sessions, so versions are pinned by commit.
  Tell the owner which channels should move to the new commit; their rules files pin it.
- The owner allows Claude to merge its own pull requests here when they merge cleanly.
