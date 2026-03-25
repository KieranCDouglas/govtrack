#!/usr/bin/env python3
"""Patch bundle for styling fixes:
1. Replace dark rgba(4,42,43,...) box backgrounds with theme-aware CSS var
2. Replace #042a2b canvas backgrounds with brighter color
3. Re-add simple axis labels to both compass canvases
4. Brighten canvas fill + increase quadrant tint contrast
"""
import sys

BUNDLE = 'assets/index-C3q1xJnh.js'

with open(BUNDLE, 'r') as f:
    js = f.read()

original = js

replacements = [
    # ── 1. Dark box backgrounds → theme var ──────────────────────
    # These are hardcoded dark backgrounds on compass/quiz info boxes.
    # Replace with hsl(var(--card)) so they respect light/dark mode.
    (
        'style:{background:"rgba(4,42,43,0.5)"},children:[e.jsx("span",{className:"font-semibold text-foreground",children:"Methodology: "})',
        'style:{background:"hsl(var(--card))"},children:[e.jsx("span",{className:"font-semibold text-foreground",children:"Methodology: "})'
    ),
    # Quiz axis description box
    (
        'style:{background:"rgba(4,42,43,0.5)"},children:[e.jsx("div",{className:"grid sm:grid-cols-2 gap-4"',
        'style:{background:"hsl(var(--card))"},children:[e.jsx("div",{className:"grid sm:grid-cols-2 gap-4"'
    ),
    # Quiz result: "Your Position" box
    (
        'style:{background:"rgba(4,42,43,0.6)"},children:[e.jsx("h2",{className:"font-bold mb-4 text-foreground",children:"Your Position"})',
        'style:{background:"hsl(var(--card))"},children:[e.jsx("h2",{className:"font-bold mb-4 text-foreground",children:"Your Position"})'
    ),
    # Quiz result: "Closest Congress Members" box
    (
        'style:{background:"rgba(4,42,43,0.6)"},children:[e.jsx("h2",{className:"font-bold mb-4 text-foreground",children:"Closest Congress Members"})',
        'style:{background:"hsl(var(--card))"},children:[e.jsx("h2",{className:"font-bold mb-4 text-foreground",children:"Closest Congress Members"})'
    ),
    # Quiz: question box
    (
        'style:{background:"rgba(4,42,43,0.6)"},children:[e.jsxs("p",{className:"text-lg font-bold text-foreground leading-relaxed text-center mb-8"',
        'style:{background:"hsl(var(--card))"},children:[e.jsxs("p",{className:"text-lg font-bold text-foreground leading-relaxed text-center mb-8"'
    ),

    # ── 2. Canvas backgrounds: brighter ──────────────────────────
    # Member detail compass
    (
        'style:{background:"#042a2b"},"aria-label"',
        'style:{background:"#0a4a4c"},"aria-label"'
    ),
    # Full compass page
    (
        'style:{background:"#042a2b"},children:w?',
        'style:{background:"#0a4a4c"},children:w?'
    ),

    # ── 3. Canvas fill: brighter with more contrast ──────────────
    # Member detail compass inner fill
    (
        'c.fillStyle="rgba(4,42,43,0.6)",c.fillRect(h,h,d-2*h,g-2*h)',
        'c.fillStyle="rgba(9,72,74,0.65)",c.fillRect(h,h,d-2*h,g-2*h)'
    ),
    # Full compass page inner fill
    (
        'm.fillStyle="rgba(4,42,43,0.5)",m.fillRect(k,k,L-2*k,G-2*k)',
        'm.fillStyle="rgba(9,72,74,0.55)",m.fillRect(k,k,L-2*k,G-2*k)'
    ),

    # ── 4. Quadrant tints: slightly more visible ─────────────────
    # Member detail compass quadrant tints
    (
        '[{x:h,y:h,w:j,h:p,fill:"rgba(239,123,69,0.08)"},{x:f,y:h,w:j,h:p,fill:"rgba(205,237,246,0.05)"},{x:h,y,w:j,h:p,fill:"rgba(94,177,191,0.10)"},{x:f,y,w:j,h:p,fill:"rgba(94,177,191,0.14)"}]',
        '[{x:h,y:h,w:j,h:p,fill:"rgba(239,123,69,0.12)"},{x:f,y:h,w:j,h:p,fill:"rgba(205,237,246,0.08)"},{x:h,y,w:j,h:p,fill:"rgba(94,177,191,0.14)"},{x:f,y,w:j,h:p,fill:"rgba(94,177,191,0.18)"}]'
    ),
    # Full compass page quadrant tints
    (
        '[{x:k,y:k,w:U,h:Z,color:"rgba(239,123,69,0.08)"},{x:O,y:k,w:U,h:Z,color:"rgba(205,237,246,0.05)"},{x:k,y:z,w:U,h:Z,color:"rgba(94,177,191,0.08)"},{x:O,y:z,w:U,h:Z,color:"rgba(94,177,191,0.12)"}]',
        '[{x:k,y:k,w:U,h:Z,color:"rgba(239,123,69,0.12)"},{x:O,y:k,w:U,h:Z,color:"rgba(205,237,246,0.08)"},{x:k,y:z,w:U,h:Z,color:"rgba(94,177,191,0.12)"},{x:O,y:z,w:U,h:Z,color:"rgba(94,177,191,0.16)"}]'
    ),

    # ── 5. Re-add simple axis labels to member detail compass ────
    (
        'c.fillText("",h+2,y-4)',
        'c.fillText("\\u2190 Left",h+2,y-4)'
    ),
    (
        'c.fillText("",d-h-2,y-4)',
        'c.fillText("Right \\u2192",d-h-2,y-4)'
    ),
    (
        'c.fillText("",f,h+9)',
        'c.fillText("\\u2191 Conservative",f,h+9)'
    ),
    (
        'c.fillText("",f,g-h-3)',
        'c.fillText("\\u2193 Progressive",f,g-h-3)'
    ),

    # ── 6. Re-add simple axis labels to full compass page ────────
    # These had been cleared to empty strings. Put back short versions.
    (
        'm.fillText("",k+4,z-10)',
        'm.fillText("\\u2190 Left",k+4,z-10)'
    ),
    (
        'm.fillText("",L-k-4,z-10)',
        'm.fillText("Right \\u2192",L-k-4,z-10)'
    ),
    (
        'm.fillText("",O,k+16)',
        'm.fillText("\\u2191 Conservative",O,k+16)'
    ),
    (
        'm.fillText("",O,G-k-8)',
        'm.fillText("\\u2193 Progressive",O,G-k-8)'
    ),

    # ── 7. Grid lines slightly brighter for more contrast ────────
    # Member detail
    (
        'c.strokeStyle="rgba(94,177,191,0.15)"',
        'c.strokeStyle="rgba(94,177,191,0.22)"'
    ),
    # Full compass
    (
        'm.strokeStyle="rgba(94,177,191,0.12)"',
        'm.strokeStyle="rgba(94,177,191,0.18)"'
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
        print(f"  OK: ({count}x) {old[:70]}...")

if failed:
    print(f"\n{len(failed)} replacement(s) failed:")
    for f_item in failed:
        print(f"  - {f_item}")
    sys.exit(1)

if js == original:
    print("No changes made!")
    sys.exit(1)

with open(BUNDLE, 'w') as f:
    f.write(js)

print(f"\nBundle patched successfully ({len(replacements)} replacements)")
