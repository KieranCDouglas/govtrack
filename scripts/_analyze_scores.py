#!/usr/bin/env python3
import json

with open('data/interest-group-scores.json') as f:
    d = json.load(f)

print('Meta:', json.dumps(d['meta'], indent=2))

with open('data/members-index.json') as f2:
    idx = json.load(f2)
party_map = {str(m['i']): m['p'] for m in idx if m.get('l')==119}

for name, org in d['organizations'].items():
    scores = org['scores']
    vals = list(scores.values())
    print(f'\n{name}: {len(vals)} members, range {min(vals)}-{max(vals)}, mean={sum(vals)/len(vals):.1f}')
    dvals = [v for k,v in scores.items() if party_map.get(k)=='D']
    rvals = [v for k,v in scores.items() if party_map.get(k)=='R']
    print(f'  Dems: n={len(dvals)}, range {min(dvals)}-{max(dvals)}, mean={sum(dvals)/len(dvals):.1f}')
    print(f'  Reps: n={len(rvals)}, range {min(rvals)}-{max(rvals)}, mean={sum(rvals)/len(rvals):.1f}')
    dems_at_zero = len([v for v in dvals if v == 0])
    print(f'  Dems at 0%: {dems_at_zero}/{len(dvals)}')
    # Show Dem distribution in buckets
    buckets = {}
    for v in dvals:
        b = (v // 10) * 10
        buckets[b] = buckets.get(b, 0) + 1
    for b in sorted(buckets.keys()):
        print(f'    {b:3d}-{b+9:3d}%: {buckets[b]}')
