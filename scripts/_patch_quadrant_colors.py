#!/usr/bin/env python3
"""Adjust quadrant description box opacities, then sync canvas tints to match."""
import pathlib, sys

bundle = pathlib.Path("/Users/kieran/Documents/GitHub/govtrack/assets/index-C3q1xJnh.js")
text = bundle.read_text("utf-8")

replacements = [
    # ═══ COMPASS PAGE description boxes ═══
    # Traditional Right: lighter (was #dcd1f0)
    ('{c:"#dcd1f0",b:"#bba8db",label:"Traditional Right"',
     '{c:"#eee8f5",b:"#d5c8e6",label:"Traditional Right"'),
    # Progressive Left: more opaque (was #edf6f7)
    ('{c:"#edf6f7",b:"#bedade",label:"Progressive Left"',
     '{c:"#c3e3e8",b:"#8fc5cd",label:"Progressive Left"'),
    # Libertarian: lighter (was #a6c1ed)
    ('{c:"#a6c1ed",b:"#7ea0d8",label:"Libertarian"',
     '{c:"#cddaf0",b:"#a3bade",label:"Libertarian"'),

    # ═══ QUIZ PAGE description boxes ═══
    # Traditional Right
    ('{q:"Top-Right",label:"Trad. Conservative",c:"#dcd1f0",b:"#bba8db"}',
     '{q:"Top-Right",label:"Trad. Conservative",c:"#eee8f5",b:"#d5c8e6"}'),
    # Progressive Left
    ('{q:"Bot-Left",label:"Progressive Left",c:"#edf6f7",b:"#bedade"}',
     '{q:"Bot-Left",label:"Progressive Left",c:"#c3e3e8",b:"#8fc5cd"}'),
    # Libertarian
    ('{q:"Bot-Right",label:"Libertarian",c:"#a6c1ed",b:"#7ea0d8"}',
     '{q:"Bot-Right",label:"Libertarian",c:"#cddaf0",b:"#a3bade"}'),

    # ═══ SMALL COMPASS canvas tints (member detail, key=fill) ═══
    # Populist Left → warm beige to match #f2e9e4
    ('fill:"rgba(239,123,69,0.12)"},{x:f,y:h,w:j,h:p,fill:"rgba(205,237,246,0.08)"},{x:h,y,w:j,h:p,fill:"rgba(94,177,191,0.14)"},{x:f,y,w:j,h:p,fill:"rgba(94,177,191,0.18)"}',
     'fill:"rgba(242,233,228,0.14)"},{x:f,y:h,w:j,h:p,fill:"rgba(220,200,240,0.06)"},{x:h,y,w:j,h:p,fill:"rgba(130,200,210,0.20)"},{x:f,y,w:j,h:p,fill:"rgba(180,200,235,0.08)"}'),

    # ═══ FULL COMPASS canvas tints (compass page, key=color) ═══
    # All four at once for uniqueness
    ('color:"rgba(239,123,69,0.12)"},{x:O,y:k,w:U,h:Z,color:"rgba(205,237,246,0.08)"},{x:k,y:z,w:U,h:Z,color:"rgba(94,177,191,0.12)"},{x:O,y:z,w:U,h:Z,color:"rgba(94,177,191,0.16)"}',
     'color:"rgba(242,233,228,0.14)"},{x:O,y:k,w:U,h:Z,color:"rgba(220,200,240,0.06)"},{x:k,y:z,w:U,h:Z,color:"rgba(130,200,210,0.20)"},{x:O,y:z,w:U,h:Z,color:"rgba(180,200,235,0.08)"}'),
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
