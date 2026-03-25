import urllib.request, ssl, json, time

ctx = ssl.create_default_context()
ctx.check_hostname = False  
ctx.verify_mode = ssl.CERT_NONE

mapping = {}
offset = 0
limit = 600

while True:
    url = f"https://www.govtrack.us/api/v2/person?limit={limit}&offset={offset}&format=json"
    req = urllib.request.Request(url, headers={"User-Agent": "CongressWatch/1.0"})
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=30) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        print(f"Error at offset {offset}: {e}")
        time.sleep(2)
        continue
    
    meta = data.get("meta", {})
    objects = data.get("objects", [])
    total = meta.get("total_count", 0)
    
    for p in objects:
        bio = p.get("bioguideid")
        gid = p.get("id")
        if bio and gid:
            mapping[bio] = gid
    
    offset += limit
    print(f"  {offset}/{total} persons fetched, {len(mapping)} with bioguide")
    
    if offset >= total or not objects:
        break
    time.sleep(0.3)

print(f"\nTotal mapping: {len(mapping)}")

# Now update members-index.json
with open("data/members-index.json") as f:
    members = json.load(f)

matched = 0
for m in members:
    gt = mapping.get(m["b"])
    if gt:
        m["g"] = gt
        matched += 1

print(f"Matched {matched}/{len(members)} members")

# Save
with open("data/members-index.json", "w") as f:
    json.dump(members, f, separators=(",", ":"))
print("Saved data/members-index.json")

# Copy to public
with open("public/members-index.json", "w") as f:
    json.dump(members, f, separators=(",", ":"))
print("Saved public/members-index.json")

# Stats
missing = [m for m in members if "g" not in m]
print(f"\nMissing govtrackId: {len(missing)}")
for m in missing[:5]:
    print(f"  {m['b']}: {m['n']} (Congress {m['l']})")
