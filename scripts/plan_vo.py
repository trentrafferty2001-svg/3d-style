"""Lay Kokoro lines on a timeline: 0.3 s gaps (0.45 before line 1), first word at 0.12 s.
usage: python3 -I plan_vo.py X   -> /home/claude/plan_X.json and /home/claude/ricefish/src/vo_X.js"""
import json, sys
x = sys.argv[1]
T = json.load(open(f'/home/claude/tts/vo_{x}/timing.json'))
place, vo, cuts, t = [], [], [], 0.12
for i, r in enumerate(T):
    if i: t = place[-1]['words'][-1][2] + (0.45 if i == 1 else 0.3); cuts.append(round(t - 0.12, 3))
    w0 = r['words'][0][1]
    words = [[w, round(a - w0 + t, 3), round(b - w0 + t, 3)] for w, a, b in r['words']]
    place.append({'wav': f'/home/claude/tts/{r["wav"]}', 'clip_offset': round(t - w0, 4), 'words': words})
    vo.append({'start': words[0][1], 'words': words, 'audioAt': round(t - w0, 4), 'phones': r.get('phones', [])})  # phones: on the line's own audio clock (lipsync.js)
json.dump({'place': place, 'cuts': cuts}, open(f'/home/claude/plan_{x}.json', 'w'))
open(f'/home/claude/ricefish/src/vo_{x}.js', 'w').write('export const VO = ' + json.dumps(vo) + ';\n')
print('speech ends', place[-1]['words'][-1][2], 'duration', round((place[-1]['words'][-1][2] + 1.5) * 24) / 24)
