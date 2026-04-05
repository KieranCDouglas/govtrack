#!/usr/bin/env python3
"""
generate_static_data.py — Exports SQLite data to static JSON files for GitHub Pages.
Run after refresh_data.py, or standalone if data.db already exists.

Outputs (to client/public/data/):
  members-current.json   — All 538 current members with full data (~273KB)
  members-index.json     — Lightweight historical index for search (~1.1MB)
  stats.json             — Site statistics
  manifest.json          — Data version and generation timestamp
"""

import json, os, sqlite3, datetime

print("=== Generating Static Data Files ===")

os.makedirs("client/public/data", exist_ok=True)

conn = sqlite3.connect("data.db")
conn.row_factory = sqlite3.Row
c = conn.cursor()

# ─── Current members (full data) ─────────────────────────────────────────────
rows = c.execute("""
    SELECT bioguide_id, display_name, chamber, state, district, party, party_code,
           born, last_congress, is_current, dim1, dim2, num_votes,
           compass_x, compass_y, govtrack_id, policy_heterodoxy
    FROM members WHERE is_current=1
    ORDER BY display_name
""").fetchall()

current = []
for r in rows:
    het = {}
    try:
        het = json.loads(r["policy_heterodoxy"] or "{}")
    except:
        pass
    current.append({
        "bioguideId": r["bioguide_id"],
        "displayName": r["display_name"],
        "chamber": r["chamber"],
        "state": r["state"],
        "district": r["district"],
        "party": r["party"],
        "partyCode": r["party_code"],
        "born": r["born"],
        "lastCongress": r["last_congress"],
        "dim1": r["dim1"],
        "dim2": r["dim2"],
        "numVotes": r["num_votes"],
        "compassX": r["compass_x"],
        "compassY": r["compass_y"],
        "govtrackId": r["govtrack_id"],
        "policyHeterodoxy": het,
    })

with open("client/public/data/members-current.json", "w") as f:
    json.dump(current, f, separators=(",", ":"))
size = os.path.getsize("client/public/data/members-current.json") // 1024
print(f"  members-current.json: {len(current)} members, {size}KB")

# ─── Historical index (compact) ──────────────────────────────────────────────
hist_rows = c.execute("""
    SELECT bioguide_id, display_name, chamber, state, party, last_congress, compass_x, compass_y
    FROM members WHERE is_current=0
    ORDER BY display_name
""").fetchall()

index = []
for r in hist_rows:
    ch = "H" if r["chamber"] == "House" else "S"
    pa = "D" if r["party"] == "Democrat" else "R" if r["party"] == "Republican" else "I"
    index.append({
        "b": r["bioguide_id"],
        "n": r["display_name"],
        "c": ch,
        "s": r["state"],
        "p": pa,
        "l": r["last_congress"],
        "x": r["compass_x"],
        "y": r["compass_y"],
    })

with open("client/public/data/members-index.json", "w") as f:
    json.dump(index, f, separators=(",", ":"))
size = os.path.getsize("client/public/data/members-index.json") // 1024
print(f"  members-index.json: {len(index)} historical members, {size}KB")

# ─── Stats ────────────────────────────────────────────────────────────────────
total = c.execute("SELECT COUNT(*) FROM members").fetchone()[0]
curr_count = len(current)
house = sum(1 for m in current if m["chamber"] == "House")
senate = sum(1 for m in current if m["chamber"] == "Senate")
dems = sum(1 for m in current if m["party"] == "Democrat")
reps = sum(1 for m in current if m["party"] == "Republican")
ind = sum(1 for m in current if m["party"] not in ("Democrat", "Republican"))

stats = {
    "total_historical": total,
    "current_total": curr_count,
    "current_house": house,
    "current_senate": senate,
    "current_dems": dems,
    "current_reps": reps,
    "current_ind": ind,
}
with open("client/public/data/stats.json", "w") as f:
    json.dump(stats, f, indent=2)
print(f"  stats.json: {stats}")

# ─── Manifest ────────────────────────────────────────────────────────────────
manifest = {
    "generated": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "currentMembersCount": curr_count,
    "historicalCount": len(index),
    "congress": 119,
    "files": ["members-current.json", "members-index.json", "stats.json"],
}
with open("client/public/data/manifest.json", "w") as f:
    json.dump(manifest, f, indent=2)
print("  manifest.json written")

conn.close()
print("\n✓ Static data generation complete.")
