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
            # Update party to most recent congress
            party_code = int(row.get("party_code", 0) or 0)
            m["party"] = party_map.get(party_code, "O")

        # Prefer Nokken-Poole (congress-specific) over DW-NOMINATE (career-wide)
        nk1 = safe_float(row.get("nokken_poole_dim1", ""))
        nk2 = safe_float(row.get("nokken_poole_dim2", ""))
        dim1 = safe_float(row.get("nominate_dim1", ""))
        dim2 = safe_float(row.get("nominate_dim2", ""))
        best1 = nk1 if nk1 is not None else dim1
        best2 = nk2 if nk2 is not None else dim2
        if best1 is not None and best2 is not None and cong > m["best_congress"]:
            m["dim1"] = best1
            m["dim2"] = best2
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


# Members to exclude from current congress (e.g. VP, resigned before being sworn in)
EXCLUDE_CURRENT = {
    "V000137",  # JD Vance — elected VP, never served in 119th Congress
}


def compute_career_vote_stats(members, index):
    """Compute career-total yea/nay/NV/total for each current member from local Voteview files.

    Voteview cast codes:
      1 = Yea (also 2=Paired Yea, 3=Announced Yea — counted as Yea)
      4 = Announced Nay, 5 = Paired Nay, 6 = Nay — counted as Nay
      7 = Present
      8 = Not Voting
      9 = Not Voting / absent
      0 = Not a member that congress (excluded)

    Reads every H*.json and S*.json in data/votes/ to cover the full career.
    Uses the ICPSR in members-index to match vote strings to members.
    """
    print("=== Computing career vote stats from Voteview files ===")

    # Build ICPSR -> bioguide map from full index
    icpsr_to_bio = {str(m["i"]): m["b"] for m in index if m.get("i")}

    # Also build set of current member bioguides for quick lookup
    current_bios = {m["b"] for m in members}

    # Accumulators: bio -> [yea, nay, nv, present]
    stats = {bio: [0, 0, 0, 0] for bio in current_bios}

    files = sorted(
        f for f in os.listdir(VOTES_DIR)
        if f.endswith(".json") and (f.startswith("H") or f.startswith("S"))
    )

    for fname in files:
        try:
            with open(os.path.join(VOTES_DIR, fname)) as f:
                data = json.load(f)
        except Exception:
            continue

        for icpsr, vote_str in data.get("v", {}).items():
            bio = icpsr_to_bio.get(icpsr)
            if not bio or bio not in stats:
                continue
            s = stats[bio]
            for code in vote_str:
                if code in ("1", "2", "3"):
                    s[0] += 1  # yea
                elif code in ("4", "5", "6"):
                    s[1] += 1  # nay
                elif code in ("8", "9"):
                    s[2] += 1  # nv
                elif code == "7":
                    s[3] += 1  # present

    result = {}
    for bio, (yea, nay, nv, present) in stats.items():
        total = yea + nay + nv + present
        result[bio] = {"yea": yea, "nay": nay, "nv": nv, "present": present, "total": total}

    matched = sum(1 for v in result.values() if v["total"] > 0)
    print(f"  Done: {matched}/{len(current_bios)} current members have vote data across {len(files)} files")
    return result


def update_members_current(congress, index):
    """Generate members-current.json for app's compass/detail pages."""
    print("=== Updating members-current.json ===")

    current = [m for m in index if m["l"] == congress and m["b"] not in EXCLUDE_CURRENT]
    excluded = [m for m in index if m["l"] == congress and m["b"] in EXCLUDE_CURRENT]
    if excluded:
        print(f"  Excluded from current: {[m['n'] for m in excluded]}")

    # Load existing members-current.json for policyHeterodoxy preservation
    current_path = os.path.join(DATA_DIR, "members-current.json")
    old_lookup = {}
    try:
        with open(current_path, "r") as f:
            for m in json.load(f):
                old_lookup[m.get("bioguideId", "")] = m
    except (FileNotFoundError, json.JSONDecodeError):
        pass

    # Load LLM scores (primary source for compass coordinates)
    llm_path = os.path.join(DATA_DIR, "llm-scores.json")
    llm_lookup = {}
    try:
        with open(llm_path, "r") as f:
            llm_lookup = json.load(f).get("scores", {})
        print(f"  Loaded {len(llm_lookup)} LLM scores")
    except (FileNotFoundError, json.JSONDecodeError):
        print("  WARNING: llm-scores.json not found, falling back to social/NOMINATE scores")

    # Load social scores (fallback if LLM score unavailable)
    social_path = os.path.join(DATA_DIR, "social-scores.json")
    social_lookup = {}
    try:
        with open(social_path, "r") as f:
            social_lookup = json.load(f).get("scores", {})
        print(f"  Loaded {len(social_lookup)} social scores (fallback)")
    except (FileNotFoundError, json.JSONDecodeError):
        print("  WARNING: social-scores.json not found, using dim2 fallback for all")

    # Load member metrics (policy fingerprint, party alignment)
    metrics_path = os.path.join(DATA_DIR, "member-metrics.json")
    metrics_lookup = {}
    try:
        with open(metrics_path, "r") as f:
            metrics_lookup = json.load(f)
        print(f"  Loaded {len(metrics_lookup)} member metrics")
    except (FileNotFoundError, json.JSONDecodeError):
        print("  WARNING: member-metrics.json not found, policyFingerprint will be empty")

    party_names = {"D": "Democrat", "R": "Republican", "O": "Independent"}

    # Compute career vote stats from local Voteview files
    career_stats = compute_career_vote_stats(current, index)

    members_out = []
    score_source_counts = {"llm": 0, "social_votes": 0, "nominate": 0}

    for m in current:
        bio = m["b"]
        old = old_lookup.get(bio, {})
        dim1 = m.get("x")
        dim2 = m.get("y")

        # ── Compass coordinates — three-tier fallback chain ──────────────────
        # 1. LLM normalized scores (primary)
        # 2. social-scores.json (curated votes + NumbersUSA)
        # 3. NOMINATE dim1/dim2 from Voteview

        llm = llm_lookup.get(bio, {})
        icpsr_str = str(m.get("i", ""))
        ss = social_lookup.get(icpsr_str, {})

        llm_econ   = llm.get("econ_normalized")
        llm_social = llm.get("social_normalized")
        social_score = ss.get("score") if ss and not ss.get("fallback", True) else None

        if llm_econ is not None and llm_social is not None:
            compass_x    = round(max(-1, min(1, llm_econ)),   4)
            compass_y    = round(max(-1, min(1, llm_social)),  4)
            score_source = "llm"
        elif social_score is not None:
            compass_x    = round(max(-1, min(1, dim1)),        4) if dim1 is not None else None
            compass_y    = round(max(-1, min(1, social_score)),4)
            score_source = "social_votes"
        else:
            compass_x    = round(max(-1, min(1, dim1)), 4) if dim1 is not None else None
            compass_y    = round(max(-1, min(1, dim2)), 4) if dim2 is not None else None
            score_source = "nominate"

        score_source_counts[score_source] += 1

        # ── Policy fingerprint (replaces policyHeterodoxy) ───────────────────
        metrics = metrics_lookup.get(bio, {})
        policy_fingerprint = metrics.get("policy_fingerprint") or old.get("policyHeterodoxy", {})
        party_alignment    = metrics.get("party_alignment_overall")

        members_out.append({
            "bioguideId":       bio,
            "displayName":      m["n"],
            "chamber":          "House" if m["c"] == "H" else "Senate",
            "state":            m["s"],
            "district":         None,
            "party":            party_names.get(m["p"], "Independent"),
            "partyCode":        {"D": "100", "R": "200"}.get(m["p"], "328"),
            "born":             old.get("born"),
            "lastCongress":     congress,
            "dim1":             round(dim1, 3) if dim1 is not None else None,
            "dim2":             round(dim2, 3) if dim2 is not None else None,
            # Preserve career stats from old file if CI only has partial vote history.
            # max() ensures a fresh CI run (with only 1-2 congress vote files) never
            # overwrites the full career totals computed locally from all 238 files.
            "numVotes":         max(career_stats.get(bio, {}).get("total", 0), old.get("numVotes", 0)),
            "careerYea":        max(career_stats.get(bio, {}).get("yea", 0),   old.get("careerYea", 0)),
            "careerNay":        max(career_stats.get(bio, {}).get("nay", 0),   old.get("careerNay", 0)),
            "careerNV":         max(career_stats.get(bio, {}).get("nv", 0),    old.get("careerNV", 0)),
            "compassX":         compass_x,
            "compassY":         compass_y,
            # LLM score fields
            "llmEconScore":     llm_econ,
            "llmSocialScore":   llm_social,
            "llmLowConfidence": llm.get("low_confidence", False),
            "scoreSource":      score_source,
            # Legacy social-score fields (kept for backward compat)
            "socialScore":      social_score,
            "socialVotes":      ss.get("socialVotes", 0) if ss else 0,
            "socialFallback":   not bool(social_score),
            # Metrics
            "policyFingerprint":  policy_fingerprint,
            "partyAlignmentRate": party_alignment,
            "govtrackId":         old.get("govtrackId") or m.get("g"),
            "isCurrent":          True,
        })

    members_out.sort(key=lambda x: x["displayName"])

    with open(current_path, "w") as f:
        json.dump(members_out, f, separators=(",", ":"))

    print(f"  {len(members_out)} current members written")
    print(f"  Score sources: LLM={score_source_counts['llm']}  "
          f"social_votes={score_source_counts['social_votes']}  "
          f"nominate={score_source_counts['nominate']}")
    return members_out


def populate_govtrack_ids(members_current):
    """Fetch GovTrack person IDs for all current members via the role API.

    Uses /api/v2/role?current=true to get all current roles in bulk, then
    maps bioguide_id -> person.id and patches members_current in place.
    Only fetches for members that are still missing govtrackId.
    """
    missing = [m for m in members_current if not m.get("govtrackId")]
    if not missing:
        print("=== GovTrack IDs: all members already have IDs, skipping ===")
        return

    print(f"=== Fetching GovTrack person IDs for {len(missing)} members ===")

    bio_to_gtid = {}
    offset = 0
    page_size = 100

    while True:
        url = (
            f"https://www.govtrack.us/api/v2/role"
            f"?current=true&limit={page_size}&offset={offset}"
        )
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, context=ctx, timeout=30) as r:
                data = json.loads(r.read())
        except Exception as e:
            print(f"  WARNING: GovTrack role API failed at offset {offset}: {e}")
            break

        objects = data.get("objects", [])
        for role in objects:
            person = role.get("person") or {}
            bio = person.get("bioguideid") or ""
            # Numeric person ID is not directly in the response but is
            # in the link URL: /congress/members/name/300025
            link = person.get("link") or ""
            pid = None
            if link:
                parts = [p for p in link.rstrip("/").split("/") if p.isdigit()]
                if parts:
                    pid = int(parts[-1])
            if bio and pid:
                bio_to_gtid[bio] = pid

        total = data.get("meta", {}).get("total_count", 0)
        offset += len(objects)
        if offset >= total or not objects:
            break

    patched = 0
    for m in members_current:
        if not m.get("govtrackId"):
            gid = bio_to_gtid.get(m["bioguideId"])
            if gid:
                m["govtrackId"] = gid
                patched += 1

    print(f"  Patched {patched}/{len(missing)} members with GovTrack person IDs")
    if patched < len(missing):
        still_missing = [m["bioguideId"] for m in members_current if not m.get("govtrackId")]
        print(f"  Still missing: {still_missing[:10]}{'...' if len(still_missing) > 10 else ''}")


def update_stats(members_current, index):
    """Regenerate stats.json using GovTrack API for current member counts.
    
    Voteview includes all members who served in a congress (including resigned/replaced),
    while GovTrack tracks only currently serving members. We use GovTrack for accurate
    current counts and the index for the historical total.
    """
    print("=== Updating stats.json ===")

    # Try GovTrack API for accurate current counts
    govtrack_api = "https://www.govtrack.us/api/v2/role?current=true&limit=1"

    def get_count(extra=""):
        url = govtrack_api + extra
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, context=ctx, timeout=30) as r:
            data = json.loads(r.read())
            return data.get("meta", {}).get("total_count", 0)

    try:
        total = get_count()
        house = get_count("&role_type=representative")
        senate = get_count("&role_type=senator")
        dems = get_count("&party=Democrat")
        reps = get_count("&party=Republican")
        inds = total - dems - reps
        print(f"  GovTrack API: Total={total} H={house} S={senate} D={dems} R={reps} I={inds}")
    except Exception as e:
        print(f"  GovTrack API failed ({e}), falling back to Voteview counts")
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
        total = len(members_current)

    # Compute full-congress totals from Voteview (includes resigned/replaced members)
    vv_house = sum(1 for m in members_current if m["chamber"] == "House")
    vv_senate = sum(1 for m in members_current if m["chamber"] == "Senate")
    vv_total = len(members_current)

    stats = {
        "total_historical": len(index),
        "current_total": total,
        "current_house": house,
        "current_senate": senate,
        "current_dems": dems,
        "current_reps": reps,
        "current_ind": inds,
        "congress": int(sys.argv[1]) if len(sys.argv) > 1 else 119,
        "congress_total": vv_total,
        "congress_house": vv_house,
        "congress_senate": vv_senate,
    }

    with open(os.path.join(DATA_DIR, "stats.json"), "w") as f:
        json.dump(stats, f, separators=(",", ":"))

    print(f"  Written: Total={total} (H:{house} S:{senate} D:{dems} R:{reps} I:{inds})")


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
    populate_govtrack_ids(current)
    # Re-write members-current.json now that govtrackIds are populated
    current_path = os.path.join(DATA_DIR, "members-current.json")
    with open(current_path, "w") as f:
        json.dump(current, f, separators=(",", ":"))
    update_stats(current, index)
    update_vote_data(congress)

    print("\nDone!")


if __name__ == "__main__":
    main()
