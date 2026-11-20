#!/usr/bin/env python3
"""Pop scan: frame-to-frame difference of a video; any spike that is not at a cut is a bug (a pop).
usage: pop_scan.py video.mp4 [cut_seconds,...] [--fps 30]
Decodes at 270x480 grey, takes the mean absolute difference between consecutive frames, and flags a frame whose
difference is over 2.5x the median of its +-8 neighbours and above 1.5 (0-255 scale). Spikes within one frame
of a listed cut are reported as cuts. Prints PASS when the only spikes are cuts."""
import subprocess, sys
import numpy as np

args = [a for a in sys.argv[1:] if not a.startswith('--')]
fps = float(sys.argv[sys.argv.index('--fps') + 1]) if '--fps' in sys.argv else 30.0
if '--fps' in sys.argv: args.remove(sys.argv[sys.argv.index('--fps') + 1])
video = args[0]
cuts = [float(c) for c in args[1].split(',')] if len(args) > 1 and args[1] else []
W, H = 270, 480
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', video, '-vf', f'scale={W}:{H}', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'],
                     capture_output=True, check=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32)
d = np.abs(np.diff(fr, axis=0)).mean(axis=(1, 2))  # d[i] = change from frame i to i+1
bad, cut_hits = [], []
for i in range(len(d)):
    nb = np.concatenate([d[max(0, i - 8):i], d[i + 1:i + 9]])
    med = float(np.median(nb)) if len(nb) else 0.0
    if d[i] > 1.5 and d[i] > 2.5 * max(med, 0.2):
        t = (i + 1) / fps
        (cut_hits if any(abs(t - c) <= 1.5 / fps for c in cuts) else bad).append((i + 1, t, float(d[i]), med))
print(f'{len(fr)} frames, mean diff {d.mean():.2f}, max {d.max():.2f} at frame {int(d.argmax()) + 1}')
for f, t, v, m in cut_hits: print(f'  cut   frame {f} ({t:.3f} s): diff {v:.2f} vs local median {m:.2f}')
for f, t, v, m in bad: print(f'  SPIKE frame {f} ({t:.3f} s): diff {v:.2f} vs local median {m:.2f}')
print('PASS' if not bad else f'FAIL: {len(bad)} spike(s) not at a cut')
