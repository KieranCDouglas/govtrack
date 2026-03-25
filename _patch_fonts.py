#!/usr/bin/env python3
"""Patch canvas font references in bundle: Satoshi→Lato, Cabinet Grotesk→Epilogue."""

import re

BUNDLE = "assets/index-C3q1xJnh.js"

with open(BUNDLE, "r", encoding="utf-8") as f:
    src = f.read()

replacements = [
    # Small compass – axis labels (body font)
    ('c.font="7px Satoshi, sans-serif"',
     'c.font="300 7px Lato, sans-serif"'),
    # Small compass – member name label (heading font)
    ('c.font="bold 10px Cabinet Grotesk, Satoshi, sans-serif"',
     'c.font="400 10px Epilogue, Lato, sans-serif"'),
    # Small compass – "You" label (heading font)
    ('c.font="bold 9px Cabinet Grotesk, Satoshi, sans-serif"',
     'c.font="400 9px Epilogue, Lato, sans-serif"'),
    # Big compass – quadrant labels (heading font)
    ("m.font=\"bold 9px 'Cabinet Grotesk', 'Satoshi', sans-serif\"",
     "m.font=\"400 9px 'Epilogue', 'Lato', sans-serif\""),
    # Big compass – axis labels (body font)
    ("m.font=\"11px 'Satoshi', sans-serif\"",
     "m.font=\"300 11px 'Lato', sans-serif\""),
    # Big compass – member name labels (heading font)
    ("m.font=\"bold 10px 'Cabinet Grotesk', 'Satoshi', sans-serif\"",
     "m.font=\"400 10px 'Epilogue', 'Lato', sans-serif\""),
    # Big compass – "You" label (heading font)
    ("m.font=\"bold 11px 'Cabinet Grotesk', sans-serif\"",
     "m.font=\"400 11px 'Epilogue', sans-serif\""),
]

ok = 0
fail = 0
for old, new in replacements:
    if old in src:
        src = src.replace(old, new, 1)
        ok += 1
        print(f"  OK  {old[:60]}...")
    else:
        fail += 1
        print(f"MISS  {old[:60]}...")

with open(BUNDLE, "w", encoding="utf-8") as f:
    f.write(src)

print(f"\nDone: {ok}/{ok+fail} OK")
