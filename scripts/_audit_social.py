#!/usr/bin/env python3
"""Quick audit: show matched and unmatched votes."""
import json, re, sys, os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)

sys.path.insert(0, SCRIPT_DIR)
from compute_social_axis import _SOCIAL_PATTERNS

def check(text):
    for p in _SOCIAL_PATTERNS:
        m = p.search(text)
        if m:
            return m.group()
    return None

for ch in ["H", "S"]:
    path = os.path.join(ROOT_DIR, f"data/votes/{ch}119.json")
    with open(path) as f:
        data = json.load(f)
    matched = []
    unmatched = []
    for rc in data["r"]:
        desc = rc[7] if len(rc) > 7 else ""
        bill = rc[2] if len(rc) > 2 else ""
        q = rc[3] if len(rc) > 3 else ""
        combined = desc + " " + q + " " + bill
        hit = check(combined)
        if hit:
            matched.append((rc[0], hit, desc[:100]))
        else:
            unmatched.append((rc[0], desc[:100]))

    print(f"\n=== {ch}119: {len(matched)} matched, {len(unmatched)} unmatched ===")
    print(f"\nMATCHED:")
    for num, hit, desc in matched:
        print(f"  #{num} [{hit}] {desc}")

    # Show all unmatched for review
    print(f"\nUNMATCHED (sample, first 30):")
    for num, desc in unmatched[:30]:
        print(f"  #{num} {desc}")
