#!/usr/bin/env python3
"""Analyze Democratic crossover patterns on social-issue votes."""
import json

with open('data/votes/H119.json') as f:
    vdata = json.load(f)

with open('data/members-index.json') as f:
    idx = json.load(f)

# Map ICPSR to party for 119th Congress members
party_map = {str(m['i']): m['p'] for m in idx if m.get('l') == 119}
name_map = {str(m['i']): m['n'] for m in idx if m.get('l') == 119}

rollcalls = vdata['r']
votes = vdata['v']

# Build rollcall index: rc_num -> position in vote string (0-based)
rc_index = {rc[0]: i for i, rc in enumerate(rollcalls)}

# Key social votes to analyze (rc_num, description, conservative_is_yea)
social_votes = [
    (5, "Laken Riley Act", True),
    (22, "Laken Riley Act (Senate)", True),
    (16, "Preventing Violence Against Women by Illegal Aliens", True),
    (11, "Protection of Women and Girls in Sports", True),
    (10, "Women in Sports (procedural)", True),
    (25, "Born-Alive Abortion Survivors (procedural)", True),
    (26, "Born-Alive Abortion Survivors", True),
    (32, "HALT Fentanyl Act", True),
    (165, "HALT Fentanyl Act (Senate)", True),
    (170, "DC Immigration Compliance", True),
    (151, "Save SBA from Sanctuary Cities (procedural)", True),
    (152, "Save SBA from Sanctuary Cities", True),
    (182, "DUI/Immigration Protect Communities", True),
    (183, "Special Interest Alien Reporting", True),
    (269, "DC CRIMES Act", True),
    (274, "DC Policing Protection Act", True),
    (275, "Censuring Ilhan Omar", True),
    (312, "PROTECT Our Kids Act", True),
    (331, "Protect America's Workforce Act", True),
    (349, "Protect Children's Innocence (procedural)", True),
    (350, "Protect Children's Innocence Act", True),
    (396, "Supporting Pregnant/Parenting Women (procedural)", True),
    (397, "Supporting Pregnant/Parenting Women", True),
    (107, "Youth Poisoning Protection Act", True),
    (113, "CA Pollution Control Rule Disapproval", True),
]

print("=" * 100)
print(f"{'RC#':>4} {'D-Yes':>5} {'D-No':>5} {'D-NV':>5} {'R-Yes':>5} {'R-No':>5} {'Desc'}")
print("=" * 100)

good_votes = []

for rc_num, desc, cons_is_yea in social_votes:
    if rc_num not in rc_index:
        continue
    pos = rc_index[rc_num]
    
    d_yea = d_nay = d_nv = 0
    r_yea = r_nay = r_nv = 0
    
    for icpsr, vote_str in votes.items():
        if pos >= len(vote_str):
            continue
        v = vote_str[pos]
        party = party_map.get(icpsr, '?')
        
        if party == 'D':
            if v == '1': d_yea += 1
            elif v == '6': d_nay += 1
            else: d_nv += 1
        elif party == 'R':
            if v == '1': r_yea += 1
            elif v == '6': r_nay += 1
            else: r_nv += 1
    
    # Calculate Dem crossover rate (voting conservative)
    d_total = d_yea + d_nay
    d_cons = d_yea if cons_is_yea else d_nay
    d_rate = d_cons / d_total * 100 if d_total > 0 else 0
    
    print(f"{rc_num:4d} {d_yea:5d} {d_nay:5d} {d_nv:5d} {r_yea:5d} {r_nay:5d}  {desc} (D-cons: {d_rate:.0f}%)")
    
    # Flag votes with meaningful Dem variation (5-90% Dem crossover)
    if 3 < d_rate < 95 and d_total > 200:
        good_votes.append((rc_num, desc, d_rate, d_cons))

print(f"\nVotes with meaningful Dem variation (5-95% conservative):")
for rc_num, desc, d_rate, d_cons in sorted(good_votes, key=lambda x: x[2], reverse=True):
    print(f"  RC{rc_num:3d}: {d_rate:5.1f}% Dem conservative ({d_cons} Dems) - {desc}")

# Now show where these crossover Dems are
print(f"\n\nDemocratic members ranked by conservative social votes:")
# For each Dem, count how many times they voted conservative across the good votes
dem_scores = {}
dem_total = {}
for rc_num, desc, d_rate, d_cons in good_votes:
    pos = rc_index[rc_num]
    for icpsr, vote_str in votes.items():
        if party_map.get(icpsr) != 'D':
            continue
        if pos >= len(vote_str):
            continue
        v = vote_str[pos]
        if v in ('1', '6'):
            dem_total[icpsr] = dem_total.get(icpsr, 0) + 1
            if v == '1':  # yea = conservative for all these
                dem_scores[icpsr] = dem_scores.get(icpsr, 0) + 1

dem_pcts = {}
for icpsr in dem_total:
    if dem_total[icpsr] >= len(good_votes) * 0.5:  # voted on at least half
        dem_pcts[icpsr] = dem_scores.get(icpsr, 0) / dem_total[icpsr] * 100

sorted_dems = sorted(dem_pcts.items(), key=lambda x: x[1], reverse=True)
print(f"\nTop 30 most conservative Democrats:")
for icpsr, pct in sorted_dems[:30]:
    name = name_map.get(icpsr, "?")
    print(f"  {pct:5.1f}%  {name}")

print(f"\nBottom 30 most progressive Democrats:")
for icpsr, pct in sorted_dems[-30:]:
    name = name_map.get(icpsr, "?")
    print(f"  {pct:5.1f}%  {name}")

print(f"\nDem score distribution:")
buckets = {}
for pct in dem_pcts.values():
    b = int(pct // 10) * 10
    buckets[b] = buckets.get(b, 0) + 1
for b in sorted(buckets.keys()):
    bar = '#' * buckets[b]
    print(f"  {b:3d}-{b+9:3d}%: {buckets[b]:3d} {bar}")
