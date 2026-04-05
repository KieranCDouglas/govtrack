#!/usr/bin/env python3
"""
refresh_data.py — Downloads fresh data from Voteview and GovTrack.
Run by GitHub Actions weekly, or manually: python3 scripts/refresh_data.py

Outputs:
  data.db           — SQLite database with all member data
  seed_data.json    — Full member list with compass coordinates
  govtrack_current_members.json — GovTrack ID mapping for current members
  member_policy_scores.json     — Policy family vote scores per member
  policy_analysis.json          — Party medians and heterodoxy distances
"""

import csv, io, json, os, re, sqlite3, statistics, threading, time, urllib.request, queue

print("=== CongressWatch Data Refresh ===")

CONGRESS_API_KEY = os.environ.get("CONGRESS_API_KEY", "SaE2is72peVUEN1dvkJVMNofrE9FvnxeeaaQa2st")
GOVTRACK_API = "https://www.govtrack.us/api/v2"
VOTEVIEW_URL = "https://voteview.com/static/data/out/members/HSall_members.csv"

def fetch(url, headers=None):
    req = urllib.request.Request(url, headers=headers or {"User-Agent": "CongressWatch/1.0 (kieran@tilquhillie.com)"})
    resp = urllib.request.urlopen(req, timeout=30)
    return json.load(resp)

def fetch_raw(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return urllib.request.urlopen(req, timeout=30).read().decode("utf-8")

# ─── 1. Download Voteview DW-NOMINATE scores ──────────────────────────────────
print("\n[1/5] Downloading Voteview DW-NOMINATE scores...")
content = fetch_raw(VOTEVIEW_URL)
all_rows = list(csv.DictReader(io.StringIO(content)))
print(f"  Downloaded {len(all_rows)} historical rows")

# Best available Nokken-Poole score per member
best_row = {}
for r in all_rows:
    bio = r.get("bioguide_id")
    if not bio or not r.get("nokken_poole_dim1"):
        continue
    cong = int(r["congress"])
    if bio not in best_row or cong >= best_row[bio][0]:
        best_row[bio] = (cong, r)

# ─── 2. Fetch current members from GovTrack ──────────────────────────────────
print("\n[2/5] Fetching current members from GovTrack...")
gt_current = {}
offset, limit = 0, 250
total = None
while True:
    data = fetch(f"{GOVTRACK_API}/role?current=true&limit={limit}&offset={offset}")
    if total is None:
        total = data["meta"]["total_count"]
    for role in data["objects"]:
        p = role["person"]
        bio = p.get("bioguideid", "")
        link = p.get("link", "")
        m = re.search(r"/(\d+)$", link)
        gt_id = int(m.group(1)) if m else None
        if bio:
            gt_current[bio] = {
                "chamber": "House" if role["role_type"] == "representative" else "Senate",
                "party": role.get("party", ""),
                "state": role.get("state", ""),
                "district": role.get("district"),
                "gt_id": gt_id,
            }
    offset += limit
    if offset >= total:
        break
    time.sleep(0.3)
print(f"  Found {len(gt_current)} current members")

# ─── 3. Compute compass coordinates ───────────────────────────────────────────
print("\n[3/5] Computing compass coordinates...")

def compass(bio, np1, np2, party_code):
    if not np1 or not np2:
        return None, None
    np1, np2 = float(np1), float(np2)
    pc = str(int(float(party_code))) if party_code else "0"
    # Economic X: left(-1) collectivist / right(+1) free market
    econ_x = np1 * 0.55
    if pc == "200":
        is_lib = np1 > 0.45 and np2 < -0.72
        is_maga = np2 < -0.25 and 0.30 < np1 < 0.75
        if is_maga and not is_lib:
            econ_x -= abs(np2) * 0.55
    # Social Y: progressive(-1) / conservative(+1)
    if pc == "100":
        social_y = -0.45 + np2 * 0.40 + np1 * 0.15
        social_y = max(-1.0, min(0.3, social_y))
    elif pc == "200":
        is_mod = np1 < 0.32
        is_lib2 = np1 > 0.45 and np2 < -0.72
        is_maga2 = np2 < -0.20 and not is_lib2
        if is_mod:
            social_y = max(-0.2, min(0.6, 0.20 + np2 * 0.30))
        elif is_lib2:
            social_y = -0.30
        elif is_maga2:
            social_y = max(0.1, min(1.0, 0.38 + abs(np2) * 0.50 + max(0, np1 - 0.40) * 0.15))
        else:
            social_y = max(-0.1, min(0.9, 0.30 + max(0, np1 - 0.30) * 0.40 - np2 * 0.10))
    elif pc == "328":
        social_y = max(-1.0, min(0.2, -0.50 + np2 * 0.35))
    else:
        social_y = 0.0
    return round(max(-1.0, min(1.0, econ_x)), 4), round(max(-1.0, min(1.0, float(social_y))), 4)

# ─── 4. Build seed_data.json ─────────────────────────────────────────────────
members = []
current_bios = set(gt_current.keys())

# Process Voteview rows — deduplicate by bioguide, keep most recent
seen = {}
for r in all_rows:
    bio = r.get("bioguide_id")
    if not bio:
        continue
    cong = int(r["congress"])
    if bio not in seen or cong > seen[bio]["congress_num"]:
        seen[bio] = {"congress_num": cong, "row": r}

for bio, entry in seen.items():
    r = entry["row"]
    np1 = r.get("nokken_poole_dim1") or r.get("nominate_dim1")
    np2 = r.get("nokken_poole_dim2") or r.get("nominate_dim2")
    pc = r.get("party_code", "0")

    # Party mapping
    pc_int = int(float(pc)) if pc else 0
    party = "Democrat" if pc_int == 100 else "Republican" if pc_int == 200 else "Independent"
    best = best_row.get(bio)
    if best:
        np1 = best[1].get("nokken_poole_dim1") or np1
        np2 = best[1].get("nokken_poole_dim2") or np2

    x, y = compass(bio, np1, np2, pc)
    gt = gt_current.get(bio, {})
    is_current = bio in current_bios

    members.append({
        "bioguide_id": bio,
        "display_name": r.get("bioname", "").title(),
        "raw_name": r.get("bioname", ""),
        "chamber": gt.get("chamber", "House" if r.get("chamber") == "House" else "Senate"),
        "state": r.get("state_abbrev", ""),
        "district": None,
        "party": gt.get("party", "") or party,
        "party_code": pc,
        "born": int(float(r["born"])) if r.get("born") else None,
        "last_congress": int(r["congress"]),
        "is_current": is_current,
        "dim1": float(np1) if np1 else None,
        "dim2": float(np2) if np2 else None,
        "num_votes": int(r.get("nominate_number_of_votes") or 0),
        "compass_x": x,
        "compass_y": y,
        "govtrack_id": gt.get("gt_id"),
        "policy_heterodoxy": {},
    })

print(f"  Built {len(members)} member records")

with open("seed_data.json", "w") as f:
    json.dump(members, f, separators=(",", ":"))
with open("govtrack_current_members.json", "w") as f:
    json.dump(gt_current, f, indent=2)
print("  Saved seed_data.json and govtrack_current_members.json")

# ─── 5. Build SQLite DB ───────────────────────────────────────────────────────
print("\n[4/5] Building SQLite database...")
if os.path.exists("data.db"):
    os.remove("data.db")
conn = sqlite3.connect("data.db")
c = conn.cursor()
c.execute("""CREATE TABLE members (
    id INTEGER PRIMARY KEY AUTOINCREMENT, bioguide_id TEXT UNIQUE,
    display_name TEXT, raw_name TEXT, chamber TEXT, state TEXT, district TEXT,
    party TEXT, party_code TEXT, born INTEGER, last_congress INTEGER, is_current INTEGER,
    dim1 REAL, dim2 REAL, num_votes INTEGER, compass_x REAL, compass_y REAL,
    image_url TEXT, govtrack_id INTEGER, policy_heterodoxy TEXT)""")
c.execute("""CREATE TABLE member_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, bioguide_id TEXT, member_id INTEGER,
    congress INTEGER, session INTEGER, chamber TEXT, roll_call INTEGER, vote_date TEXT,
    vote_time TEXT, bill_id TEXT, bill_title TEXT, question TEXT, description TEXT,
    result TEXT, position TEXT, category TEXT, cached INTEGER DEFAULT 0)""")
batch = [(m["bioguide_id"], m["display_name"], m["raw_name"], m["chamber"], m["state"],
          m.get("district"), m["party"], str(m.get("party_code", "")), m.get("born"),
          m["last_congress"], 1 if m["is_current"] else 0, m.get("dim1"), m.get("dim2"),
          m.get("num_votes", 0), m.get("compass_x"), m.get("compass_y"), None,
          m.get("govtrack_id"), "{}") for m in members]
c.executemany("""INSERT OR IGNORE INTO members 
    (bioguide_id,display_name,raw_name,chamber,state,district,party,party_code,born,
     last_congress,is_current,dim1,dim2,num_votes,compass_x,compass_y,image_url,govtrack_id,policy_heterodoxy)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", batch)
conn.commit()
total_db = c.execute("SELECT COUNT(*) FROM members").fetchone()[0]
current_db = c.execute("SELECT COUNT(*) FROM members WHERE is_current=1").fetchone()[0]
print(f"  DB: {total_db} total, {current_db} current")
conn.close()

print("\n✓ Data refresh complete. Run generate_static_data.py next.")
