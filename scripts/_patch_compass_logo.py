#!/usr/bin/env python3
"""Patch bundle: fix blurry compass + make logo bigger."""

BUNDLE = "assets/index-C3q1xJnh.js"

with open(BUNDLE, "r") as f:
    data = f.read()

patches = 0

# Patch 1: Fix blurry compass - constrain CSS display size to match drawing dims
old_canvas = 'className:"w-full max-w-xs rounded-lg",style:{background:"#0a4a4c"}'
new_canvas = 'className:"w-full rounded-lg",style:{background:"#0a4a4c",maxWidth:"260px",height:"220px"}'
if old_canvas in data:
    data = data.replace(old_canvas, new_canvas, 1)
    patches += 1
    print("PATCH 1 OK: Canvas CSS constrained to 260x220")
else:
    print("PATCH 1 SKIP: Canvas string not found")

# Patch 2: Make logo bigger - 28px -> 40px
old_logo = 'style:{height:"28px",width:"auto"}'
new_logo = 'style:{height:"40px",width:"auto"}'
if old_logo in data:
    data = data.replace(old_logo, new_logo, 1)
    patches += 1
    print("PATCH 2 OK: Logo height 28px -> 40px")
else:
    print("PATCH 2 SKIP: Logo string not found")

# Patch 3: Update Tailwind class for logo height consistency
old_class = 'className:"h-7 flex-shrink-0"'
new_class = 'className:"h-10 flex-shrink-0"'
if old_class in data:
    data = data.replace(old_class, new_class, 1)
    patches += 1
    print("PATCH 3 OK: Logo class h-7 -> h-10")
else:
    print("PATCH 3 SKIP: Logo class not found")

with open(BUNDLE, "w") as f:
    f.write(data)
print(f"Done - {patches} patches applied")
