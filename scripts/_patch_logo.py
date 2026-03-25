#!/usr/bin/env python3
"""Replace inline SVG logo with img tag pointing to logo.png"""
import pathlib

BUNDLE = pathlib.Path("/Users/kieran/Documents/GitHub/govtrack/assets/index-C3q1xJnh.js")
src = BUNDLE.read_text()

old = (
    'e.jsxs("svg",{"aria-label":"CongressWatch logo",'
    'viewBox:"0 0 32 32",className:"w-7 h-7 flex-shrink-0",fill:"none",'
    'children:[e.jsx("rect",{x:"2",y:"22",width:"28",height:"3",rx:"1.5",'
    'fill:"hsl(var(--primary))"}),e.jsx("path",{d:"M16 4 L28 22 L4 22 Z",'
    'stroke:"hsl(var(--primary))",strokeWidth:"2",fill:"none",'
    'strokeLinejoin:"round"}),e.jsx("circle",{cx:"16",cy:"4",r:"2",'
    'fill:"hsl(var(--primary))"}),e.jsx("line",{x1:"16",y1:"10",x2:"16",'
    'y2:"19",stroke:"hsl(var(--foreground))",strokeWidth:"1.5",'
    'strokeOpacity:"0.5"}),e.jsx("line",{x1:"10",y1:"14",x2:"22",y2:"14",'
    'stroke:"hsl(var(--foreground))",strokeWidth:"1",strokeOpacity:"0.3"})]})'
)

new = 'e.jsx("img",{src:"./logo.png",alt:"CongressWatch logo",className:"h-7 flex-shrink-0",style:{height:"28px",width:"auto"}})'

if old in src:
    src = src.replace(old, new, 1)
    BUNDLE.write_text(src)
    print("OK: Replaced SVG logo with img tag")
else:
    print("ERROR: SVG string not found")
    idx = src.find('"CongressWatch logo"')
    if idx >= 0:
        print(f"  Found at offset {idx}")
        print(f"  Context: ...{src[max(0,idx-80):idx+200]}...")
    else:
        print("  'CongressWatch logo' not found at all")
