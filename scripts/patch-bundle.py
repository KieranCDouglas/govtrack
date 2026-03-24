#!/usr/bin/env python3
"""Patch the minified bundle to enable static deployment mode (fe=true)."""
import os

bundle_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "index-C3q1xJnh.js")

with open(bundle_path, "r") as f:
    code = f.read()

old = 'const st="port/5000".startsWith("__")?"":"port/5000",fe=st===""&&typeof window<"u"&&!window.location.hostname.includes("localhost")&&!window.location.hostname.includes("127.0.0.1"),'
new = 'const st="",fe=!0,'

if old in code:
    code = code.replace(old, new)
    with open(bundle_path, "w") as f:
        f.write(code)
    print("SUCCESS: Patched fe=true for static deployment")
else:
    if 'const st="",fe=!0,' in code:
        print("ALREADY PATCHED: Bundle already has fe=true")
    else:
        print("ERROR: Could not find the expected string")
        print("Looking for:", repr(old[:80]))
