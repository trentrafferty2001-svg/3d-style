"""Run the Kokoro v1.0 ONNX model with the pre-installed onnxruntime.
Text -> phonemes via the model's own US-English lexicon (misaki format), no external code.
Writes one 24 kHz wav per line and a JSON with word and sound (phoneme) timings taken from the model's predicted
durations; the sound timings drive the lip-sync (engine/src/lipsync.js).

usage: python3 -I kokoro_say.py <model_dir> <lines.json> <out_dir> [voice] [speed]
lines.json: list of sentences, or [sentence, speed] pairs to set one line's speed
defaults: voice af_heart ("Heart"), speed 1.0
"""
import json, re, sys, os
import numpy as np
import onnxruntime as ort
from scipy.io import wavfile

model_dir, lines_path, out_dir = sys.argv[1], sys.argv[2], sys.argv[3]
voice = sys.argv[4] if len(sys.argv) > 4 else 'af_heart'
speed = float(sys.argv[5]) if len(sys.argv) > 5 else 1.0
os.makedirs(out_dir, exist_ok=True)

# tokens.txt: "<symbol> <id>" (the symbol may itself be a space)
vocab = {}
with open(os.path.join(model_dir, 'tokens.txt'), encoding='utf-8') as f:
    for line in f:
        line = line.rstrip('\n')
        if not line:
            continue
        sym, idx = line[:line.rindex(' ')], int(line[line.rindex(' ') + 1:])
        vocab[sym] = idx

lex = {
    'falkirk': ['f', 'ˈ', 'ɔ', 'l', 'k', 'ɜ', 'ɹ', 'k'],
    'mohenjo': ['m', 'O', 'h', 'ˈ', 'ɛ', 'n', 'ʤ', 'O'], 'daro': ['d', 'ˈ', 'ɑ', 'ɹ', 'O'],
    'flytrap': ['f', 'l', 'ˈ', 'I', 't', 'ɹ', 'ˌ', 'æ', 'p'],
    'lorenzini': ['l', 'ˌ', 'ɔ', 'ɹ', 'ə', 'n', 'z', 'ˈ', 'i', 'n', 'i'],
    'yakhchals': ['j', 'ˈ', 'æ', 'k', 'ʧ', 'ɑ', 'l', 'z'], 'yakhchal': ['j', 'ˈ', 'æ', 'k', 'ʧ', 'ɑ', 'l'],
    'lived': ['l', 'ˈ', 'ɪ', 'v', 'd'],
    "q'eswachaka": ['k', 'ɛ', 's', 'w', 'ɑ', 'ʧ', 'ˈ', 'ɑ', 'k', 'ɑ'], 'qeswachaka': ['k', 'ɛ', 's', 'w', 'ɑ', 'ʧ', 'ˈ', 'ɑ', 'k', 'ɑ'],
    'antikythera': ['ˌ', 'æ', 'n', 't', 'i', 'k', 'ɪ', 'θ', 'ˈ', 'ɪ', 'ɹ', 'ə'],
    'mau': ['m', 'ˈ', 'W'], 'piailug': ['p', 'i', 'ˈ', 'I', 'l', 'u', 'ɡ'], 'hokulea': ['h', 'O', 'k', 'u', 'l', 'ˈ', 'A', 'ɑ'], 'rapa': ['ɹ', 'ˈ', 'ɑ', 'p', 'ɑ'], 'nui': ['n', 'ˈ', 'u', 'i'],
    'jun': ['ʤ', 'ˈ', 'u', 'n'], 'zhang': ['ʤ', 'ˈ', 'ɑ', 'ŋ'], 'heng': ['h', 'ˈ', 'ʌ', 'ŋ'], 'longxi': ['l', 'ˈ', 'ʊ', 'ŋ', 'ʃ', 'ˈ', 'i'],
    'chinampas': ['ʧ', 'i', 'n', 'ˈ', 'æ', 'm', 'p', 'ə', 'z'], 'chinampa': ['ʧ', 'i', 'n', 'ˈ', 'æ', 'm', 'p', 'ə'], 'tenochtitlan': ['t', 'ˌ', 'ɛ', 'n', 'ɑ', 'ʧ', 't', 'i', 't', 'l', 'ˈ', 'ɑ', 'n'], 'xochimilco': ['s', 'ˌ', 'O', 'ʧ', 'i', 'm', 'ˈ', 'i', 'l', 'k', 'O'],
    'al-jazari': ['ˌ', 'æ', 'l', 'ʤ', 'ə', 'z', 'ˈ', 'ɑ', 'ɹ', 'i'], 'jazari': ['ʤ', 'ə', 'z', 'ˈ', 'ɑ', 'ɹ', 'i'],
    'pilae': ['p', 'ˈ', 'I', 'l', 'i'], 'caldarium': ['k', 'æ', 'l', 'd', 'ˈ', 'ɛ', 'ɹ', 'i', 'ə', 'm'],
    'windcatchers': ['w', 'ˈ', 'ɪ', 'n', 'd', 'k', 'ˌ', 'æ', 'ʧ', 'ə', 'ɹ', 'z'], 'windcatcher': ['w', 'ˈ', 'ɪ', 'n', 'd', 'k', 'ˌ', 'æ', 'ʧ', 'ə', 'ɹ'], 'badgirs': ['b', 'ɑ', 'd', 'ɡ', 'ˈ', 'i', 'ɹ', 'z'], 'yazd': ['j', 'ˈ', 'æ', 'z', 'd'], 'dowlat': ['d', 'ˈ', 'O', 'l', 'æ', 't'], 'abad': ['ɑ', 'b', 'ˈ', 'ɑ', 'd'],
    'andenes': ['ɑ', 'n', 'd', 'ˈ', 'ɛ', 'n', 'ɛ', 's'], 'moray': ['m', 'ɔ', 'ɹ', 'ˈ', 'I'],
    'chand': ['ʧ', 'ˈ', 'ʌ', 'n', 'd'], 'baori': ['b', 'ˈ', 'W', 'ɹ', 'i'],
    'roda': ['ɹ', 'ˈ', 'O', 'd', 'ə'],
    'shaduf': ['ʃ', 'ə', 'd', 'ˈ', 'u', 'f'],
    'vitruvius': ['v', 'ɪ', 't', 'ɹ', 'ˈ', 'u', 'v', 'i', 'ə', 's'],
    'bladesmith': ['b', 'l', 'ˈ', 'A', 'd', 's', 'm', 'ˌ', 'ɪ', 'θ'],
    'merer': ['m', 'ˈ', 'ɛ', 'ɹ', 'ɛ', 'ɹ'],
    'syracuse': ['s', 'ˈ', 'ɪ', 'ɹ', 'ə', 'k', 'j', 'ˌ', 'u', 's'],
    'floki': ['f', 'l', 'ˈ', 'O', 'k', 'i'], 'sunstone': ['s', 'ˈ', 'ʌ', 'n', 's', 't', 'ˌ', 'O', 'n'],
    'apurimac': ['ɑ', 'p', 'u', 'ɹ', 'ˈ', 'i', 'm', 'ɑ', 'k'], 'ichu': ['ˈ', 'i', 'ʧ', 'u'], 'sarooj': ['s', 'ɑ', 'ɹ', 'ˈ', 'u', 'ʤ'], 'faloodeh': ['f', 'ə', 'l', 'ˈ', 'u', 'd', 'A'],
}
with open(os.path.join(model_dir, 'lexicon-us-en.txt'), encoding='utf-8') as f:
    for line in f:
        parts = line.rstrip('\n').split(' ')
        if parts and parts[0] and parts[0] not in lex:
            lex[parts[0]] = parts[1:]

VOWELS = set('aeiouAEIOWYæɑɐɒɔəɚɛɜɪʊʌ')

def word_phones(w, nxt):
    lw = w.lower()
    if lw == 'a':
        return ['ɐ']
    if lw == 'the':
        first = (lex.get(nxt.lower(), ['x']) if nxt else ['x'])
        first = [p for p in first if p not in 'ˈˌ'][:1]
        return ['ð', 'i'] if first and first[0] in VOWELS else ['ð', 'ə']
    if lw not in lex and lw.endswith("'s") and lw[:-2] in lex:
        base = lex[lw[:-2]]
        return base + (['s'] if base[-1] in ('p', 't', 'k', 'f', 'θ') else ['z'])
    if lw not in lex:
        # inflection fallback: plural/3rd-person -s/-es and -ing on a base form
        for suf, base_fn, add in (("ies", lambda x: x[:-3] + 'y', ['z']), ("s", lambda x: x[:-1], None), ("es", lambda x: x[:-2], ['ɪ', 'z']), ("ing", lambda x: x[:-3], ['ɪ', 'ŋ']), ("ing", lambda x: x[:-3] + 'e', ['ɪ', 'ŋ']), ("d", lambda x: x[:-1], None), ("ed", lambda x: x[:-2], None)):
            if lw.endswith(suf) and base_fn(lw) in lex:
                base = lex[base_fn(lw)]
                if add is None and suf in ('d', 'ed'):
                    add = ['ɪ', 'd'] if base[-1] in ('t', 'd') else (['t'] if base[-1] in ('p', 'k', 'f', 's', 'ʃ', 'ʧ', 'θ') else ['d'])
                if add is None:
                    add = ['ɪ', 'z'] if base[-1] in ('s', 'z', 'ʃ', 'ʧ', 'ʤ', 'ʒ') else (['s'] if base[-1] in ('p', 't', 'k', 'f', 'θ') else ['z'])
                return base + add
        raise SystemExit(f'not in lexicon: {w}')
    return lex[lw]

names = (ort.InferenceSession(os.path.join(model_dir, 'model.onnx'), providers=['CPUExecutionProvider'])
         .get_modelmeta().custom_metadata_map['speaker_names'].split(','))
sid = names.index(voice)
voices = np.fromfile(os.path.join(model_dir, 'voices.bin'), dtype=np.float32).reshape(len(names), 510, 1, 256)
so = ort.SessionOptions(); so.intra_op_num_threads = 2
sess = ort.InferenceSession(os.path.join(model_dir, 'model.onnx'), so, providers=['CPUExecutionProvider'])
out_names = [o.name for o in sess.get_outputs()]

lines = json.load(open(lines_path))
report = []
for li, item in enumerate(lines):
    text, lspeed = (item[0], item[1]) if isinstance(item, list) else (item, speed)
    # split into words and punctuation
    toks = re.findall(r"[A-Za-z][A-Za-z']*|[,.!?;:—]", text)
    words = [t for t in toks if t[0].isalpha()]
    seq, spans = [], []  # spans: (word, start_idx, end_idx) into seq
    wi = 0
    for ti, t in enumerate(toks):
        if t[0].isalpha():
            nxt = next((u for u in toks[ti + 1:] if u[0].isalpha()), None)
            if seq and seq[-1] not in (' ',):
                seq.append(' ')
            s0 = len(seq)
            seq.extend(word_phones(t, nxt))
            spans.append((t, s0, len(seq)))
            wi += 1
        else:
            seq.append(t)  # punctuation attaches to the previous word
    missing = [p for p in seq if p not in vocab]
    if missing:
        raise SystemExit(f'unknown phoneme symbols {set(missing)} in: {text}')
    ids = [vocab[p] for p in seq]
    style = voices[sid, min(len(ids), 509)]  # (1, 256)
    res = sess.run(None, {'tokens': np.array([[0, *ids, 0]], dtype=np.int64), 'style': style.astype(np.float32),
                          'speed': np.array([lspeed], dtype=np.float32)})
    audio = res[0].astype(np.float32)
    dur = res[1].astype(np.int64) if len(res) > 1 else None
    sr = 24000
    words_t, phones_t = [], []
    if dur is not None and len(dur) == len(ids) + 2:
        spf = len(audio) / max(1, dur.sum())  # samples per duration unit
        cum = np.concatenate([[0], np.cumsum(dur)])  # boundaries; index k+1 is token k of seq (after the leading pad)
        for (w, a, b) in spans:
            words_t.append([w, round(float(cum[a + 1] * spf / sr), 3), round(float(cum[b + 1] * spf / sr), 3)])
        # every sound with its time (stress marks have no sound of their own; ' ' and punctuation are pauses)
        for k, p in enumerate(seq):
            if p in 'ˈˌ': continue
            phones_t.append(['·' if p == ' ' else p if p not in ',.!?;:—' else '_', round(float(cum[k + 1] * spf / sr), 3), round(float(cum[k + 2] * spf / sr), 3)])
        for k in range(len(phones_t) - 1): phones_t[k][2] = phones_t[k + 1][1]  # a stress mark's time joins the sound before it
    wav_path = os.path.join(out_dir, f'line{li:02d}.wav')
    wavfile.write(wav_path, sr, (np.clip(audio, -1, 1) * 32767).astype(np.int16))
    report.append({'text': text, 'wav': wav_path, 'dur': round(len(audio) / sr, 3), 'words': words_t,
                   'phonemes': ''.join(seq), 'phones': phones_t})
    print(f'{li}: {len(audio)/sr:.2f}s  {"".join(seq)}')
json.dump(report, open(os.path.join(out_dir, 'timing.json'), 'w'), indent=1, ensure_ascii=False)
print('dur output' if report and report[0]['words'] else 'no duration output', out_names)
