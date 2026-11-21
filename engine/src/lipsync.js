// Lip-sync from the voice's own sound timings (3d-style v1.7). kokoro_say.py writes every sound (phoneme) of a line with
// its start and end (timing.json, "phones"); lipTrack() turns them into mouth shapes as a pure function of time, and
// F.face({ ..., speech: track(t) }) draws them. Sounds: Kokoro's misaki set ('_' = a pause, '·' = the gap between words).
//
// A shape is { open, oh, ee, press, fv, teeth }: open = jaw (0..1), oh = lips rounded, ee = lips spread,
// press = lips shut (m, b, p), fv = lower lip tucked under the top teeth (f, v), teeth = top teeth showing.
const S = (open, oh = 0, ee = 0, teeth = 0.4, press = 0, fv = 0) => ({ open, oh, ee, teeth, press, fv });
const SHAPES = {
  // vowels (A = eɪ, I = aɪ, W = aʊ, O = oʊ, Y = ɔɪ)
  'ɑ': S(0.9, 0, 0.1, 0.7), 'a': S(0.9, 0, 0.1, 0.7), 'æ': S(0.85, 0, 0.3, 0.7), 'A': S(0.6, 0, 0.45), 'I': S(0.85, 0, 0.25, 0.7),
  'W': S(0.8, 0.45, 0, 0.3), 'ɛ': S(0.6, 0, 0.35), 'ʌ': S(0.5), 'ə': S(0.4), 'ɐ': S(0.45), 'ᵊ': S(0.3), 'ɪ': S(0.35, 0, 0.5),
  'i': S(0.25, 0, 0.85), 'ɚ': S(0.35, 0.45, 0, 0.1), 'ɜ': S(0.4, 0.45, 0, 0.1), 'ɔ': S(0.7, 0.6, 0, 0.1), 'O': S(0.5, 0.8, 0, 0), 'o': S(0.5, 0.8, 0, 0),
  'Y': S(0.55, 0.7, 0, 0.1), 'u': S(0.25, 0.95, 0, 0), 'ʊ': S(0.35, 0.7, 0, 0.05), 'ɒ': S(0.8, 0.3),
  // consonants
  'm': S(0, 0, 0, 0, 1), 'b': S(0, 0, 0, 0, 1), 'p': S(0, 0, 0, 0, 1),
  'f': S(0.08, 0, 0.1, 1, 0, 1), 'v': S(0.08, 0, 0.1, 1, 0, 1),
  'w': S(0.12, 0.95, 0, 0), 'ɹ': S(0.25, 0.5, 0, 0.3), 'r': S(0.25, 0.5, 0, 0.3),
  'ʃ': S(0.22, 0.6, 0, 1), 'ʒ': S(0.22, 0.6, 0, 1), 'ʧ': S(0.22, 0.55, 0, 1), 'ʤ': S(0.22, 0.55, 0, 1),
  's': S(0.12, 0, 0.45, 1), 'z': S(0.12, 0, 0.45, 1), 'θ': S(0.2, 0, 0.2, 1), 'ð': S(0.2, 0, 0.2, 1),
  't': S(0.22, 0, 0.25, 0.7), 'd': S(0.22, 0, 0.25, 0.7), 'n': S(0.22, 0, 0.2, 0.6), 'l': S(0.3, 0, 0.15, 0.6), 'ɾ': S(0.25, 0, 0.2, 0.6),
  'k': S(0.3, 0, 0.1, 0.5), 'ɡ': S(0.3, 0, 0.1, 0.5), 'g': S(0.3, 0, 0.1, 0.5), 'ŋ': S(0.28, 0, 0.1, 0.5),
  'h': S(0.4, 0, 0, 0.3), 'j': S(0.2, 0, 0.5, 0.6), 'ʔ': S(0.1),
  '_': S(0, 0, 0, 0), '·': S(0.15, 0, 0, 0.2),
};
const REST = S(0, 0, 0, 0);
const KEYS = ['open', 'oh', 'ee', 'teeth'];

// phones: [[sound, start, end], ...] in seconds from the line's start; at: when the line starts in the shot's clock.
// lead: the mouth moves a little before the sound is heard (lips lead audio by about 40 ms in real speech).
// gain: 1 = normal, more for a shout. Returns track(t) -> shape.
export function lipTrack(phones, { at = 0, lead = 0.04, gain = 1 } = {}) {
  const VOW = 'ɑaæAIWɛʌəɐᵊɪiɚɜɔOoYuʊɒ';
  // weights: vowels carry the jaw (a short vowel between consonants must still open), word gaps barely count
  const P = phones.map(([s, a, b]) => ({ s: SHAPES[s] || S(0.3), a: a + at, b: b + at, gapW: s === '·' ? 0.25 : VOW.includes(s) ? 1.8 : 1 }));
  // a closure has to be seen: hold m/b/p and f/v shut for at least two frames at 30 fps, even when the sound is shorter
  // (stretched forwards into the next sound, so the vowel before it keeps its shape: "Rome" keeps its o)
  for (const p of P) if ((p.s.press || p.s.fv) && p.b - p.a < 0.07) p.b = p.a + 0.07;
  const t0 = P.length ? P[0].a : 0, t1 = P.length ? P[P.length - 1].b : 0;
  const wt = (p, tt, sig) => { const d = Math.max(0, p.a - tt, tt - p.b); return Math.exp(-((d / sig) ** 2)); };
  // blend the shapes of the sounds around tt; sig sets how far neighbours reach (co-articulation)
  const blend = (tt, sig) => {
    const out = { open: 0, oh: 0, ee: 0, teeth: 0 }; let W = 0;
    for (const p of P) { if (p.b < tt - 4 * sig || p.a > tt + 4 * sig) continue; const w = wt(p, tt, sig) * p.gapW; W += w; for (const k of KEYS) out[k] += p.s[k] * w; }
    const rest = Math.max(0, 1 - W); W += rest; // before and after the line, the mouth rests
    for (const k of KEYS) out[k] /= W; return out;
  };
  // closures (m b p, f v) must actually reach the lips: shut through the whole sound, meeting over the 50 ms before it
  // (about a frame and a half) and parting over the 40 ms after it, so they neither snap nor eat the vowel before them
  const ramp = (x) => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
  const closure = (tt, key, pre = 0.05) => { let m = 0; for (const p of P) { if (!p.s[key] || p.b < tt - 0.15 || p.a > tt + 0.15) continue;
    const k = tt < p.a ? ramp(1 - (p.a - tt) / pre) : tt > p.b ? ramp(1 - (tt - p.b) / 0.04) : 1; m = Math.max(m, p.s[key] * k); } return m; };
  const track = (t) => {
    const tt = t + lead;
    if (tt < t0 - 0.3 || tt > t1 + 0.3) return { ...REST, jaw: 0 };
    const fast = blend(tt, 0.04), slow = blend(tt - 0.03, 0.07);          // the jaw is heavier: it follows a beat behind
    const press = closure(tt, 'press'), fv = closure(tt, 'fv');
    const soon = closure(tt, 'press', 0.12);                              // the jaw starts closing a little ahead of the lips
    const open = Math.min(1, gain * (0.7 * fast.open + 0.3 * slow.open)) * (1 - press) * (1 - 0.35 * soon) * (1 - 0.8 * fv);
    return { open, oh: fast.oh * (1 - press), ee: fast.ee * (1 - fast.oh), teeth: Math.max(fast.teeth * Math.min(1, open * 3), fv), press, fv, jaw: slow.open * (1 - 0.6 * press) };

  };
  track.lead = lead; return track;
}
// every line of a vo_X.js VO list on the shot clock: [{ phones, audioAt }, ...], where audioAt is when the line's audio
// starts (plan_vo.py writes it; without it, start is taken as the audio's start)
export function lipTracks(lines, opts = {}) {
  const tr = lines.filter(l => l.phones && l.phones.length).map(l => lipTrack(l.phones, { ...opts, at: l.audioAt ?? l.start ?? 0 }));
  const all = (t) => { let best = { ...REST, jaw: 0 }; for (const f of tr) { const m = f(t); if (m.open + m.press + m.fv > best.open + best.press + best.fv) best = m; } return best; };
  all.lead = opts.lead ?? 0.04; return all;
}
