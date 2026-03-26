import json, re

def bill_id_to_url(raw_id, congress):
    if not raw_id or not congress:
        return ''
    ident = re.sub(r'[.\s]', '', raw_id).upper().strip()
    prefixes = ['HCONRES','SCONRES','HJRES','SJRES','HRES','SRES','HR','S']
    for p in prefixes:
        if ident.startswith(p):
            num = ident[len(p):]
            if num and num.isdigit():
                return 'OK'
    return ''

# Check 119th Congress specifically
for chamber in ['H', 'S']:
    fname = f'data/votes/{chamber}119.json'
    try:
        with open(fname) as f:
            d = json.load(f)
    except FileNotFoundError:
        continue
    
    unmatched = {}
    total = 0
    matched = 0
    for rc in d['r']:
        bid = rc[2] if len(rc) > 2 else ''
        if bid:
            total += 1
            r = bill_id_to_url(bid, '119')
            if r:
                matched += 1
            else:
                unmatched[bid] = unmatched.get(bid, 0) + 1
    
    print(f"{chamber}119: {total} with bill ID, {matched} matched, {total-matched} unmatched")
    if unmatched:
        print(f"  Unmatched: {dict(sorted(unmatched.items(), key=lambda x: -x[1]))}")

# Also list ALL unique prefixes across all data
import glob
all_ids = set()
for f in sorted(glob.glob('data/votes/*.json')):
    with open(f) as fh:
        d = json.load(fh)
    for rc in d['r']:
        bid = rc[2] if len(rc) > 2 else ''
        if bid:
            # Extract prefix (non-digit part)
            prefix = re.match(r'^[A-Za-z]+', bid)
            if prefix:
                all_ids.add(prefix.group().upper())

print(f"\nAll unique bill ID prefixes found: {sorted(all_ids)}")
