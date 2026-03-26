#!/usr/bin/env python3
"""Analyze Senate social votes."""
import json

with open('data/votes/S119.json') as f:
    vdata = json.load(f)

with open('data/members-index.json') as f:
    idx = json.load(f)

party_map = {str(m['i']): m['p'] for m in idx if m.get('l') == 119 and m.get('c') == 'S'}
name_map = {str(m['i']): m['n'] for m in idx if m.get('l') == 119 and m.get('c') == 'S'}

rollcalls = vdata['r']
votes = vdata['v']
rc_index = {rc[0]: i for i, rc in enumerate(rollcalls)}

# Show all rollcalls with Dem splits
print(f"119th Congress Senate rollcalls: {len(rollcalls)}")
social_keywords = [
    'immigra', 'alien', 'border', 'deport', 'asylum', 'sanctuary', 
    'abort', 'reproductive', 'women', 'girl', 'gender', 'trans',
    'gun', 'firearm', 'weapon', 'crime', 'victim', 'sex', 'sport',
    'laken', 'born alive', 'parental', 'fentanyl', 'drug',
    'flag', 'dei', 'diversity', 'equity', 'censor', 'speech',
    'child', 'protect', 'enforcement', 'alien', 'ice '
]

for rc in rollcalls:
    num, date, bill = rc[0], rc[1], rc[2]
    desc = rc[7] if len(rc) > 7 else ""
    full = (bill + " " + desc).lower()
    yea, nay = rc[5], rc[6]
    total = yea + nay
    if total < 50:
        continue
    
    # Check for social keywords
    is_social = any(kw in full for kw in social_keywords)
    
    # Also show any non-unanimous votes
    margin = abs(yea - nay) / total if total > 0 else 1
    
    if is_social or (margin < 0.5 and total > 80):
        pos = rc_index[num]
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
        
        d_total = d_yea + d_nay
        d_cons = d_yea  # assume yea=conservative
        d_rate = d_cons / d_total * 100 if d_total > 0 else 0
        
        flag = "***" if 5 < d_rate < 95 else "   "
        print(f"  RC{num:3d} ({date}) Y:{yea:3d} N:{nay:3d} D[Y:{d_yea:2d} N:{d_nay:2d}] R[Y:{r_yea:2d} N:{r_nay:2d}] {flag} {bill}: {desc[:100]}")
