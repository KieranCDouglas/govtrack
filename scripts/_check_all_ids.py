import json, re, glob

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

# Check all vote files
unmatched = {}
total = 0
matched = 0
for f in sorted(glob.glob('data/votes/*.json')):
    with open(f) as fh:
        d = json.load(fh)
    congress = re.search(r'(\d+)', f.split('/')[-1]).group(1)
    for rc in d['r']:
        bid = rc[2] if len(rc) > 2 else ''
        if bid:
            total += 1
            r = bill_id_to_url(bid, congress)
            if r:
                matched += 1
            else:
                unmatched[bid] = unmatched.get(bid, 0) + 1

print(f"Total votes with bill IDs: {total}")
print(f"Matched by parser: {matched}")
print(f"Unmatched: {total - matched}")
if unmatched:
    print("\nUnmatched bill IDs:")
    for bid, cnt in sorted(unmatched.items(), key=lambda x: -x[1])[:20]:
        print(f"  {bid!r}: {cnt} occurrences")
