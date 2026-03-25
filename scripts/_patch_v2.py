#!/usr/bin/env python3
"""Patch bundle: simplified axis labels, white canvas bg, new quadrant box colors."""
import pathlib, sys

bundle = pathlib.Path("/Users/kieran/Documents/GitHub/govtrack/assets/index-C3q1xJnh.js")
text = bundle.read_text("utf-8")

replacements = [
    # ── Small compass axis labels (member detail, variable c) ──
    # The file contains literal \u2190 etc. (6-char escape sequences)
    ('c.fillText("\\u2190 Left",h+2,y-4)',       'c.fillText("",h+2,y-4)'),
    ('c.fillText("Right \\u2192",d-h-2,y-4)',     'c.fillText("Economic",d-h-2,y-4)'),
    ('c.fillText("\\u2191 Conservative",f,h+9)',   'c.fillText("Social",f,h+9)'),
    ('c.fillText("\\u2193 Progressive",f,g-h-3)',  'c.fillText("",f,g-h-3)'),

    # ── Full compass axis labels (compass page, variable m) ──
    ('m.fillText("\\u2190 Left",k+4,z-10)',       'm.fillText("",k+4,z-10)'),
    ('m.fillText("Right \\u2192",L-k-4,z-10)',     'm.fillText("Economic",L-k-4,z-10)'),
    ('m.fillText("\\u2191 Conservative",O,k+16)',   'm.fillText("Social",O,k+16)'),
    ('m.fillText("\\u2193 Progressive",O,G-k-8)',  'm.fillText("",O,G-k-8)'),

    # ── Canvas container backgrounds → white ──
    ('style:{background:"#0a4a4c"},"aria-label"',
     'style:{background:"#ffffff"},"aria-label"'),
    ('style:{background:"#0a4a4c"},children:w?',
     'style:{background:"#ffffff"},children:w?'),

    # ── Compass page quadrant description boxes ──
    ('{c:"rgba(239,123,69,0.15)",b:"rgba(239,123,69,0.4)",label:"Populist Left"',
     '{c:"#f2e9e4",b:"#d9c8bc",label:"Populist Left"'),
    ('{c:"rgba(205,237,246,0.08)",b:"rgba(205,237,246,0.3)",label:"Traditional Right"',
     '{c:"#dcd1f0",b:"#bba8db",label:"Traditional Right"'),
    ('{c:"rgba(94,177,191,0.12)",b:"rgba(94,177,191,0.5)",label:"Progressive Left"',
     '{c:"#edf6f7",b:"#bedade",label:"Progressive Left"'),
    ('{c:"rgba(94,177,191,0.18)",b:"rgba(94,177,191,0.6)",label:"Libertarian"',
     '{c:"#a6c1ed",b:"#7ea0d8",label:"Libertarian"'),

    # ── Quiz page quadrant boxes (different key order: q,label,c,b) ──
    ('{q:"Top-Left",label:"Populist Left",c:"rgba(239,123,69,0.15)",b:"rgba(239,123,69,0.4)"}',
     '{q:"Top-Left",label:"Populist Left",c:"#f2e9e4",b:"#d9c8bc"}'),
    ('{q:"Top-Right",label:"Trad. Conservative",c:"rgba(205,237,246,0.08)",b:"rgba(205,237,246,0.3)"}',
     '{q:"Top-Right",label:"Trad. Conservative",c:"#dcd1f0",b:"#bba8db"}'),
    ('{q:"Bot-Left",label:"Progressive Left",c:"rgba(94,177,191,0.12)",b:"rgba(94,177,191,0.5)"}',
     '{q:"Bot-Left",label:"Progressive Left",c:"#edf6f7",b:"#bedade"}'),
    ('{q:"Bot-Right",label:"Libertarian",c:"rgba(94,177,191,0.18)",b:"rgba(94,177,191,0.6)"}',
     '{q:"Bot-Right",label:"Libertarian",c:"#a6c1ed",b:"#7ea0d8"}'),
]

ok = 0
miss = 0
for old, new in replacements:
    if old in text:
        text = text.replace(old, new, 1)
        ok += 1
        print(f"  OK: {old[:70]}...")
    else:
        miss += 1
        print(f"  MISS: {old[:70]}...")

print(f"\n{ok} OK, {miss} MISS out of {len(replacements)}")

if miss > 0:
    print("Some replacements failed! NOT writing.")
    sys.exit(1)

bundle.write_text(text, "utf-8")
print("Bundle updated successfully.")
