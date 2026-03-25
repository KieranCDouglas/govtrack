#!/usr/bin/env python3
"""
Patch 1: Fix blurry mini compass by adding devicePixelRatio scaling.
Patch 2: Widen quiz pages and bump up element sizes.
"""

BUNDLE = "assets/index-C3q1xJnh.js"

with open(BUNDLE, "r", encoding="utf-8") as f:
    src = f.read()

replacements = []

# ── 1. Mini compass HiDPI fix ───────────────────────────────────
# The canvas draws at 260×220 logical pixels but is stretched by CSS (w-full max-w-xs).
# On 2x screens this is blurry. Fix: scale the canvas buffer by devicePixelRatio.
#
# Current code:
#   const d=l.width,g=l.height,h=28,...;c.clearRect(0,0,d,g)
# We hard-code d=260,g=220 (they were already that), scale the canvas buffer & context.

OLD_MINI = (
    'const d=l.width,g=l.height,h=28,f=d/2,y=g/2,j=d/2-h,p=g/2-h;'
    'c.clearRect(0,0,d,g)'
)
NEW_MINI = (
    'const d=260,g=220,h=28,f=d/2,y=g/2,j=d/2-h,p=g/2-h;'
    '{const _r=window.devicePixelRatio||1;l.width=d*_r;l.height=g*_r;c.scale(_r,_r)}'
    'c.clearRect(0,0,d,g)'
)
replacements.append((OLD_MINI, NEW_MINI, "Mini compass HiDPI"))

# ── 2. Quiz intro page: max-w-2xl → max-w-3xl ──────────────────
# The quiz intro container is narrower than the rest of the site.
OLD_QUIZ_INTRO = '"max-w-2xl mx-auto px-4 py-16 text-center"'
NEW_QUIZ_INTRO = '"max-w-3xl mx-auto px-4 py-16 text-center"'
replacements.append((OLD_QUIZ_INTRO, NEW_QUIZ_INTRO, "Quiz intro width"))

# ── 3. Quiz question page: max-w-2xl → max-w-3xl ───────────────
OLD_QUIZ_Q = '"max-w-2xl mx-auto px-4 py-8"'
NEW_QUIZ_Q = '"max-w-3xl mx-auto px-4 py-8"'
replacements.append((OLD_QUIZ_Q, NEW_QUIZ_Q, "Quiz question width"))

# ── 4. Answer buttons: h-12 text-sm → h-14 text-base ───────────
OLD_BTN = '"h-12 text-sm justify-start px-5 transition-all"'
NEW_BTN = '"h-14 text-base justify-start px-6 transition-all"'
replacements.append((OLD_BTN, NEW_BTN, "Answer button size"))

# ── 5. Quiz question card padding: p-8 → p-10 ──────────────────
# The question text card uses p-8 — bump it up slightly.
OLD_CARD = '"border border-border rounded-xl p-8 mb-6"'
NEW_CARD = '"border border-border rounded-xl p-10 mb-6"'
replacements.append((OLD_CARD, NEW_CARD, "Question card padding"))

# ── Apply replacements ──────────────────────────────────────────
ok = 0
fail = 0
for old, new, label in replacements:
    count = src.count(old)
    if count > 0:
        src = src.replace(old, new)
        ok += 1
        print(f"  OK  ({count}x) {label}")
    else:
        fail += 1
        print(f"MISS  {label}  →  {old[:80]}...")

with open(BUNDLE, "w", encoding="utf-8") as f:
    f.write(src)

print(f"\nDone: {ok}/{ok+fail} OK")
