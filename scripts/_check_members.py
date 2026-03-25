import json

with open('data/members-current.json','r') as f:
    members = json.load(f)

# Show a few members with their policyHeterodoxy
for m in members[:3]:
    print(f"{m['displayName']} ({m['party']}) compassX={m.get('compassX')}, compassY={m.get('compassY')}")
    ph = m.get('policyHeterodoxy')
    if ph:
        if isinstance(ph, str):
            ph = json.loads(ph)
        for k,v in ph.items():
            print(f"  {k}: {v}")
    print()

# Find a moderate Democrat
for m in members:
    ph = m.get('policyHeterodoxy')
    if ph and isinstance(ph, str):
        ph = json.loads(ph)
    if not ph:
        continue
    cx = m.get('compassX', 0) or 0
    if m['party'] == 'Democrat' and cx > -0.1:
        print(f"MODERATE DEM: {m['displayName']} compassX={cx}, compassY={m.get('compassY')}")
        for k,v in ph.items():
            print(f"  {k}: {v}")
        print()
        break

# Find a moderate Republican
for m in members:
    ph = m.get('policyHeterodoxy')
    if ph and isinstance(ph, str):
        ph = json.loads(ph)
    if not ph:
        continue
    cx = m.get('compassX', 0) or 0
    if m['party'] == 'Republican' and cx < 0.2:
        print(f"MODERATE REP: {m['displayName']} compassX={cx}, compassY={m.get('compassY')}")
        for k,v in ph.items():
            print(f"  {k}: {v}")
        print()
        break
