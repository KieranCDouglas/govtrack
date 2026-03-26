import json, re, glob

def bill_id_to_url(raw_id, congress):
    if not raw_id or not congress:
        return ''
    ident = re.sub(r'[.\s]', '', raw_id).upper().strip()
    c = int(congress)
    if c < 1:
        return ''
    
    # PN nominations
    if ident.startswith('PN'):
        num = ident[2:]
        if num and num.isdigit():
            return 'OK-nomination'
        return ''
    
    type_map = {
        'HCONRES': 'house-concurrent-resolution',
        'SCONRES': 'senate-concurrent-resolution',
        'HCONR': 'house-concurrent-resolution',
        'SCONR': 'senate-concurrent-resolution',
        'HCRES': 'house-concurrent-resolution',
        'SCRES': 'senate-concurrent-resolution',
        'HCR': 'house-concurrent-resolution',
        'SCR': 'senate-concurrent-resolution',
        'HJRES': 'house-joint-resolution',
        'SJRES': 'senate-joint-resolution',
        'HJRE': 'house-joint-resolution',
        'SJRE': 'senate-joint-resolution',
        'HJR': 'house-joint-resolution',
        'SJR': 'senate-joint-resolution',
        'HRES': 'house-resolution',
        'SRES': 'senate-resolution',
        'HRE': 'house-resolution',
        'SRE': 'senate-resolution',
        'HR': 'house-bill',
        'S': 'senate-bill',
    }
    prefixes = [
        'HCONRES','SCONRES','HCONR','SCONR','HCRES','SCRES','HCR','SCR',
        'HJRES','SJRES','HJRE','SJRE','HJR','SJR',
        'HRES','SRES','HRE','SRE','HR','S',
    ]
    for p in prefixes:
        if ident.startswith(p):
            num = ident[len(p):]
            if num and num.isdigit():
                return 'OK-bill'
    return ''

# Check all vote files
unmatched = {}
total = 0
matched = 0
matched_bills = 0
matched_noms = 0
for f in sorted(glob.glob('data/votes/*.json')):
    with open(f) as fh:
        d = json.load(fh)
    congress = re.search(r'(\d+)', f.split('/')[-1]).group(1)
    for rc in d['r']:
        bid = rc[2] if len(rc) > 2 else ''
        if bid:
            total += 1
            r = bill_id_to_url(bid, congress)
            if r == 'OK-bill':
                matched += 1
                matched_bills += 1
            elif r == 'OK-nomination':
                matched += 1
                matched_noms += 1
            else:
                unmatched[bid] = unmatched.get(bid, 0) + 1

print(f"Total votes with IDs: {total}")
print(f"Matched: {matched} ({matched_bills} bills + {matched_noms} nominations)")
print(f"Unmatched: {total - matched}")
if unmatched:
    print(f"\nRemaining unmatched ({len(unmatched)} unique):")
    for bid, cnt in sorted(unmatched.items(), key=lambda x: -x[1])[:15]:
        print(f"  {bid!r}: {cnt} occurrences")

# Check 119th specifically
for chamber in ['H', 'S']:
    fname = f'data/votes/{chamber}119.json'
    try:
        with open(fname) as f:
            d = json.load(f)
    except FileNotFoundError:
        continue
    t = sum(1 for rc in d['r'] if rc[2])
    m = sum(1 for rc in d['r'] if rc[2] and bill_id_to_url(rc[2], '119'))
    print(f"\n{chamber}119: {t} with ID, {m} matched, {t-m} unmatched")
