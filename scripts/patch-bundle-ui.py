#!/usr/bin/env python3
"""Patch the bundle for UI improvements:
1. Remove compass canvas text labels (both small and full compass)
2. Add __getPositions hook for individualized member positions
3. Update the positions disclaimer text
"""
import sys

BUNDLE = 'assets/index-C3q1xJnh.js'

with open(BUNDLE, 'r') as f:
    js = f.read()

original = js

replacements = [
    # ── Member detail compass: remove axis labels ──────────────────
    (
        'c.fillText("\u2190 Econ Left",h+2,y-4)',
        'c.fillText("",h+2,y-4)'
    ),
    (
        'c.fillText("Econ Right \u2192",d-h-2,y-4)',
        'c.fillText("",d-h-2,y-4)'
    ),
    (
        'c.fillText("\u2191 Conservative",f,h+9)',
        'c.fillText("",f,h+9)'
    ),
    (
        'c.fillText("\u2193 Progressive",f,g-h-3)',
        'c.fillText("",f,g-h-3)'
    ),

    # ── Full compass page: remove quadrant labels ──────────────────
    (
        'm.fillText("POPULIST LEFT",k+8,k+20)',
        'm.fillText("",k+8,k+20)'
    ),
    (
        'm.fillText("TRADITIONAL RIGHT",L-k-8,k+20)',
        'm.fillText("",L-k-8,k+20)'
    ),
    (
        'm.fillText("PROGRESSIVE LEFT",k+8,G-k-10)',
        'm.fillText("",k+8,G-k-10)'
    ),
    (
        'm.fillText("LIBERTARIAN",L-k-8,G-k-10)',
        'm.fillText("",L-k-8,G-k-10)'
    ),

    # ── Full compass page: remove long axis descriptions ──────────
    (
        'm.fillText("\u2190 Economic Left (state control, protection, redistribution)",k+4,z-10)',
        'm.fillText("",k+4,z-10)'
    ),
    (
        'm.fillText("Economic Right (free markets, deregulation, low taxes) \u2192",L-k-4,z-10)',
        'm.fillText("",L-k-4,z-10)'
    ),
    (
        'm.fillText("\u2191 Social Right (traditional values, cultural conservatism)",O,k+16)',
        'm.fillText("",O,k+16)'
    ),
    (
        'm.fillText("\u2193 Social Left (individual autonomy, progressive, open society)",O,G-k-8)',
        'm.fillText("",O,G-k-8)'
    ),

    # ── Positions: hook into __getPositions for individualization ──
    (
        'const l=o.party||"Other",c=St[l]||St.Independent',
        'const l=o.party||"Other",c=window.__getPositions?window.__getPositions(o,l,St):St[l]||St.Independent'
    ),

    # ── Positions: update disclaimer text ─────────────────────────
    (
        'Positions reflect general party platform. Individual members may diverge.',
        'Positions estimated from DW-NOMINATE ideology scores and voting pattern analysis.'
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
    print(f"\n{len(failed)} replacement(s) failed! Aborting.")
    sys.exit(1)

if js == original:
    print("No changes made!")
    sys.exit(1)

with open(BUNDLE, 'w') as f:
    f.write(js)

print(f"\nBundle patched successfully ({len(replacements)} replacements)")
