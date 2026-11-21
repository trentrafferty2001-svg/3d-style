#!/usr/bin/env python3
"""Swallowed-code scan: a `//` comment placed in the middle of a line of code silently disables everything after it on
that line (it happened four times: the v1.0.0 rope, a settle() call, an amphora's closing brace, and a wet patch that was
never added to the scene). Flags lines that have code before `//` and something code-like after it.
usage: swallow_scan.py [files or dirs ...]   (default: engine/src and scripts)  -> PASS / FAIL"""
import glob, os, re, sys

CODE = re.compile(r'(;\s*[\w.$]+\s*[\(=]|\b(const|let|var|return|if|for)\b[^\n]*[;{]|\.add\(|\)\s*;\s*\w)')
paths = sys.argv[1:] or ['engine/src', 'scripts']
files = []
for p in paths:
    files += sorted(glob.glob(os.path.join(p, '*.js')) + glob.glob(os.path.join(p, '*.mjs'))) if os.path.isdir(p) else [p]
bad = 0
for f in files:
    for n, line in enumerate(open(f, encoding='utf-8'), 1):
        i = line.find('//')
        while i >= 0:
            before = line[:i]
            in_str = before.count('`') % 2 or before.count("'") % 2 or before.count('"') % 2 or before.rstrip().endswith(':')  # inside a string or a URL
            if not in_str: break
            i = line.find('//', i + 2)
        if i < 0 or not line[:i].strip(): continue
        if CODE.search(line[i + 2:]):
            bad += 1; print(f'{f}:{n}: code after a // comment: {line.strip()[:160]}')
print(f'{len(files)} files -> ' + ('PASS' if bad == 0 else f'FAIL ({bad})'))
