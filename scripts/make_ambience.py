#!/usr/bin/env python3
"""Code-made outdoor ambience for test scenes (free, no samples): soft wind, optional cicadas and a few distant birds,
plus optional one-shot WAVs placed at given times (e.g. an earshot whoosh on a cut).
usage: make_ambience.py out.wav DURATION [--cicadas] [--birds N] [--seed S] [--at time:file.wav[:gain_db]] ...
Writes 48 kHz stereo, peak-normalised to -3 dBFS (master to -14 LUFS afterwards, e.g. the Kaggle job does)."""
import sys, numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

args = sys.argv[1:]
out, dur = args[0], float(args[1])
SR = 48000; n = int(dur * SR); t = np.arange(n) / SR
seed = int(args[args.index('--seed') + 1]) if '--seed' in args else 1
nb = int(args[args.index('--birds') + 1]) if '--birds' in args else 0
rng = np.random.default_rng(seed)
bp = lambda x, lo, hi, o=2: sosfilt(butter(o, [lo, hi], 'bandpass', fs=SR, output='sos'), x)
lp = lambda x, f, o=2: sosfilt(butter(o, f, 'lowpass', fs=SR, output='sos'), x)
lfo = lambda f, ph: 0.5 + 0.5 * np.sin(2 * np.pi * f * t + ph)
mix = np.zeros((n, 2))
# wind: low noise that breathes slowly, decorrelated left/right
for c in range(2):
    w = lp(rng.standard_normal(n), 380) * (0.45 + 0.55 * lfo(0.13, c * 1.3) * lfo(0.07, 2 + c))
    mix[:, c] += 0.5 * w / (np.abs(w).max() + 1e-9)
# cicadas: a pulsed high buzz that swells, a little to one side
if '--cicadas' in args:
    z = bp(rng.standard_normal(n), 4200, 6800, 3) * (0.55 + 0.45 * np.sign(np.sin(2 * np.pi * 42 * t))) * (0.6 + 0.4 * lfo(0.21, 0.5))
    z = 0.09 * z / (np.abs(z).max() + 1e-9); mix[:, 0] += z * 0.8; mix[:, 1] += z * 0.5
# birds: short chirps (falling or rising sweeps with a little vibrato), far away and panned
for k in range(nb):
    t0 = rng.uniform(0.2, max(0.3, dur - 0.5)); f0 = rng.uniform(2600, 4200); notes = rng.integers(2, 5); pan = rng.uniform(0.2, 0.8)
    for m in range(notes):
        L = rng.uniform(0.06, 0.12); i0 = int((t0 + m * (L + 0.04)) * SR); i1 = min(n, i0 + int(L * SR))
        if i0 >= n: break
        tt = np.arange(i1 - i0) / SR; f = f0 * (1 + rng.choice([-0.25, 0.3]) * tt / L) + 60 * np.sin(2 * np.pi * 38 * tt)
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / L) ** 2 * 0.05
        mix[i0:i1, 0] += s * (1 - pan); mix[i0:i1, 1] += s * pan
# one-shots
for a in [args[i + 1] for i, x in enumerate(args) if x == '--at']:
    parts = a.split(':'); at, f = float(parts[0]), parts[1]; g = 10 ** (float(parts[2]) / 20) if len(parts) > 2 else 1.0
    sr, d = wavfile.read(f); d = d.astype(np.float64); d = d / (32768.0 if d.max() > 2 else 1.0)
    if d.ndim == 1: d = np.stack([d, d], 1)
    if sr != SR: idx = np.arange(0, len(d), sr / SR).astype(int); d = d[idx[idx < len(d)]]
    i0 = int(at * SR); i1 = min(n, i0 + len(d)); mix[i0:i1] += d[:i1 - i0, :2] * g
# 20 ms fades, peak -3 dBFS
fade = np.minimum(1, np.minimum(t / 0.02, (dur - t) / 0.02))[:, None]; mix *= fade
mix *= 10 ** (-3 / 20) / (np.abs(mix).max() + 1e-9)
wavfile.write(out, SR, (mix * 32767).astype(np.int16))
print('wrote', out, f'{dur:.2f} s')
