#!/usr/bin/env python3
"""
Update current-congress data files from Voteview.

This script is designed to be run by a GitHub Action on a schedule.
It refreshes:
  1. data/members-index.json   — full member list with latest ICPSR/NOMINATE scores
  2. data/members-current.json — current congress members in the app's format
  3. data/votes/H{congress}.json, S{congress}.json — current congress voting records
  4. data/stats.json           — member count statistics

Usage:
  python3 scripts/update_current.py          # defaults to congress 119
  python3 scripts/update_current.py 120      # when a new congress starts
"""
import csv
import io
import json
import os
import ssl
import sys
import time
import urllib.request

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(ROOT_DIR, "data")
VOTES_DIR = os.path.join(DATA_DIR, "votes")

BASE_URL = "https://voteview.com/static/data/out"

# SSL context (macOS Python sometimes can't verify Voteview's cert)
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE


def fetch(url, retries=3):
    """Download a URL with retries."""
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0",
                "Accept-Encoding": "identity",
            })
            with urllib.request.urlopen(req, context=ctx, timeout=180) as r:
                chunks = []
                while True:
                    chunk = r.read(65536)
                    if not chunk:
                        break
                    chunks.append(chunk)
                return b"".join(chunks).decode("utf-8")
        except Exception as e:
            if attempt < retries:
                wait = 3 * (attempt + 1)
                print(f"  retry {attempt+1} (wait {wait}s): {e}")
                time.sleep(wait)
            else:
                raise


def title_case(s):
    return " ".join(w.capitalize() for w in s.lower().split())


def format_name(bioname):
    """Convert 'LAST, First Middle' to 'First Last'."""
    if not bioname:
        return ""
    bioname = bioname.strip().strip('"')
    if "," not in bioname:
        return title_case(bioname)
    parts = bioname.split(",", 1)
    last = title_case(parts[0].strip())
    first = parts[1].strip() if len(parts) > 1 else ""
    if first:
        paren = first.find("(")
        if paren >= 0:
            first = first[paren + 1:].replace(")", "").strip()
        first = first.split()[0]  # first word only
        return f"{first} {last}"
    return last


def safe_float(val):
    if not val or val == "NA":
        return None
    try:
        return float(val)
    except ValueError:
        return None


def update_members_index(congress):
    """Rebuild members-index.json from HSall_members.csv."""
    print("=== Updating members-index.json ===")
    url = f"{BASE_URL}/members/HSall_members.csv"
    text = fetch(url)
    reader = csv.DictReader(io.StringIO(text))

    # Load existing for govtrackId preservation
    index_path = os.path.join(DATA_DIR, "members-index.json")
    existing = {}
    try:
        with open(index_path, "r") as f:
            for m in json.load(f):
                if m.get("b"):
                    existing[m["b"]] = m
    except FileNotFoundError:
        pass

    party_map = {100: "D", 200: "R"}
    members = {}

    for row in reader:
        bioguide = row.get("bioguide_id", "").strip()
        icpsr = int(row.get("icpsr", 0) or 0)
        cong = int(row.get("congress", 0) or 0)
        chamber = row.get("chamber", "").strip()
        if chamber.lower() == "house":
            chamber = "H"
        elif chamber.lower() == "senate":
            chamber = "S"

        if not icpsr or not cong:
            continue

        key = bioguide if bioguide else f"icpsr:{icpsr}"

        if key not in members:
            party_code = int(row.get("party_code", 0) or 0)
            members[key] = {
                "bioguide": bioguide,
                "name": format_name(row.get("bioname", "")),
                "chamber": chamber,
                "state": row.get("state_abbrev", "").strip(),
                "party": party_map.get(party_code, "O"),
                "first_congress": cong,
                "last_congress": cong,
                "icpsr": icpsr,
                "dim1": None,
                "dim2": None,
                "best_congress": 0,
            }

        m = members[key]
        if cong < m["first_congress"]:
            m["first_congress"] = cong
        if cong > m["last_congress"]:
            m["last_congress"] = cong
            m["chamber"] = chamber
        if cong >= m["last_congress"]:
            m["icpsr"] = icpsr

        dim1 = safe_float(row.get("nominate_dim1", ""))
        dim2 = safe_float(row.get("nominate_dim2", ""))
        if dim1 is not None and dim2 is not None and cong > m["best_congress"]:
            m["dim1"] = dim1
            m["dim2"] = dim2
            m["best_congress"] = cong

    output = []
    for key, m in members.items():
        if not m["bioguide"]:
            continue
        old = existing.get(m["bioguide"], {})
        entry = {
            "b": m["bioguide"],
            "n": m["name"],
            "c": m["chamber"],
            "s": m["state"],
            "p": m["party"],
            "l": m["last_congress"],
            "x": round(m["dim1"], 4) if m["dim1"] is not None else None,
            "y": round(m["dim2"], 4) if m["dim2"] is not None else None,
        }
        if old.get("g"):
            entry["g"] = old["g"]
        entry["i"] = m["icpsr"]
        entry["fc"] = m["first_congress"]
        output.append(entry)

    output.sort(key=lambda x: x["b"])

    with open(index_path, "w") as f:
        json.dump(output, f, separators=(",", ":"))

    c_now = [m for m in output if m["l"] == congress]
    print(f"  {len(output)} total members, {len(c_now)} in Congress {congress}")
    return output


def update_members_current(congress, index):
    """Generate members-current.json for app's compass/detail pages."""
    print("=== Updating members-current.json ===")

    current = [m for m in index if m["l"] == congress]

    # Load existing members-current.json for policyHeterodoxy preservation
    current_path = os.path.join(DATA_DIR, "members-current.json")
    old_lookup = {}
    try:
        with open(current_path, "r") as f:
            for m in json.load(f):
                old_lookup[m.get("bioguideId", "")] = m
    except (FileNotFoundError, json.JSONDecodeError):
        pass

    party_names = {"D": "Democrat", "R": "Republican", "O": "Independent"}

    members_out = []
    for m in current:
        bio = m["b"]
        old = old_lookup.get(bio, {})
        dim1 = m.get("x")
        dim2 = m.get("y")

        # Compute compass coordinates
        compass_x = None
        compass_y = None
        if dim1 is not None and dim2 is not None:
            nk1 = dim1  # Use NOMINATE dim1 as approximation
            compass_x = round(max(-1, min(1, nk1 * 0.55)), 4)
            party = m["p"]
            if party == "R":
                compass_y = round(max(-1, min(1, dim2 * 0.8 + 0.3)), 4)
            elif party == "D":
                compass_y = round(max(-1, min(1, dim2 * 0.7 - 0.3)), 4)
            else:
                compass_y = round(max(-1, min(1, dim2 * 0.75)), 4)

        members_out.append({
            "bioguideId": bio,
            "displayName": m["n"],
            "chamber": "House" if m["c"] == "H" else "Senate",
            "state": m["s"],
            "district": None,
            "party": party_names.get(m["p"], "Independent"),
            "partyCode": {"D": "100", "R": "200"}.get(m["p"], "328"),
            "born": old.get("born"),
            "lastCongress": congress,
            "dim1": round(dim1, 3) if dim1 is not None else None,
            "dim2": round(dim2, 3) if dim2 is not None else None,
            "numVotes": old.get("numVotes", 0),
            "compassX": compass_x,
            "compassY": compass_y,
            "govtrackId": old.get("govtrackId") or m.get("g"),
            "isCurrent": True,
            "policyHeterodoxy": old.get("policyHeterodoxy", {}),
        })

    members_out.sort(key=lambda x: x["displayName"])

    with open(current_path, "w") as f:
        json.dump(members_out, f, separators=(",", ":"))

    print(f"  {len(members_out)} current members written")
    return members_out


def update_stats(members_current):
    """Regenerate stats.json from current members."""
    print("=== Updating stats.json ===")
    house = senate = dems = reps = inds = 0
    for m in members_current:
        if m["chamber"] == "House":
            house += 1
        else:
            senate += 1
        p = m["party"]
        if p == "Democrat":
            dems += 1
        elif p == "Republican":
            reps += 1
        else:
            inds += 1

    stats = {
        "total_historical": 12579,
        "current_total": len(members_current),
        "current_house": house,
        "current_senate": senate,
        "current_dems": dems,
        "current_reps": reps,
        "current_ind": inds,
    }

    with open(os.path.join(DATA_DIR, "stats.json"), "w") as f:
        json.dump(stats, f, separators=(",", ":"))

    print(f"  Total: {len(members_current)} (H:{house} S:{senate} D:{dems} R:{reps} I:{inds})")


def update_vote_data(congress):
    """Refresh vote data for the current congress (both chambers)."""
    print(f"=== Updating vote data for Congress {congress} ===")
    os.makedirs(VOTES_DIR, exist_ok=True)

    for chamber in ["H", "S"]:
        key = f"{chamber}{congress}"
        padded = f"{chamber}{congress:03d}" if congress < 100 else key
        out_path = os.path.join(VOTES_DIR, f"{key}.json")

        print(f"  {key}... ", end="", flush=True)

        try:
            votes_text = fetch(f"{BASE_URL}/votes/{padded}_votes.csv")
            rolls_text = fetch(f"{BASE_URL}/rollcalls/{padded}_rollcalls.csv")
        except Exception as e:
            print(f"FETCH ERROR: {e}")
            continue

        rollcalls_raw = list(csv.DictReader(io.StringIO(rolls_text)))
        if not rollcalls_raw:
            print("no rollcalls")
            continue

        rollcall_order = []
        rollcalls = []
        for rc in rollcalls_raw:
            rn = rc.get("rollnumber", "").strip()
            rollcall_order.append(rn)
            desc = (rc.get("dtl_desc", "") or rc.get("vote_desc", "")).strip()
            if len(desc) > 200:
                desc = desc[:197] + "..."
            rollcalls.append([
                int(rn) if rn.isdigit() else rn,
                rc.get("date", "").strip(),
                rc.get("bill_number", "").strip(),
                rc.get("vote_question", "").strip(),
                rc.get("vote_result", "").strip(),
                int(rc.get("yea_count", "0").strip() or "0"),
                int(rc.get("nay_count", "0").strip() or "0"),
                desc,
            ])

        icpsr_votes = {}
        for line in votes_text.split("\n")[1:]:
            if not line.strip():
                continue
            parts = line.split(",")
            if len(parts) < 5:
                continue
            icpsr = parts[3].strip()
            rollnum = parts[2].strip()
            cc = parts[4].strip()
            cast_code = int(cc) if cc.isdigit() else 9
            if cast_code > 9:
                cast_code = 9
            if icpsr not in icpsr_votes:
                icpsr_votes[icpsr] = {}
            icpsr_votes[icpsr][rollnum] = cast_code

        votes = {}
        for icpsr, vote_map in icpsr_votes.items():
            codes = [str(vote_map.get(rn, 0)) for rn in rollcall_order]
            votes[icpsr] = "".join(codes)

        data = {"r": rollcalls, "v": votes}
        with open(out_path, "w") as f:
            json.dump(data, f, separators=(",", ":"))

        size = os.path.getsize(out_path)
        print(f"ok ({size:,}b, {len(rollcalls)} rolls, {len(votes)} members)")


def main():
    congress = int(sys.argv[1]) if len(sys.argv) > 1 else 119
    print(f"Updating data for Congress {congress}\n")

    index = update_members_index(congress)
    current = update_members_current(congress, index)
    update_stats(current)
    update_vote_data(congress)

    print("\nDone!")


if __name__ == "__main__":
    main()
