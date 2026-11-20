#!/usr/bin/env python3
"""Contact sheets of stills: sheet.py <dir> [per_sheet=16] [cols=8] -> <dir>/sheetN.jpg (timestamp labels)."""
import glob, os, subprocess, sys

d = sys.argv[1]
per = int(sys.argv[2]) if len(sys.argv) > 2 else 16
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 8
fs = sorted(glob.glob(os.path.join(d, 't_*.png')), key=lambda f: float(os.path.basename(f)[2:-4]))
for k in range(0, len(fs), per):
    chunk = fs[k:k + per]
    if len(chunk) == 1:
        chunk = chunk * 2
    args = []
    for f in chunk:
        args += ['-i', f]
    n = len(chunk)
    flt = ''.join(
        f"[{i}:v]scale=240:-1,drawtext=text='{float(os.path.basename(chunk[i])[2:-4]):.2f}':x=5:y=5:fontsize=22:fontcolor=yellow:box=1:boxcolor=black[v{i}];"
        for i in range(n))
    flt += ''.join(f'[v{i}]' for i in range(n)) + f'xstack=inputs={n}:layout=' + '|'.join(
        f'{(i % cols) * 240}_{(i // cols) * 427}' for i in range(n)) + '[o]'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *args, '-filter_complex', flt, '-map', '[o]',
                    os.path.join(d, f'sheet{k // per}.jpg')], check=True)
print('sheets:', (len(fs) + per - 1) // per)
