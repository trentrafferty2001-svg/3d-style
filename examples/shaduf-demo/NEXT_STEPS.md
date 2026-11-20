# Shaduf demo (style v2 showcase)

7.5 s, 1080x1920, 30 fps, motion blur (mb=6). Not scheduled for posting: it is the reference for the v2 look.

Script (Kokoro af_heart, speed 1.0):
1. "How do you lift water out of a river all day, with just your arms?"
2. "But on the Nile, a lump of mud did the lifting."

Timeline: cut 3.895 s, splash 1.453 s (on "river"), release 4.72 s (end of "Nile"), bucket leaves the water 5.03 s,
pole overshoot peak 6.03 s ("lifting"), end 7.5 s (0.7 s after the last word).

Rebuild: engine in `../../engine` (main.js already points at shots_dm.js). Voice: `kokoro_say.py` with
`lines_dm.json`, then `plan_vo.py dm`. Sound: `make_audio_dm.py plan_dm.json events_dm.json mix_dm.wav`.
Render: `render30.sh` with 15-frame blocks b00..b14 (frames 0-225), join, mux with the mix at -14 LUFS.
