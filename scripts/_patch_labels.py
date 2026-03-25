import sys

BUNDLE = '/Users/kieran/Documents/GitHub/govtrack/assets/index-C3q1xJnh.js'

with open(BUNDLE, 'r') as f:
    js = f.read()

original = js

replacements = [
    # ── 1. Axis labels: just "Economic" and "Social" ─────────────
    # Member detail compass
    (
        'c.fillText("\u2190 Left",h+2,y-4)',
        'c.fillText("",h+2,y-4)'
    ),
    (
        'c.fillText("Right \u2192",d-h-2,y-4)',
        'c.fillText("Economic \u2192",d-h-2,y-4)'
    ),
    (
        'c.fillText("\u2191 Conservative",f,h+9)',
        'c.fillText("Social \u2191",f,h+9)'
    ),
    (
        'c.fillText("\u2193 Progressive",f,g-h-3)',
        'c.fillText("",f,g-h-3)'
    ),
    # Full compass page
    (
        'm.fillText("\u2190 Left",k+4,z-10)',
        'm.fillText("",k+4,z-10)'
    ),
    (
        'm.fillText("Right \u2192",L-k-4,z-10)',
        'm.fillText("Economic \u2192",L-k-4,z-10)'
    ),
    (
        'm.fillText("\u2191 Conservative",O,k+16)',
        'm.fillText("Social \u2191",O,k+16)'
    ),
    (
        'm.fillText("\u2193 Progressive",O,G-k-8)',
        'm.fillText("",O,G-k-8)'
    ),

    # ── 2. Canvas container background: white ────────────────────
    # Member detail compass
    (
        'style:{background:"#0a4a4c"},"aria-label"',
        'style:{background:"#ffffff"},"aria-label"'
    ),
    # Full compass page
    (
        'style:{background:"#0a4a4c"},children:w?',
        'style:{background:"#ffffff"},children:w?'
    ),

    # ── 3. Quadrant boxes: new colors ────────────────────────────
    # Compass page (already patched to inline styles)
    (
        '{c:"rgba(239,123,69,0.15)",b:"rgba(239,123,69,0.4)",label:"Populist Left"',
        '{c:"#f2e9e4",b:"#e0d2cb",label:"Populist Left"'
    ),
    (
        '{c:"rgba(205,237,246,0.08)",b:"rgba(205,237,246,0.3)",label:"Traditional Right"',
        '{c:"#dcd1f0",b:"#c5b6e3",label:"Traditional Right"'
    ),
    (
        '{c:"rgba(94,177,191,0.12)",b:"rgba(94,177,191,0.5)",label:"Progressive Left"',
        '{c:"#edf6f7",b:"#d0e8ea",label:"Progressive Left"'
    ),
    (
        '{c:"rgba(94,177,191,0.18)",b:"rgba(94,177,191,0.6)",label:"Libertarian"',
        '{c:"#a6c1ed",b:"#8baad9",label:"Libertarian"'
    ),

    # Quiz page quadrant boxes
    (
        '{q:"Top-Left",label:"Populist Left",c:"rgba(239,123,69,0.15)",b:"rgba(239,123,69,0.4)"}',
        '{q:"Top-Left",label:"Populist Left",c:"#f2e9e4",b:"#e0d2cb"}'
    ),
    (
        '{q:"Top-Right",label:"Trad. Conservative",c:"rgba(205,237,246,0.08)",b:"rgba(205,237,246,0.3)"}',
        '{q:"Top-Right",label:"Trad. Conservative",c:"#dcd1f0",b:"#c5b6e3"}'
    ),
    (
        '{q:"Bot-Left",label:"Progressive Left",c:"rgba(94,177,191,0.12)",b:"rgba(94,177,191,0.5)"}',
        '{q:"Bot-Left",label:"Progressive Left",c:"#edf6f7",b:"#d0e8ea"}'
    ),
    (
        '{q:"Bot-Right",label:"Libertarian",c:"rgba(94,177,191,0.18)",b:"rgba(94,177,191,0.6)"}',
        '{q:"Bot-Right",label:"Libertarian",c:"#a6c1ed",b:"#8baad9"}'
    ),
]

failed = []
for old, new in replacements:
    count = js.count(old)
    if count == 0:
        failed.append(old[:80])
        print(f"MISS: {old[:80]}...")
    else:
        js = js.replace(old, new)
        print(f"  OK: ({count}x) {old[:60]}...")

if failed:
    print(f"\n{len(failed)} replacement(s) failed:")
    for f_item in failed:
        print(f"  - {f_item}")
    sys.exit(1)

with open(BUNDLE, 'w') as f:
    f.write(js)

print(f"\nBundle patched successfully ({len(replacements)} replacements)")
