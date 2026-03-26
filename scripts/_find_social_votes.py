#!/usr/bin/env python3
"""Find social-issue votes in the 119th Congress."""
import json

with open('data/votes/H119.json') as f:
    v = json.load(f)

social_keywords = [
    'immigra', 'alien', 'border', 'deport', 'asylum', 'sanctuary', 
    'abort', 'reproductive', 'women', 'girl', 'gender', 'trans', 'lgbtq', 'marriage',
    'gun', 'firearm', 'weapon', 'second amendment', 'school choice', 'education',
    'prayer', 'religion', 'church', 'faith', 'family', 'child', 'protect',
    'enforcement', 'crime', 'victim', 'sex', 'sport', 'laken', 'born alive',
    'parental', 'fentanyl', 'drug', 'flag', 'pledge', 'censor', 'speech',
    'free speech', 'dei', 'diversity', 'equity', 'ice '
]

rollcalls = v['r']
social_rcs = []
for rc in rollcalls:
    num, date, bill = rc[0], rc[1], rc[2]
    desc = rc[7] if len(rc) > 7 else ""
    full = (bill + " " + desc).lower()
    yea, nay = rc[5], rc[6]
    total = yea + nay
    if total < 100:
        continue
    margin = abs(yea - nay) / total
    for kw in social_keywords:
        if kw in full:
            social_rcs.append((num, date, bill, yea, nay, margin, desc[:130]))
            break

print(f"Potentially social-issue votes: {len(social_rcs)}")
for num, date, bill, y, n, margin, desc in sorted(social_rcs, key=lambda x: x[5]):
    close = "***" if margin < 0.3 else "   "
    print(f"  RC{num:3d} ({date}) Y:{y:3d} N:{n:3d} {close} {bill}: {desc}")
