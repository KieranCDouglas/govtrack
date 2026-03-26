#!/usr/bin/env python3
"""Spot-check compass Y (social axis) distribution."""
import json

with open("data/members-current.json") as f:
    members = json.load(f)

r_ys = [m["compassY"] for m in members if m.get("party") == "Republican" and m.get("compassY") is not None]
d_ys = [m["compassY"] for m in members if m.get("party") == "Democrat" and m.get("compassY") is not None]
i_ys = [m["compassY"] for m in members if m.get("party") == "Independent" and m.get("compassY") is not None]

N = lambda n: n.get("displayName", "?")
P = lambda n: n.get("party", "?")
S = lambda n: n.get("state", "?")

print("=== Compass Y (Social Axis) Distribution ===")
print(f"Republicans (n={len(r_ys)}):")
print(f"  Range: [{min(r_ys):.3f}, {max(r_ys):.3f}]")
print(f"  Mean:  {sum(r_ys)/len(r_ys):.3f}")
print(f"  Std:   {(sum((y-sum(r_ys)/len(r_ys))**2 for y in r_ys)/len(r_ys))**0.5:.3f}")

print(f"Democrats (n={len(d_ys)}):")
print(f"  Range: [{min(d_ys):.3f}, {max(d_ys):.3f}]")
print(f"  Mean:  {sum(d_ys)/len(d_ys):.3f}")
print(f"  Std:   {(sum((y-sum(d_ys)/len(d_ys))**2 for y in d_ys)/len(d_ys))**0.5:.3f}")

if i_ys:
    print(f"Independents (n={len(i_ys)}): {i_ys}")

by_y = sorted([m for m in members if m.get("compassY") is not None], key=lambda m: m["compassY"])

print("\nMost conservative (top 10):")
for m in by_y[-10:]:
    print(f"  {N(m):30s} {P(m):15s} {S(m):5s} Y={m['compassY']:+.4f} X={m.get('compassX','?')}")

print("\nMost progressive (bottom 10):")
for m in by_y[:10]:
    print(f"  {N(m):30s} {P(m):15s} {S(m):5s} Y={m['compassY']:+.4f} X={m.get('compassX','?')}")

print("\nCrossover zone (compassY between -0.3 and +0.3):")
cross = [m for m in members if m.get("compassY") is not None and -0.3 <= m["compassY"] <= 0.3]
for m in sorted(cross, key=lambda m: m["compassY"]):
    print(f"  {N(m):30s} {P(m):15s} {S(m):5s} Y={m['compassY']:+.4f}")

# Histogram-style count by bucket
print("\nDistribution by Y-axis bucket:")
buckets = {}
for m in members:
    y = m.get("compassY")
    if y is None:
        continue
    bucket = round(y * 5) / 5  # 0.2 increments
    party = (m.get("party") or "?")[0]
    key = (bucket, party)
    buckets[key] = buckets.get(key, 0) + 1

for b in sorted(set(k[0] for k in buckets)):
    r = buckets.get((b, "R"), 0)
    d = buckets.get((b, "D"), 0)
    i = buckets.get((b, "I"), 0)
    bar_r = "R" * r
    bar_d = "D" * d
    bar_i = "I" * i
    print(f"  {b:+.1f}: {bar_r}{bar_d}{bar_i} (R={r} D={d} I={i})")
