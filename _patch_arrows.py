#!/usr/bin/env python3
"""Replace arrow emojis on quiz page with basic B&W triangle icons."""

BUNDLE = "assets/index-C3q1xJnh.js"

with open(BUNDLE, "r", encoding="utf-8") as f:
    src = f.read()

replacements = [
    # Quiz intro – "↔ Economic Axis" → "◂ ▸ Economic Axis"
    ('\u2194 Economic Axis', '\u25c2\u25b8 Economic Axis'),
    # Quiz intro – "↕ Social Axis" → "▴ ▾ Social Axis"
    ('\u2195 Social Axis', '\u25b4\u25be Social Axis'),
]

ok = 0
fail = 0
for old, new in replacements:
    count = src.count(old)
    if count > 0:
        src = src.replace(old, new)
        ok += 1
        print(f"  OK  ({count}x) {repr(old)} -> {repr(new)}")
    else:
        fail += 1
        print(f"MISS  {repr(old)}")

with open(BUNDLE, "w", encoding="utf-8") as f:
    f.write(src)

print(f"\nDone: {ok}/{ok+fail} OK")
