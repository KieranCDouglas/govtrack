#!/usr/bin/env python3
"""
Refresh congressional data from Voteview and GovTrack APIs.

- Fetches current NOMINATE ideology scores from Voteview
- Fetches GovTrack person IDs for linking
- Computes custom compass coordinates (economic + social axes)
- Merges policy heterodoxy from existing data
- Writes data/members-current.json, data/members-index.json, data/stats.json
"""

import csv
import io
import json
import os
import ssl
import sys
import urllib.error
import urllib.request

CONGRESS = 119
VOTEVIEW_BASE = "https://voteview.com/static/data/out/members"
GOVTRACK_API = "https://www.govtrack.us/api/v2"
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")

POLICY_CATEGORIES = [
    "fiscal_tax", "military_defense", "immigration", "foreign_policy",
    "environment_energy", "healthcare", "trade", "social_rights",
    "criminal_justice", "elections_democracy", "guns"
]


def fetch_url(url):
    """Fetch URL content with a User-Agent header."""
    req = urllib.request.Request(url, headers={"User-Agent": "CongressWatch/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read().decode("utf-8")
    except (ssl.SSLCertVerificationError, urllib.error.URLError):
        # Fallback for environments with missing CA certs (e.g., macOS Python)
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
            return resp.read().decode("utf-8")


def fetch_voteview_members():
    """Fetch current congress members from Voteview CSV files."""
    members = {}
    for chamber_code, chamber_name in [("H", "House"), ("S", "Senate")]:
        url = f"{VOTEVIEW_BASE}/{chamber_code}{CONGRESS}_members.csv"
        print(f"  Fetching {url}")
        csv_text = fetch_url(url)
        reader = csv.DictReader(io.StringIO(csv_text))
        for row in reader:
            bioguide = row.get("bioguide_id", "").strip()
            if not bioguide:
                continue

            party_code = int(row.get("party_code", 0))
            if party_code == 100:
                party = "Democrat"
            elif party_code == 200:
                party = "Republican"
            else:
                party = "Independent"

            born_raw = row.get("born", "")
            born = int(float(born_raw)) if born_raw and born_raw != "NA" else None

            dim1 = safe_float(row.get("nominate_dim1"))
            dim2 = safe_float(row.get("nominate_dim2"))
            nk_dim1 = safe_float(row.get("nokken_poole_dim1"))
            nk_dim2 = safe_float(row.get("nokken_poole_dim2"))
            num_votes = safe_int(row.get("nominate_number_of_votes"))

            district_code = row.get("district_code", "0").strip()
            district = district_code if district_code != "0" and chamber_name == "House" else None

            members[bioguide] = {
                "bioguideId": bioguide,
                "displayName": format_name(row.get("bioname", "")),
                "chamber": chamber_name,
                "state": row.get("state_abbrev", "").strip(),
                "district": district,
                "party": party,
                "partyCode": str(party_code),
                "born": born,
                "lastCongress": CONGRESS,
                "dim1": round(dim1, 3) if dim1 is not None else None,
                "dim2": round(dim2, 3) if dim2 is not None else None,
                "nk_dim1": nk_dim1,
                "nk_dim2": nk_dim2,
                "numVotes": num_votes or 0,
                "govtrackId": None,  # filled later
                "policyHeterodoxy": {cat: None for cat in POLICY_CATEGORIES},
            }
    return members


def format_name(bioname):
    """Convert 'LAST, First Middle' to 'First Last'."""
    if not bioname:
        return ""
    bioname = bioname.strip()
    if "," in bioname:
        parts = bioname.split(",", 1)
        last = parts[0].strip().title()
        first = parts[1].strip().split("(")[-1].rstrip(")").strip() if "(" in parts[1] else parts[1].strip()
        # Take first name only (before middle names/initials)
        first_parts = first.split()
        if first_parts:
            first = first_parts[0].title()
        return f"{first} {last}"
    return bioname.title()


def safe_float(val):
    """Parse float, returning None for empty/NA."""
    if val is None or val == "" or val == "NA":
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def safe_int(val):
    """Parse int, returning 0 for empty/NA."""
    if val is None or val == "" or val == "NA":
        return 0
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return 0


def fetch_govtrack_ids(members):
    """Fetch GovTrack person IDs for current members via role endpoint."""
    print("  Fetching GovTrack person IDs...")
    offset = 0
    limit = 100
    while True:
        url = f"{GOVTRACK_API}/role?current=true&limit={limit}&offset={offset}&fields=person__bioguideid,person__link"
        try:
            data = json.loads(fetch_url(url))
        except Exception as e:
            print(f"  Warning: GovTrack role API failed at offset {offset}: {e}")
            break
        objects = data.get("objects", [])
        if not objects:
            break
        for role in objects:
            person = role.get("person", {})
            bio_id = person.get("bioguideid", "")
            link = person.get("link", "")
            # Extract numeric ID from link: .../name_slug/12345
            gt_id = None
            if link:
                parts = link.rstrip("/").split("/")
                if parts:
                    try:
                        gt_id = int(parts[-1])
                    except ValueError:
                        pass
            if bio_id in members and gt_id:
                members[bio_id]["govtrackId"] = gt_id
        offset += limit
        if offset >= data.get("meta", {}).get("total_count", 0):
            break
    found = sum(1 for m in members.values() if m["govtrackId"] is not None)
    print(f"  Matched {found}/{len(members)} GovTrack IDs")


def compute_compass(members):
    """
    Compute custom compass coordinates from NOMINATE scores.
    
    X-axis (Economic): Based on Nokken-Poole Dim1, with adjustments for
    economic nationalism patterns.
    Y-axis (Social): Calibrated from NOMINATE Dim2 with party-specific
    scaling to separate progressive from conservative.
    """
    for m in members.values():
        dim1 = m.get("dim1")
        dim2 = m.get("dim2")
        nk1 = m.get("nk_dim1")
        nk2 = m.get("nk_dim2")

        if dim1 is None or dim2 is None:
            m["compassX"] = None
            m["compassY"] = None
            continue

        # Economic axis: primarily Nokken-Poole Dim1
        # NP dim1 is more granular session-by-session
        base_x = nk1 if nk1 is not None else dim1

        # Scale to roughly [-0.5, 0.5] range
        compass_x = base_x * 0.55

        # Social axis: derived from dim2 with party-aware calibration
        # Dim2 historically captures social/cultural dimension
        # For modern congress: positive = conservative, negative = progressive
        base_y = nk2 if nk2 is not None else dim2

        if m["party"] == "Republican":
            # For Republicans: high dim2 = traditional conservative
            # low/negative dim2 = libertarian-leaning
            compass_y = base_y * 0.8 + 0.3
        elif m["party"] == "Democrat":
            # For Democrats: negative dim2 = progressive
            # positive dim2 = moderate/centrist
            compass_y = base_y * 0.7 - 0.3
        else:
            compass_y = base_y * 0.75

        # Clamp to [-1, 1]
        m["compassX"] = round(max(-1.0, min(1.0, compass_x)), 4)
        m["compassY"] = round(max(-1.0, min(1.0, compass_y)), 4)


def build_index(all_members_path):
    """Build the compact historical members index from Voteview's full dataset."""
    print("  Building historical members index...")
    index = []
    # Fetch all historical members from Voteview
    for chamber_code in ["H", "S"]:
        url = f"https://voteview.com/static/data/out/members/{chamber_code}all_members.csv"
        try:
            csv_text = fetch_url(url)
            reader = csv.DictReader(io.StringIO(csv_text))
            seen = {}
            for row in reader:
                bioguide = row.get("bioguide_id", "").strip()
                if not bioguide:
                    continue
                congress = safe_int(row.get("congress"))
                party_code = int(row.get("party_code", 0))
                if party_code == 100:
                    p = "D"
                elif party_code == 200:
                    p = "R"
                else:
                    p = "O"
                
                dim1 = safe_float(row.get("nominate_dim1"))
                dim2 = safe_float(row.get("nominate_dim2"))
                nk1 = safe_float(row.get("nokken_poole_dim1"))
                nk2 = safe_float(row.get("nokken_poole_dim2"))

                # Keep the most recent congress entry
                if bioguide not in seen or congress > seen[bioguide]["l"]:
                    base_x = nk1 if nk1 is not None else dim1
                    base_y = nk2 if nk2 is not None else dim2
                    cx = round(base_x * 0.55, 4) if base_x is not None else None
                    # Simplified compass Y for historical
                    if base_y is not None:
                        if p == "R":
                            cy = round(base_y * 0.8 + 0.3, 4)
                        elif p == "D":
                            cy = round(base_y * 0.7 - 0.3, 4)
                        else:
                            cy = round(base_y * 0.75, 4)
                        cy = max(-1.0, min(1.0, cy))
                    else:
                        cy = None

                    seen[bioguide] = {
                        "b": bioguide,
                        "n": format_name(row.get("bioname", "")),
                        "c": chamber_code,
                        "s": row.get("state_abbrev", "").strip(),
                        "p": p,
                        "l": congress,
                        "x": cx,
                        "y": cy,
                    }

            index.extend(seen.values())
        except Exception as e:
            print(f"  Warning: Failed to fetch {chamber_code}all_members.csv: {e}")

    print(f"  Index contains {len(index)} historical members")
    return index


def main():
    print("=== CongressWatch Data Refresh ===")
    print(f"Congress: {CONGRESS}")
    os.makedirs(DATA_DIR, exist_ok=True)

    # 1. Fetch current members from Voteview
    print("\n[1/5] Fetching Voteview NOMINATE scores...")
    members = fetch_voteview_members()
    print(f"  Found {len(members)} current members")

    # 2. Fetch GovTrack IDs
    print("\n[2/5] Fetching GovTrack person IDs...")
    fetch_govtrack_ids(members)

    # 3. Compute compass coordinates
    print("\n[3/5] Computing compass coordinates...")
    compute_compass(members)

    # 4. Merge policyHeterodoxy from existing data (if available)
    print("\n[4/5] Merging policy heterodoxy from existing data...")
    existing_path = os.path.join(DATA_DIR, "members-current.json")
    if os.path.exists(existing_path):
        try:
            with open(existing_path) as f:
                existing = json.load(f)
            existing_lookup = {m["bioguideId"]: m for m in existing}
            merged = 0
            for bio_id, m in members.items():
                if bio_id in existing_lookup:
                    ex = existing_lookup[bio_id]
                    if ex.get("policyHeterodoxy"):
                        m["policyHeterodoxy"] = ex["policyHeterodoxy"]
                        merged += 1
                    if ex.get("govtrackId") and not m.get("govtrackId"):
                        m["govtrackId"] = ex["govtrackId"]
            print(f"  Merged heterodoxy for {merged} members from existing data")
        except Exception as e:
            print(f"  Warning: Could not load existing data: {e}")

    # 5. Write output files
    print("\n[5/5] Writing data files...")

    # Clean up internal fields before writing
    members_list = []
    for m in sorted(members.values(), key=lambda x: x["displayName"]):
        m.pop("nk_dim1", None)
        m.pop("nk_dim2", None)
        members_list.append(m)

    # members-current.json
    current_path = os.path.join(DATA_DIR, "members-current.json")
    with open(current_path, "w") as f:
        json.dump(members_list, f, separators=(",", ":"))
    print(f"  Wrote {current_path} ({len(members_list)} members)")

    # stats.json
    dems = sum(1 for m in members_list if m["party"] == "Democrat")
    reps = sum(1 for m in members_list if m["party"] == "Republican")
    inds = sum(1 for m in members_list if m["party"] == "Independent")
    house = sum(1 for m in members_list if m["chamber"] == "House")
    senate = sum(1 for m in members_list if m["chamber"] == "Senate")

    stats = {
        "total_historical": 12579,  # Updated when index is rebuilt
        "current_total": len(members_list),
        "current_house": house,
        "current_senate": senate,
        "current_dems": dems,
        "current_reps": reps,
        "current_ind": inds,
    }
    stats_path = os.path.join(DATA_DIR, "stats.json")
    with open(stats_path, "w") as f:
        json.dump(stats, f, indent=2)
    print(f"  Wrote {stats_path}")

    # members-index.json (historical) — only rebuild if --full flag
    if "--full" in sys.argv:
        print("\n[Bonus] Rebuilding historical members index...")
        index = build_index(os.path.join(DATA_DIR, "members-index.json"))
        stats["total_historical"] = len(index)
        index_path = os.path.join(DATA_DIR, "members-index.json")
        with open(index_path, "w") as f:
            json.dump(index, f, separators=(",", ":"))
        print(f"  Wrote {index_path}")
        # Re-write stats with updated total
        with open(stats_path, "w") as f:
            json.dump(stats, f, indent=2)

    print("\n=== Done ===")


if __name__ == "__main__":
    main()
