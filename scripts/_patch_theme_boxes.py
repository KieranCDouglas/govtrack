#!/usr/bin/env python3
"""Replace hardcoded quadrant hex colors with CSS vars, revert compass container bg."""
import pathlib, sys

bundle = pathlib.Path("/Users/kieran/Documents/GitHub/govtrack/assets/index-C3q1xJnh.js")
text = bundle.read_text("utf-8")

replacements = [
    # ═══ COMPASS PAGE description boxes → CSS vars ═══
    ('{c:"#f2e9e4",b:"#d9c8bc",label:"Populist Left"',
     '{c:"var(--q-pop-bg)",b:"var(--q-pop-b)",label:"Populist Left"'),
    ('{c:"#eee8f5",b:"#d5c8e6",label:"Traditional Right"',
     '{c:"var(--q-trad-bg)",b:"var(--q-trad-b)",label:"Traditional Right"'),
    ('{c:"#c3e3e8",b:"#8fc5cd",label:"Progressive Left"',
     '{c:"var(--q-prog-bg)",b:"var(--q-prog-b)",label:"Progressive Left"'),
    ('{c:"#cddaf0",b:"#a3bade",label:"Libertarian"',
     '{c:"var(--q-lib-bg)",b:"var(--q-lib-b)",label:"Libertarian"'),

    # ═══ QUIZ PAGE description boxes → CSS vars ═══
    ('{q:"Top-Left",label:"Populist Left",c:"#f2e9e4",b:"#d9c8bc"}',
     '{q:"Top-Left",label:"Populist Left",c:"var(--q-pop-bg)",b:"var(--q-pop-b)"}'),
    ('{q:"Top-Right",label:"Trad. Conservative",c:"#eee8f5",b:"#d5c8e6"}',
     '{q:"Top-Right",label:"Trad. Conservative",c:"var(--q-trad-bg)",b:"var(--q-trad-b)"}'),
    ('{q:"Bot-Left",label:"Progressive Left",c:"#c3e3e8",b:"#8fc5cd"}',
     '{q:"Bot-Left",label:"Progressive Left",c:"var(--q-prog-bg)",b:"var(--q-prog-b)"}'),
    ('{q:"Bot-Right",label:"Libertarian",c:"#cddaf0",b:"#a3bade"}',
     '{q:"Bot-Right",label:"Libertarian",c:"var(--q-lib-bg)",b:"var(--q-lib-b)"}'),

    # ═══ Revert compass container backgrounds: white → original dark ═══
    ('style:{background:"#ffffff"},"aria-label"',
     'style:{background:"#0a4a4c"},"aria-label"'),
    ('style:{background:"#ffffff"},children:w?',
     'style:{background:"#0a4a4c"},children:w?'),
]

ok = 0
miss = 0
for old, new in replacements:
    if old in text:
        text = text.replace(old, new, 1)
        ok += 1
        print(f"  OK: {old[:80]}...")
    else:
        miss += 1
        print(f"  MISS: {old[:80]}...")

print(f"\n{ok} OK, {miss} MISS out of {len(replacements)}")

if miss > 0:
    print("Some replacements failed! NOT writing.")
    sys.exit(1)

bundle.write_text(text, "utf-8")
print("Bundle updated.")
