#!/usr/bin/env python3
"""Verify members-current.json has correct social axis fields."""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

with open(os.path.join(ROOT, "data/members-current.json")) as f:
    members = json.load(f)

print(f"Total members: {len(members)}")

# Check fields exist
has_social_score = sum(1 for m in members if m.get("socialScore") is not None)
has_fallback = sum(1 for m in members if m.get("socialFallback") is True)
has_compass_y = sum(1 for m in members if m.get("compassY") is not None)

print(f"Has socialScore: {has_social_score}")
print(f"socialFallback=True: {has_fallback}")
print(f"Has compassY: {has_compass_y}")

# Check that compassY differs from dim2 for social-scored members
diffs = 0
same = 0
for m in members:
    if m.get("socialScore") is not None and m.get("dim2") is not None:
        if abs((m["compassY"] or 0) - (m["dim2"] or 0)) > 0.001:
            diffs += 1
        else:
            same += 1

print(f"\ncompassY differs from dim2 (social-scored): {diffs}")
print(f"compassY same as dim2 (coincidental): {same}")

# Spot check known members
checks = ["Pelosi", "Johnson", "Collins", "Greene", "Cuellar", "Golden"]
for name in checks:
    m = next((m for m in members if name in m.get("displayName", "")), None)
    if m:
        print(f"\n{m['displayName']} ({m['party']}):")
        print(f"  dim1={m.get('dim1')}, dim2={m.get('dim2')}")
        print(f"  compassX={m.get('compassX')}, compassY={m.get('compassY')}")
        print(f"  socialScore={m.get('socialScore')}, socialVotes={m.get('socialVotes')}, fallback={m.get('socialFallback')}")
