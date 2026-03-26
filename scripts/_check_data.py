import json

with open('data/votes/H119.json') as f:
    d = json.load(f)

print("First 10 roll call records:")
for i, rc in enumerate(d['r'][:10]):
    print(f"  rc[{i}]: rollnum={rc[0]}, date={rc[1]}, billId={rc[2]!r}, question={rc[3][:50]}")

# Check how many have bill IDs
total = len(d['r'])
with_bill = sum(1 for rc in d['r'] if rc[2])
print(f"\nTotal votes: {total}, With bill ID: {with_bill}, Without: {total - with_bill}")
print(f"\nSample bill IDs:")
seen = set()
for rc in d['r']:
    if rc[2] and rc[2][:4] not in seen:
        seen.add(rc[2][:4])
        print(f"  {rc[2]!r}")
