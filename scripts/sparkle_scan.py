#!/usr/bin/env python3
"""Sparkle scan: isolated near-white pixels in stills (shading blow-ups such as edge-on bump normals, NaN-ish
highlights). A pixel is a sparkle when its brightest channel is >= 245 and the median of its 7x7 neighbourhood is
under 150 (a sunlit wall has bright neighbours); pixels next to pure black (caption strokes) are skipped. Run it on dense stills rendered with ?nodof
(depth of field spreads a sparkle into a disc), e.g. QS='mb=1&nodof'.
Eye catchlights (the highlight in each pupil) are a pixel or two per eye, hence the default allowance of 4 a still;
the lintel glint this scan was written for was 25. Look at any flagged still.
usage: sparkle_scan.py <stills dir> [max allowed per still = 4]"""
import glob, os, subprocess, sys
import numpy as np
from scipy.ndimage import median_filter, minimum_filter

d = sys.argv[1]; allow = int(sys.argv[2]) if len(sys.argv) > 2 else 4
fs = sorted(glob.glob(os.path.join(d, 't_*.png')), key=lambda f: float(os.path.basename(f)[2:-4]))
bad = 0
for f in fs:
    w, h = map(int, subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout.strip().split(','))
    a = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout, np.uint8).reshape(h, w, 3)
    m = a.max(2).astype(np.float32); med = median_filter(m, size=7)
    # caption glyphs are white with a near-black stroke: skip pixels that have pure black within 4 px
    ys, xs = np.where((m >= 245) & (med < 150) & (minimum_filter(m, size=9) > 14)); n = len(ys)
    if n > allow:
        bad += 1; print(f'{os.path.basename(f)}: {n} sparkle pixels, e.g. at x,y {list(zip(xs[:6].tolist(), ys[:6].tolist()))}')
print(f'{len(fs)} stills, {bad} with sparkles -> ' + ('PASS' if bad == 0 else 'FAIL'))
