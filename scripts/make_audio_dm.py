"""Sound for the shaduf style demo: Kokoro voice, an original Hijaz-flavoured music bed ducked under the voice,
river/wind ambience, and effects locked to the animation (pole creaks from the pole's angular speed, splash,
fill gurgle, release clunk, counterweight swoosh, pour, drips, settle creak).
usage: python3 -I make_audio_dm.py plan_dm.json events_dm.json out.wav"""
import json, sys
import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly, butter, sosfilt

SR = 44100
plan = json.load(open(sys.argv[1])); ev = json.load(open(sys.argv[2]))
DUR = ev['duration']; N = int(SR * DUR)
T_SPLASH, T_OUT = ev['splash'], ev['out']
pole = np.array(ev['pole']); pole_t = np.arange(len(pole)) / 100.0
place = plan['place']
W = {}
for li, l in enumerate(place):
    for w, a, b in l['words']:
        W.setdefault((li, w.lower().strip('?,.')), []).append(a)
at = lambda li, w, k=0: W[(li, w)][k]
T_REL = at(1, 'nile') + 0.3
CUT = place[1]['words'][0][1] - 0.2
rng = np.random.default_rng(11)

def track(): return np.zeros(N)
def track2(): return np.zeros((2, N))
def add2(buf, sig, t, gain=1.0, pan=0.0):
    # constant-power pan: -1 left .. +1 right
    a = (pan + 1) * np.pi / 4
    add(buf[0], sig, t, gain * np.cos(a)); add(buf[1], sig, t, gain * np.sin(a))
def add(buf, sig, t, gain=1.0):
    i = int(round(t * SR))
    if i < 0: sig = sig[-i:]; i = 0
    j = min(N, i + len(sig))
    if i < N and j > i: buf[i:j] += sig[: j - i] * gain
def load(name):
    sr, x = wavfile.read(f'/home/claude/sfx_dm/{name}.wav')
    x = x.astype(np.float64)
    x /= (2 ** 31 if x.dtype == np.int32 or np.abs(x).max() > 40000 else 32768)
    if x.ndim > 1: x = x.mean(axis=1)
    if sr != SR: x = resample_poly(x, SR, sr)
    return x / (np.abs(x).max() + 1e-9)
def band(x, lo, hi, order=4):
    sos = butter(order, [lo, hi], btype='band', fs=SR, output='sos'); return sosfilt(sos, x)
def lowp(x, f, order=4):
    sos = butter(order, f, btype='low', fs=SR, output='sos'); return sosfilt(sos, x)
def env(n, a=0.005, d=0.4):
    t = np.arange(n) / SR; return np.minimum(1, t / a) * np.exp(-t / d)
def fade(x, a=0.05, r=0.1):
    n = len(x); e = np.ones(n); na, nr = int(a * SR), int(r * SR)
    if na: e[:na] = np.linspace(0, 1, na)
    if nr: e[-nr:] = np.minimum(e[-nr:], np.linspace(1, 0, nr))
    return x * e

# ---------------- voice ----------------
vo = track()
for l in place:
    sr, x = wavfile.read(l['wav']); x = x.astype(np.float32) / 32768
    if sr != SR: x = resample_poly(x, SR, sr)
    add(vo, x, l['clip_offset'])
speech = np.abs(vo) > 0.01
vo *= 0.17 / (np.sqrt(np.mean(vo[speech] ** 2)) + 1e-9)
# ducking envelope from the voice
lvl = np.abs(vo); duck = np.zeros(N); acc = 0.0
a_att, a_rel = np.exp(-64 / (0.03 * SR)), np.exp(-64 / (0.3 * SR))
for i in range(0, N, 64):
    v = lvl[i:i + 64].max(); acc = v + (acc - v) * (a_att if v > acc else a_rel); duck[i:i + 64] = acc
duck = 1.0 - 0.55 * np.clip(duck / 0.08, 0, 1)

# ---------------- music: D Hijaz, oud-like plucks, soft frame drum, drone ----------------
mus = track()
D = 146.83
hij = [1, 16 / 15, 5 / 4, 4 / 3, 3 / 2, 8 / 5, 9 / 5, 2]  # D Eb F# G A Bb C D
def oud(f, dur=0.6, vol=0.1):
    n = int(dur * SR); t = np.arange(n) / SR
    # Karplus-Strong-ish: decaying harmonics with a bright attack and slight pitch bend down
    s = sum((0.9 ** k) * np.sin(2 * np.pi * f * k * t * (1 - 0.002 * np.exp(-t * 30))) * np.exp(-t * (2.5 + k * 1.6)) for k in range(1, 8))
    s += 0.3 * band(rng.standard_normal(n), 1500, 5000) * np.exp(-t * 60)
    return lowp(s, 3800) * np.minimum(1, t / 0.003) * vol
def drum(vol=0.15, low=True):
    n = int(0.35 * SR); t = np.arange(n) / SR
    f = (95 if low else 210) * np.exp(-t * 9) + (55 if low else 160)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * (9 if low else 22))
    s += band(rng.standard_normal(n), 300, 2500) * np.exp(-t * 45) * 0.4
    return s * vol
def drone(f, dur, vol=0.03):
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 2.003 * t) + 0.25 * np.sin(2 * np.pi * f * 3 * t + 1)
    return s * np.minimum(1, t / 0.6) * np.minimum(1, (dur - t) / 0.8) * vol
bpm = 96; beat = 60 / bpm
melody = [0, 2, 1, 2, 3, 2, 1, 0, 4, 3, 2, 3, 1, 2, 0, 0]
t = 0.05; k = 0
while t < DUR - 0.8:
    if not (CUT - 0.3 < t < CUT + 0.05):  # tiny breath at the cut
        add(mus, oud(D * hij[melody[k % len(melody)]], 0.7, 0.07 if t < CUT else 0.085), t)
        if k % 2 == 0: add(mus, drum(0.11, low=(k % 4 == 0)), t)
        if k % 4 == 3: add(mus, drum(0.06, low=False), t + beat / 2)
    t += beat / 2; k += 1
add(mus, drone(D / 2, CUT + 0.2, 0.035), 0.0)
add(mus, drone(D / 2, DUR - CUT, 0.04), CUT)
add(mus, drone(D * 3 / 4, DUR - CUT, 0.02), CUT)
# payoff: rising oud run into "lifting", then the tonic chord rings out
tl = at(1, 'lifting')
for i, s in enumerate([0, 2, 4, 7]): add(mus, oud(D * hij[s], 0.9, 0.06), tl - 0.32 + i * 0.08)
for s, v in [(0, 0.08), (4, 0.06), (7, 0.05)]: add(mus, oud(D * hij[s], 1.4, v), tl + 0.05)
mus *= duck

# ---------------- ambience: river lap, wind, birds ----------------
amb = track(); amb2 = track2()
for ch in (0, 1):
    lap = band(rng.standard_normal(N), 120, 900); lap *= 0.55 + 0.45 * np.sin(2 * np.pi * 0.35 * np.arange(N) / SR + ch * 1.3) ** 2
    amb2[ch] += lap / np.abs(lap).max() * 0.045
    wind = band(rng.standard_normal(N), 300, 3500); wind *= 0.6 + 0.4 * np.sin(2 * np.pi * 0.13 * np.arange(N) / SR + 1 + ch * 2.1)
    amb2[ch] += wind / np.abs(wind).max() * 0.024
def bird(t0, f0=3200, vol=0.025):
    n = int(0.16 * SR); t = np.arange(n) / SR; f = f0 + 900 * np.sin(t * 60) * np.exp(-t * 8)
    add(amb, np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.004, 0.05) * vol, t0)
for t0, f0 in [(0.6, 3400), (0.75, 3600), (2.9, 3000), (5.6, 3500), (5.72, 3700), (6.9, 3200)]: bird(t0, f0)

amb2[0] += amb * 0.8; amb2[1] += amb * 0.5

# ---------------- effects locked to the animation ----------------
sfx = track()
# pole creak: a resonant wooden groan whose loudness follows the pole's angular speed
w = np.gradient(pole, 1 / 100.0)
speed = np.interp(np.arange(N) / SR, pole_t, np.abs(w))
cr_src = np.zeros(N); period = int(SR / 95); jitter = rng.integers(-40, 40, N // period + 2)
pos = 0; k = 0
while pos < N: cr_src[pos] = 1.0; pos += period + jitter[k % len(jitter)]; k += 1  # rough glottal-like ticks = creak
creak = band(cr_src, 250, 1400) + 0.6 * band(cr_src, 1800, 3200)
creak /= np.abs(creak).max() + 1e-9
sfx += creak * np.clip(speed / 1.2, 0, 1) ** 1.5 * 0.09
# rope strain ticks on each heave (hand grabs): soft fibre squeaks
for t0 in [0.32, 0.72, 1.1]: add(sfx, band(rng.standard_normal(int(0.12 * SR)), 1200, 4000) * env(int(0.12 * SR), 0.01, 0.04), t0, 0.05)
# splash: body + crack + bubbles, then a gurgle while the bucket fills
add(sfx, lowp(rng.standard_normal(int(0.7 * SR)), 900) * env(int(0.7 * SR), 0.002, 0.16), T_SPLASH, 0.22)
add(sfx, band(rng.standard_normal(int(0.5 * SR)), 1500, 9000) * env(int(0.5 * SR), 0.001, 0.08), T_SPLASH, 0.16)
add(sfx, load('cut_hit_air'), T_SPLASH - 0.01, 0.12)
for i, nm in enumerate(['drip_bubble', 'drip_bloop', 'drip_drop', 'drip_bubble', 'drip_bloop']):
    add(sfx, load(nm), T_SPLASH + 0.12 + i * 0.13 + rng.uniform(0, 0.04), 0.07 * (1 - i * 0.12))
for i in range(14): add(sfx, load('drip_bubble'), T_SPLASH + 0.5 + i * 0.09 + rng.uniform(0, 0.05), 0.025 * (1 - i / 16))
# droplets landing back after the splash
for i in range(6): add(sfx, load('drip_tiny' if i % 2 else 'drip_tiny2'), T_SPLASH + 0.28 + i * 0.07, 0.035)
# cut: a soft air whoosh into the wide
add(sfx, load('pro_whoosh_big_windy'), CUT - 0.33, 0.07)
# release: rope slips out of the hands, wooden clunk at the pivot, counterweight swoosh down
add(sfx, load('pro_zip_down_warm'), T_REL - 0.02, 0.07)
add(sfx, load('knock_wood'), T_REL + 0.06, 0.12)
add(sfx, load('pro_whoosh_big_swell'), T_REL + 0.25, 0.1)
# bucket leaves the water: a pour that thins out, then drips
pn = int(1.4 * SR); pt = np.arange(pn) / SR
pour = band(rng.standard_normal(pn), 400, 6000) * (np.exp(-pt * 2.6) * np.minimum(1, pt / 0.03)) * (0.7 + 0.3 * np.sin(pt * 40))
add(sfx, pour, T_OUT - 0.02, 0.14)
add(sfx, lowp(rng.standard_normal(int(0.4 * SR)), 700) * env(int(0.4 * SR), 0.004, 0.1), T_OUT, 0.1)
for i in range(12):
    t0 = T_OUT + 0.25 + i * 0.14 + rng.uniform(0, 0.08)
    add(sfx, load(['drip_plink', 'drip_plink2', 'drip_tiny', 'drip_tiny2'][i % 4]), t0, 0.05 * np.exp(-i * 0.12))
# the bucket swings up and the pole knocks the crossbar at the top of its overshoot
top = T_REL + np.argmin(pole[int(T_REL * 100):]) / 100.0
add(sfx, load('fit_hit_bamboo_tok'), top - 0.02, 0.08)

# sub weight: low thumps under the splash, the release and the counterweight's drop, a sub swell into the wide shot
def sub(f0=55, dur=0.6, vol=0.3, drop=0.4):
    n = int(dur * SR); t = np.arange(n) / SR; f = f0 * (1 + drop * np.exp(-t * 12))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.minimum(1, t / 0.004) * np.exp(-t * 5)
add(sfx, sub(48, 0.7), T_SPLASH, 0.32)
add(sfx, sub(42, 0.9, drop=0.2), T_REL + 0.55, 0.3)
add(sfx, sub(38, 1.2, drop=0.6), CUT, 0.18)
add(sfx, sub(45, 0.6), top, 0.14)
mus_sub = drone(D / 4, DUR - CUT, 0.05); add(mus, mus_sub * duck[int(CUT * SR):int(CUT * SR) + len(mus_sub)], CUT)

# ---------------- mix ----------------
# stereo: voice centred; music widened (right channel 11 ms later, a touch brighter on the left); effects panned
# to where they happen on screen (bucket left of centre in the close shot, counterweight left and bucket right in the wide)
st = track2()
st[0] += vo; st[1] += vo
d = int(0.016 * SR); mR = np.concatenate([np.zeros(d), mus[:-d]])
st[0] += mus * 0.95 + 0.1 * band(mus, 2000, 8000); st[1] += 0.25 * mus + 0.8 * mR
st += amb2
pan_t = np.arange(N) / SR
sfx_pan = np.where(pan_t < CUT, -0.4, np.where(pan_t < T_REL + 0.4, 0.35, 0.25))
# release / weight / pour: counterweight is screen-left, the bucket screen-right in the wide shot

a = (sfx_pan + 1) * np.pi / 4; st[0] += sfx * np.cos(a) * 1.41; st[1] += sfx * np.sin(a) * 1.41
mix = st
fo = int(0.25 * SR); mix[:, -fo:] *= np.linspace(1, 0, fo) ** 1.5   # short tail fade (video ends 0.7 s after the last word)
mix[:, :int(0.01 * SR)] *= np.linspace(0, 1, int(0.01 * SR))
mix /= max(1.0, np.abs(mix).max() / 0.9)
wavfile.write(sys.argv[3], SR, (mix.T * 32767).astype(np.int16))
print('ok', round(mix.shape[1] / SR, 3), 'release', round(T_REL, 3), 'top', round(top, 3))
