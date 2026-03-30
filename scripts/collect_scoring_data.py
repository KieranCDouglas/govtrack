#!/usr/bin/env python3
"""
Collect and cache per-member scoring inputs for the LLM ideology pipeline.

For each current member of Congress, fetches and caches:
  1. Voting records across Congress 117, 118, and 119 (from local vote JSON files)
  2. Bill titles from Congress.gov API (cached)
  3. Sponsored/cosponsored legislation from GovTrack API (no key required)
  4. Committee assignments from unitedstates/congress-legislators (no key required)

Output: data/scoring-inputs/{bioguideId}.json per member
        data/bill-cache.json
        data/sponsorship-cache.json
        data/committee-cache.json

Usage:
  python3 scripts/collect_scoring_data.py              # all current members
  python3 scripts/collect_scoring_data.py --members S000033,C001098
"""
import argparse
import json
import os
import re
import ssl
import time
import urllib.request
import urllib.error

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR   = os.path.dirname(SCRIPT_DIR)
DATA_DIR   = os.path.join(ROOT_DIR, "data")
VOTES_DIR  = os.path.join(DATA_DIR, "votes")
INPUTS_DIR = os.path.join(DATA_DIR, "scoring-inputs")

BILL_CACHE_PATH        = os.path.join(DATA_DIR, "bill-cache.json")
SPONSORSHIP_CACHE_PATH = os.path.join(DATA_DIR, "sponsorship-cache.json")
COMMITTEE_CACHE_PATH   = os.path.join(DATA_DIR, "committee-cache.json")

CONGRESS_API_KEY  = os.environ.get("CONGRESS_API_KEY", "")
_SKIP_CONGRESS_API = not CONGRESS_API_KEY
CONGRESS_BASE     = "https://api.congress.gov/v3"

GOVTRACK_BASE     = "https://www.govtrack.us/api/v2"
LEGISLATORS_BASE  = "https://unitedstates.github.io/congress-legislators"

# Congresses to pull votes from (most recent first for prompt ordering)
VOTE_CONGRESSES = [119, 118, 117]

# Max substantive votes to include per congress (keeps prompts manageable)
MAX_VOTES_PER_CONGRESS = 150

# SSL context — macOS sometimes can't verify certs
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode    = ssl.CERT_NONE

# ── Procedural vote filter ────────────────────────────────────────────────────

PROCEDURAL_PATTERNS = [
    r"on the journal",
    r"on the motion to (table|proceed|adjourn|recommit|waive|instruct|concur)",
    r"on ordering the previous question",
    r"on cloture",
    r"on motion to commit",
    r"quorum call",
    r"sine die",
    r"engrossment",
    r"on (the )?nomination",
    r"on the amendment$",
]
PROCEDURAL_RE      = re.compile("|".join(PROCEDURAL_PATTERNS), re.IGNORECASE)
PROCEDURAL_BILL_RE = re.compile(r"^PN\d", re.IGNORECASE)


def is_procedural(question, bill_number):
    if PROCEDURAL_BILL_RE.match(bill_number or ""):
        return True
    q = (question or "").strip()
    if re.match(r"on the amendment$", q, re.IGNORECASE) and not (bill_number or "").strip():
        return True
    return bool(PROCEDURAL_RE.search(q))


# ── HTTP helpers ──────────────────────────────────────────────────────────────

def fetch_json(url, retries=2, delay=1.0, timeout=10):
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Civicism/1.0"})
            with urllib.request.urlopen(req, context=ctx, timeout=timeout) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = 60 * (attempt + 1)
                print(f"    rate-limited, waiting {wait}s…")
                time.sleep(wait)
            elif e.code == 403:
                return None
            elif attempt < retries:
                time.sleep(delay * (attempt + 1))
            else:
                return None
        except Exception:
            if attempt < retries:
                time.sleep(delay * (attempt + 1))
            else:
                return None
    return None


# ── Congress.gov: bill titles ─────────────────────────────────────────────────

def normalize_bill_number(raw):
    raw = (raw or "").strip().upper()
    patterns = [
        (r"^H\.?R\.?(\d+)$",        "hr"),
        (r"^S\.?(\d+)$",             "s"),
        (r"^HRES\.?(\d+)$",          "hres"),
        (r"^SRES\.?(\d+)$",          "sres"),
        (r"^HJRES\.?(\d+)$",         "hjres"),
        (r"^SJRES\.?(\d+)$",         "sjres"),
        (r"^HCONRES\.?(\d+)$",       "hconres"),
        (r"^SCONRES\.?(\d+)$",       "sconres"),
        (r"^S\.?CON\.?RES\.?(\d+)$", "sconres"),
        (r"^H\.?CON\.?RES\.?(\d+)$", "hconres"),
    ]
    for pat, bill_type in patterns:
        m = re.match(pat, raw)
        if m:
            return bill_type, m.group(1)
    return None, None


def get_bill_title(bill_number, congress, bill_cache):
    if not bill_number:
        return None
    key = f"{congress}/{bill_number}"
    if key in bill_cache:
        return bill_cache[key]
    if _SKIP_CONGRESS_API:
        return None

    bill_type, num = normalize_bill_number(bill_number)
    if not bill_type:
        return None

    url = f"{CONGRESS_BASE}/bill/{congress}/{bill_type}/{num}?api_key={CONGRESS_API_KEY}"
    data = fetch_json(url)
    title = None
    if data and "bill" in data:
        title = data["bill"].get("title") or data["bill"].get("shortTitle")
    if title is not None:
        bill_cache[key] = title
    time.sleep(0.5)
    return title


# ── GovTrack: sponsored + cosponsored bills ───────────────────────────────────

def get_sponsorships_govtrack(govtrack_id, sponsorship_cache):
    """
    Fetch sponsored and cosponsored bills from GovTrack API across congresses 117-119.
    No API key required. Results cached in sponsorship-cache.json.
    """
    key = f"gt/{govtrack_id}"
    if key in sponsorship_cache:
        cached = sponsorship_cache[key]
        return cached.get("sponsored", []), cached.get("cosponsored", [])

    if not govtrack_id:
        return [], []

    sponsored   = []
    cosponsored = []
    min_congress = 117

    # Sponsored bills — fetch most recent, filter client-side to congress 117+
    url = (f"{GOVTRACK_BASE}/bill?sponsor={govtrack_id}"
           f"&limit=50&order_by=-introduced_date"
           f"&fields=title,display_number,congress,current_status_label,introduced_date,committees")
    data = fetch_json(url)
    if data and "objects" in data:
        for b in data["objects"]:
            if (b.get("congress") or 0) < min_congress:
                continue
            committees = [c.get("name", "") for c in (b.get("committees") or []) if c.get("name")]
            sponsored.append({
                "number":     b.get("display_number", ""),
                "title":      (b.get("title") or "")[:120],
                "congress":   b.get("congress"),
                "status":     b.get("current_status_label", ""),
                "committees": committees[:3],
            })
    time.sleep(0.3)

    # Cosponsored bills
    url = (f"{GOVTRACK_BASE}/bill?cosponsors={govtrack_id}"
           f"&limit=50&order_by=-introduced_date"
           f"&fields=title,display_number,congress,current_status_label,introduced_date")
    data = fetch_json(url)
    if data and "objects" in data:
        for b in data["objects"]:
            if (b.get("congress") or 0) < min_congress:
                continue
            cosponsored.append({
                "number":   b.get("display_number", ""),
                "title":    (b.get("title") or "")[:120],
                "congress": b.get("congress"),
                "status":   b.get("current_status_label", ""),
            })
    time.sleep(0.3)

    sponsorship_cache[key] = {"sponsored": sponsored, "cosponsored": cosponsored}
    return sponsored, cosponsored


# ── Committee assignments ─────────────────────────────────────────────────────

def load_committee_data(committee_cache):
    """
    Fetch current committee membership from unitedstates/congress-legislators.
    Returns bio -> list of {committee, role, rank} dicts.
    Cached in committee-cache.json (refreshed if older than 7 days).
    """
    import time as _time

    cache_key = "_committee_membership"
    cached = committee_cache.get(cache_key, {})

    # Refresh if empty or older than 7 days
    fetched_at = committee_cache.get("_fetched_at", 0)
    if cached and (_time.time() - fetched_at) < 7 * 86400:
        return cached

    print("  Fetching committee membership from congress-legislators…")

    # Fetch committee definitions (for human-readable names)
    committees_url  = f"{LEGISLATORS_BASE}/committees-current.json"
    membership_url  = f"{LEGISLATORS_BASE}/committee-membership-current.json"

    committee_defs  = fetch_json(committees_url)  or []
    membership_data = fetch_json(membership_url)  or {}

    # Build thomas_id -> committee name map
    id_to_name = {}
    for c in committee_defs:
        tid = c.get("thomas_id") or c.get("committee_id", "")
        if tid:
            id_to_name[tid] = c.get("name", tid)
        for sub in c.get("subcommittees", []):
            sub_id = tid + sub.get("thomas_id", "")
            id_to_name[sub_id] = f"{c.get('name', tid)} — {sub.get('name', '')}"

    # Build bio -> committees
    bio_committees = {}
    for committee_id, members in membership_data.items():
        cname = id_to_name.get(committee_id, committee_id)
        for m in members:
            bio = m.get("bioguide")
            if not bio:
                continue
            if bio not in bio_committees:
                bio_committees[bio] = []
            entry = {"committee": cname}
            if m.get("title"):
                entry["role"] = m["title"]
            elif m.get("rank") == 1:
                entry["role"] = "Chair/Ranking Member"
            bio_committees[bio].append(entry)

    committee_cache[cache_key]    = bio_committees
    committee_cache["_fetched_at"] = _time.time()
    return bio_committees


# ── Vote record builder (multi-congress) ─────────────────────────────────────

def build_vote_record(bio, chamber, bio_to_icpsr, bill_cache):
    """Return combined vote list across VOTE_CONGRESSES, most recent first."""
    chamber_code = "H" if chamber == "House" else "S"
    all_votes = []
    new_title_fetches = [0]  # mutable counter (list so inner scope can modify)

    for congress in VOTE_CONGRESSES:
        vote_file = os.path.join(VOTES_DIR, f"{chamber_code}{congress}.json")
        if not os.path.exists(vote_file):
            continue

        with open(vote_file) as f:
            vdata = json.load(f)

        icpsr = str(bio_to_icpsr.get(bio, ""))
        if not icpsr or icpsr not in vdata["v"]:
            continue

        vote_str  = vdata["v"][icpsr]
        rollcalls = vdata["r"]

        for i, rc in enumerate(rollcalls):
            if i >= len(vote_str):
                break
            v = vote_str[i]
            if v not in ("1", "6"):
                continue  # absent / not-voting

            rc_num, date, bill_num, question, result, yeas, nays, desc = (
                rc[0], rc[1], rc[2] or "", rc[3] or "", rc[4] or "",
                rc[5] if len(rc) > 5 else 0,
                rc[6] if len(rc) > 6 else 0,
                rc[7] if len(rc) > 7 else "",
            )

            if is_procedural(question, bill_num):
                continue

            position = "Yea" if v == "1" else "Nay"

            # Use cached titles freely; only fetch new ones for congress 119,
            # and cap at 50 new fetches total per run to avoid long stalls.
            title = None
            if bill_num:
                cache_key = f"{congress}/{bill_num}"
                if cache_key in bill_cache:
                    title = bill_cache[cache_key]
                elif congress == 119 and new_title_fetches[0] < 50:
                    title = get_bill_title(bill_num, congress, bill_cache)
                    if title:
                        new_title_fetches[0] += 1

            congress_votes = [v for v in all_votes if v.get("congress") == congress]
            if len(congress_votes) >= MAX_VOTES_PER_CONGRESS:
                continue

            all_votes.append({
                "congress": congress,
                "date":     date,
                "bill":     bill_num,
                "title":    title or desc or question,
                "question": question,
                "position": position,
                "yeas":     yeas,
                "nays":     nays,
            })

    return all_votes


# ── Main per-member builder ───────────────────────────────────────────────────

def build_member_input(member, bio_to_icpsr, bill_cache,
                       sponsorship_cache, committee_data):
    bio     = member["bioguideId"]
    chamber = member["chamber"]
    govtrack_id = str(member.get("govtrackId", ""))

    print(f"  [{bio}] {member['displayName']} ({member['party']}, {member['state']})")

    # 1. Voting record (117-119)
    print(f"         fetching votes…", flush=True)
    votes = build_vote_record(bio, chamber, bio_to_icpsr, bill_cache)
    print(f"         votes: {len(votes)} substantive (congresses {VOTE_CONGRESSES})", flush=True)

    # 2. Sponsorship via GovTrack
    print(f"         fetching sponsorship…", flush=True)
    sponsored, cosponsored = get_sponsorships_govtrack(govtrack_id, sponsorship_cache)
    print(f"         sponsored: {len(sponsored)}  cosponsored: {len(cosponsored)}", flush=True)

    # 3. Committee assignments
    committees = committee_data.get(bio, [])
    print(f"         committees: {len(committees)}")

    # 4. Interest-group ratings
    ig_ratings = member.get("_ig_ratings", {})

    # 5. Donor industries
    donor_industries = member.get("_donor_industries", [])

    return {
        "bioguideId":         bio,
        "displayName":        member["displayName"],
        "party":              member["party"],
        "state":              member["state"],
        "chamber":            chamber,
        "lastCongress":       member.get("lastCongress", 119),
        "firstCongress":      member.get("_firstCongress"),
        "dim1":               member.get("dim1"),
        "dim2":               member.get("dim2"),
        "partyAlignmentRate": None,   # filled by compute_member_metrics.py
        "votes":              votes,
        "sponsored":          sponsored,
        "cosponsored":        cosponsored,
        "committees":         committees,
        "interestGroups":     ig_ratings,
        "donorIndustries":    donor_industries,
    }


# ── Cache I/O ─────────────────────────────────────────────────────────────────

def load_cache(path):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return {}


def save_cache(path, data):
    with open(path, "w") as f:
        json.dump(data, f, separators=(",", ":"))


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--members", type=str, default=None,
                        help="Comma-separated bioguide IDs to limit run")
    args = parser.parse_args()

    filter_bios = set(args.members.split(",")) if args.members else None

    os.makedirs(INPUTS_DIR, exist_ok=True)

    if _SKIP_CONGRESS_API:
        print("NOTE: CONGRESS_API_KEY not set — bill titles will use fallback text.")
        print("      Set CONGRESS_API_KEY to enable full title enrichment.\n")

    # Load members
    with open(os.path.join(DATA_DIR, "members-current.json")) as f:
        all_members = json.load(f)

    if filter_bios:
        members = [m for m in all_members if m["bioguideId"] in filter_bios]
        print(f"Filtered to {len(members)} members")
    else:
        members = all_members
    print(f"Collecting data for {len(members)} members (congresses {VOTE_CONGRESSES})\n")

    # Build bioguide → ICPSR map
    with open(os.path.join(DATA_DIR, "members-index.json")) as f:
        index = json.load(f)
    bio_to_icpsr = {m["b"]: str(m["i"]) for m in index if m.get("b") and m.get("i")}
    bio_to_fc    = {m["b"]: m.get("fc") for m in index if m.get("b")}

    # Load donor industry data
    donor_by_bio = {}
    donor_path = os.path.join(DATA_DIR, "donor-industries.json")
    if os.path.exists(donor_path):
        with open(donor_path) as f:
            donor_by_bio = json.load(f).get("donors", {})
        print(f"Loaded donor data for {len(donor_by_bio)} members")

    # Load interest-group scores
    ig_by_bio = {}
    ig_path = os.path.join(DATA_DIR, "interest-group-scores.json")
    if os.path.exists(ig_path):
        with open(ig_path) as f:
            ig_data = json.load(f)
        orgs = ig_data.get("organizations", {})
        for org_key, org_info in orgs.items():
            org_name = org_info.get("name", org_key)
            polarity = org_info.get("polarity", "conservative_high")
            for bio, score in org_info.get("scores", {}).items():
                if bio not in ig_by_bio:
                    ig_by_bio[bio] = {}
                label = f"{org_name}: {score}%"
                label += " (100%=most progressive)" if polarity == "progressive_high" else " (100%=most conservative)"
                ig_by_bio[bio][org_key] = label

    # Load caches
    bill_cache        = load_cache(BILL_CACHE_PATH)
    sponsorship_cache = load_cache(SPONSORSHIP_CACHE_PATH)
    committee_cache   = load_cache(COMMITTEE_CACHE_PATH)

    # Load committee data (fetched once, cached)
    committee_data = load_committee_data(committee_cache)
    save_cache(COMMITTEE_CACHE_PATH, committee_cache)

    bill_cache_size_before = len(bill_cache)
    errors = []

    for i, member in enumerate(members, 1):
        bio = member["bioguideId"]
        print(f"\n[{i}/{len(members)}] Processing {member['displayName']}…")

        member["_ig_ratings"]    = ig_by_bio.get(bio, {})
        member["_donor_industries"] = donor_by_bio.get(bio, [])
        member["_firstCongress"] = bio_to_fc.get(bio)

        try:
            result = build_member_input(
                member, bio_to_icpsr, bill_cache,
                sponsorship_cache, committee_data,
            )
            with open(os.path.join(INPUTS_DIR, f"{bio}.json"), "w") as f:
                json.dump(result, f, indent=2)
        except Exception as e:
            print(f"  ERROR: {e}")
            errors.append((bio, str(e)))

        # Save caches periodically
        if i % 20 == 0:
            save_cache(BILL_CACHE_PATH,        bill_cache)
            save_cache(SPONSORSHIP_CACHE_PATH,  sponsorship_cache)
            print(f"  [caches saved at member {i}]")

    save_cache(BILL_CACHE_PATH,        bill_cache)
    save_cache(SPONSORSHIP_CACHE_PATH,  sponsorship_cache)

    print(f"\n{'='*60}")
    print(f"Done. {len(members) - len(errors)} members written to {INPUTS_DIR}/")
    print(f"New bill titles fetched: {len(bill_cache) - bill_cache_size_before}")
    if errors:
        print(f"Errors ({len(errors)}):")
        for bio, msg in errors:
            print(f"  {bio}: {msg}")


if __name__ == "__main__":
    main()
