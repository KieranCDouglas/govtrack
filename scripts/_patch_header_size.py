#!/usr/bin/env python3
"""Patch bundle: enlarge header bar height h-14 -> h-16."""

BUNDLE = "assets/index-C3q1xJnh.js"

with open(BUNDLE, "r") as f:
    data = f.read()

patches = 0

# Header height h-14 -> h-16
old = 'max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4'
new = 'max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4'
if old in data:
    data = data.replace(old, new, 1)
    patches += 1
    print("PATCH 1 OK: Header h-14 -> h-16")
else:
    print("PATCH 1 SKIP: Header string not found")

# Nav link text: text-sm -> text-base for nav links
old2 = 'px-3 py-1.5 rounded-md text-sm font-medium'
new2 = 'px-3 py-1.5 rounded-md text-[15px] font-medium'
if old2 in data:
    data = data.replace(old2, new2, 1)
    patches += 1
    print("PATCH 2 OK: Nav links text-sm -> text-[15px]")
else:
    print("PATCH 2 SKIP: Nav links string not found")

# Site title: text-base -> text-lg
old3 = 'font-bold text-base tracking-tight'
new3 = 'font-bold text-lg tracking-tight'
if old3 in data:
    data = data.replace(old3, new3, 1)
    patches += 1
    print("PATCH 3 OK: Site title text-base -> text-lg")
else:
    print("PATCH 3 SKIP: Site title string not found")

with open(BUNDLE, "w") as f:
    f.write(data)
print(f"Done - {patches} patches applied")
