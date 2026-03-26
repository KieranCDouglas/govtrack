#!/usr/bin/env python3
"""Detailed analysis of the updated social scores."""
import json

with open('data/social-scores.json') as f:
    scores = json.load(f)

with open('data/members-index.json') as f:
    idx = json.load(f)

name_map = {str(m['i']): m['n'] for m in idx if m.get('l') == 119}
party_map = {str(m['i']): m['p'] for m in idx if m.get('l') == 119}

print("Sources:", scores['meta']['sources'])
print()

# Distribution by party
d_scores = []
r_scores = []
for icpsr, s in scores['scores'].items():
    if s['fallback']:
        continue
    party = party_map.get(icpsr, '?')
    if party == 'D':
        d_scores.append((icpsr, s['score']))
    elif party == 'R':
        r_scores.append((icpsr, s['score']))

d_scores.sort(key=lambda x: x[1])
r_scores.sort(key=lambda x: x[1])

# Dem distribution histogram
print(f"DEMOCRAT DISTRIBUTION (n={len(d_scores)}):")
print(f"  Range: {d_scores[0][1]:.3f} to {d_scores[-1][1]:.3f}")
print(f"  Mean: {sum(s for _,s in d_scores)/len(d_scores):.3f}")
bins = {}
for _, score in d_scores:
    b = round(score * 5) / 5  # round to nearest 0.2
    bins[b] = bins.get(b, 0) + 1
for b in sorted(bins.keys()):
    bar = '#' * bins[b]
    print(f"  {b:+.1f}: {bins[b]:3d} {bar}")

# Count Dems at exactly -1.0
at_minus_one = len([s for _, s in d_scores if s == -1.0])
at_minus_08_to_1 = len([s for _, s in d_scores if s < -0.8])
print(f"\n  Dems at exactly -1.0: {at_minus_one}")
print(f"  Dems below -0.8: {at_minus_08_to_1}")

# Republican distribution
print(f"\nREPUBLICAN DISTRIBUTION (n={len(r_scores)}):")
print(f"  Range: {r_scores[0][1]:.3f} to {r_scores[-1][1]:.3f}")
print(f"  Mean: {sum(s for _,s in r_scores)/len(r_scores):.3f}")
bins_r = {}
for _, score in r_scores:
    b = round(score * 5) / 5
    bins_r[b] = bins_r.get(b, 0) + 1
for b in sorted(bins_r.keys()):
    bar = '#' * bins_r[b]
    print(f"  {b:+.1f}: {bins_r[b]:3d} {bar}")

# Show 30 most conservative Dems
print(f"\nTOP 30 MOST CONSERVATIVE DEMOCRATS:")
for icpsr, score in d_scores[-30:][::-1]:
    name = name_map.get(icpsr, '?')
    print(f"  {score:+.4f}  {name}")

# Show some middle-range Dems
mid_idx = len(d_scores) // 2
print(f"\nMIDDLE-RANGE DEMOCRATS (around median):")
for icpsr, score in d_scores[mid_idx-5:mid_idx+5]:
    name = name_map.get(icpsr, '?')
    print(f"  {score:+.4f}  {name}")

# Show most progressive Dems
print(f"\nTOP 10 MOST PROGRESSIVE DEMOCRATS:")
for icpsr, score in d_scores[:10]:
    name = name_map.get(icpsr, '?')
    print(f"  {score:+.4f}  {name}")
