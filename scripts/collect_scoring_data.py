#!/usr/bin/env python3
"""
Collect and cache per-member scoring inputs for the LLM ideology pipeline.

For each current member of Congress, fetches and caches:
  1. Full substantive voting record (from existing vote JSON files)
  2. Bill titles from Congress.gov API (cached in data/bill-cache.json)
  3. Sponsored/cosponsored legislation from Congress.gov API
  4. Platform text from official .gov website (best-effort)

Output: data/scoring-inputs/{bioguideId}.json per member
        data/bill-cache.json (persistent across runs)
        data/sponsorship-cache.json (persistent across runs)
        data/platform-cache.json (persistent across runs)

Usage:
  python3 scripts/collect_scoring_data.py              # all current members
  python3 scripts/collect_scoring_data.py --members S000033,C001098
  python3 scripts/collect_scoring_data.py --congress 119
"""
import argparse
import json
import os
import re
import ssl
import sys
import time
import urllib.request
import urllib.parse
import urllib.error

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR   = os.path.dirname(SCRIPT_DIR)
DATA_DIR   = os.path.join(ROOT_DIR, "data")
VOTES_DIR  = os.path.join(DATA_DIR, "votes")
INPUTS_DIR = os.path.join(DATA_DIR, "scoring-inputs")

BILL_CACHE_PATH        = os.path.join(DATA_DIR, "bill-cache.json")
SPONSORSHIP_CACHE_PATH = os.path.join(DATA_DIR, "sponsorship-cache.json")
PLATFORM_CACHE_PATH    = os.path.join(DATA_DIR, "platform-cache.json")

CONGRESS_API_KEY = os.environ.get("CONGRESS_API_KEY", "")
_SKIP_CONGRESS_API = not CONGRESS_API_KEY  # skip if no key provided
CONGRESS_BASE    = "https://api.congress.gov/v3"

# SSL context — macOS sometimes can't verify certs
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode    = ssl.CERT_NONE

# ── Procedural vote filter ────────────────────────────────────────────────────
# Vote questions that carry no ideological signal
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
    r"on the amendment$",          # bare amendment votes with no bill context
]
PROCEDURAL_RE = re.compile("|".join(PROCEDURAL_PATTERNS), re.IGNORECASE)

PROCEDURAL_BILL_RE = re.compile(r"^PN\d", re.IGNORECASE)  # presidential nominations


def is_procedural(question, bill_number):
    if PROCEDURAL_BILL_RE.match(bill_number or ""):
        return True
    # Keep "on the amendment" votes that have an actual bill number
    q = (question or "").strip()
    if re.match(r"on the amendment$", q, re.IGNORECASE) and not (bill_number or "").strip():
        return True
    return bool(PROCEDURAL_RE.search(q))


# ── HTTP helpers ──────────────────────────────────────────────────────────────

def fetch_json(url, retries=2, delay=1.0):
    """Fetch a URL and return parsed JSON, or None on failure."""
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Civicism/1.0"})
            with urllib.request.urlopen(req, context=ctx, timeout=15) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code == 429:
                # Rate limited — wait progressively but give up after 2 retries
                wait = 60 * (attempt + 1)
                print(f"    rate-limited, waiting {wait}s…")
                time.sleep(wait)
            elif e.code == 403:
                return None  # blocked — skip silently
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


def fetch_text(url, retries=2):
    """Fetch a URL and return plain text, or None on failure."""
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, context=ctx, timeout=12) as r:
                raw = r.read()
                encoding = r.headers.get_content_charset() or "utf-8"
                return raw.decode(encoding, errors="replace")
        except Exception:
            if attempt < retries:
                time.sleep(1)
            else:
                return None
    return None


# ── Congress.gov API helpers ──────────────────────────────────────────────────

def normalize_bill_number(raw):
    """Convert 'HR29', 'S5', 'HRES5', 'SCONRES7' to (type, number) for API."""
    raw = (raw or "").strip().upper()
    # Map common prefixes to API types
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
    """Return bill title from cache or Congress.gov API (skipped if no API key)."""
    if not bill_number:
        return None
    key = f"{congress}/{bill_number}"
    if key in bill_cache:
        return bill_cache[key]
    if _SKIP_CONGRESS_API:
        return None

    bill_type, num = normalize_bill_number(bill_number)
    if not bill_type:
        bill_cache[key] = None
        return None

    url = f"{CONGRESS_BASE}/bill/{congress}/{bill_type}/{num}?api_key={CONGRESS_API_KEY}"
    data = fetch_json(url)
    title = None
    if data and "bill" in data:
        title = data["bill"].get("title") or data["bill"].get("shortTitle")
    # Only cache successful lookups — don't cache None so failed calls get retried next run
    if title is not None:
        bill_cache[key] = title
    time.sleep(0.5)  # ~120 req/min, well under 1000 req/hr free tier limit
    return title


def get_sponsorships(bio, congress, sponsorship_cache):
    """Return (sponsored_bills, cosponsored_bills) from cache or Congress.gov API."""
    key = f"{bio}/{congress}"
    if key in sponsorship_cache:
        cached = sponsorship_cache[key]
        return cached.get("sponsored", []), cached.get("cosponsored", [])
    if _SKIP_CONGRESS_API:
        sponsorship_cache[key] = {"sponsored": [], "cosponsored": []}
        return [], []

    def fetch_bills(endpoint):
        url = f"{CONGRESS_BASE}/member/{bio}/{endpoint}?limit=20&api_key={CONGRESS_API_KEY}"
        data = fetch_json(url)
        if not data:
            return []
        field = "sponsoredLegislation" if "sponsored" in endpoint else "cosponsoredLegislation"
        bills = data.get(field, [])
        result = []
        for b in bills:
            if b.get("congress", 0) != congress:
                continue
            policy = b.get("policyArea", {})
            area = policy.get("name", "") if isinstance(policy, dict) else ""
            result.append({
                "number": b.get("number", ""),
                "title": (b.get("title") or "")[:120],
                "policyArea": area,
            })
        return result

    sponsored   = fetch_bills("sponsored-legislation")
    time.sleep(0.2)
    cosponsored = fetch_bills("cosponsored-legislation")
    time.sleep(0.2)

    sponsorship_cache[key] = {"sponsored": sponsored, "cosponsored": cosponsored}
    return sponsored, cosponsored


# ── Platform text scraper ─────────────────────────────────────────────────────

def scrub_html(html):
    """Strip HTML tags and collapse whitespace."""
    text = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<style[^>]*>.*?</style>",  " ", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&[a-zA-Z]+;", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def get_platform_text(bio, chamber, platform_cache):
    """Scrape the member's official .gov issues/legislation page."""
    if bio in platform_cache:
        return platform_cache[bio]

    bio_low = bio.lower()
    if chamber == "House":
        candidates = [
            f"https://{bio_low}.house.gov/issues",
            f"https://{bio_low}.house.gov/legislation",
            f"https://{bio_low}.house.gov/priorities",
        ]
    else:
        candidates = [
            f"https://{bio_low}.senate.gov/issues",
            f"https://{bio_low}.senate.gov/legislation",
        ]

    text = None
    for url in candidates:
        html = fetch_text(url)
        if html and len(html) > 500:
            scraped = scrub_html(html)
            if len(scraped) > 200:
                text = scraped[:2000]
                break
        time.sleep(0.3)

    platform_cache[bio] = text
    return text


# ── Vote record builder ───────────────────────────────────────────────────────

def build_vote_record(bio, chamber, congress, bio_to_icpsr, bill_cache):
    """Return list of substantive vote dicts for this member."""
    chamber_code = "H" if chamber == "House" else "S"
    vote_file = os.path.join(VOTES_DIR, f"{chamber_code}{congress}.json")
    if not os.path.exists(vote_file):
        return []

    with open(vote_file) as f:
        vdata = json.load(f)

    icpsr = str(bio_to_icpsr.get(bio, ""))
    if not icpsr or icpsr not in vdata["v"]:
        return []

    vote_str  = vdata["v"][icpsr]
    rollcalls = vdata["r"]

    votes = []
    bill_fetch_count = 0
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

        # Fetch bill title if we have a bill number (rate-limited)
        title = None
        if bill_num and bill_fetch_count < 200:
            title = get_bill_title(bill_num, congress, bill_cache)
            if title is not None:
                bill_fetch_count += 1

        votes.append({
            "date":      date,
            "bill":      bill_num,
            "title":     title or desc or question,
            "question":  question,
            "position":  position,
            "yeas":      yeas,
            "nays":      nays,
        })

    return votes


# ── Main per-member builder ───────────────────────────────────────────────────

def build_member_input(member, congress, bio_to_icpsr,
                       bill_cache, sponsorship_cache, platform_cache):
    """Assemble and return the full scoring-input dict for one member."""
    bio     = member["bioguideId"]
    chamber = member["chamber"]

    print(f"  [{bio}] {member['displayName']} ({member['party']}, {member['state']})")

    # 1. Voting record
    votes = build_vote_record(bio, chamber, congress, bio_to_icpsr, bill_cache)
    print(f"         votes: {len(votes)} substantive")

    # 2. Sponsorship
    sponsored, cosponsored = get_sponsorships(bio, congress, sponsorship_cache)
    print(f"         sponsored: {len(sponsored)}  cosponsored: {len(cosponsored)}")

    # 3. Platform text
    platform = get_platform_text(bio, chamber, platform_cache)
    print(f"         platform: {'yes' if platform else 'none'}")

    # 4. Interest-group ratings (read from existing file, no API call needed)
    # Loaded by caller and passed in via member dict if available
    ig_ratings = member.get("_ig_ratings", {})

    return {
        "bioguideId":     bio,
        "displayName":    member["displayName"],
        "party":          member["party"],
        "state":          member["state"],
        "chamber":        chamber,
        "lastCongress":   member.get("lastCongress", congress),
        "firstCongress":  member.get("_firstCongress"),
        "dim1":           member.get("dim1"),
        "dim2":           member.get("dim2"),
        "partyAlignmentRate": None,   # filled in by compute_member_metrics.py
        "votes":          votes,
        "sponsored":      sponsored,
        "cosponsored":    cosponsored,
        "interestGroups": ig_ratings,
        "platformText":   platform,
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
    parser.add_argument("--congress", type=int, default=119)
    parser.add_argument("--members",  type=str, default=None,
                        help="Comma-separated bioguide IDs to limit run")
    args = parser.parse_args()

    congress      = args.congress
    filter_bios   = set(args.members.split(",")) if args.members else None

    os.makedirs(INPUTS_DIR, exist_ok=True)

    if _SKIP_CONGRESS_API:
        print("NOTE: CONGRESS_API_KEY not set — skipping bill title enrichment and sponsorship lookup.")
        print("      Set CONGRESS_API_KEY env var to enable. Votes will use raw question text only.\n")

    # Load members
    members_path = os.path.join(DATA_DIR, "members-current.json")
    with open(members_path) as f:
        all_members = json.load(f)

    if filter_bios:
        members = [m for m in all_members if m["bioguideId"] in filter_bios]
        print(f"Filtered to {len(members)} members: {filter_bios}")
    else:
        members = all_members
    print(f"Collecting data for {len(members)} members (Congress {congress})\n")

    # Build bioguide → ICPSR map
    index_path = os.path.join(DATA_DIR, "members-index.json")
    with open(index_path) as f:
        index = json.load(f)
    bio_to_icpsr    = {m["b"]: str(m["i"]) for m in index if m.get("b") and m.get("i")}
    bio_to_fc       = {m["b"]: m.get("fc") for m in index if m.get("b")}

    # Load interest-group scores and build per-member lookup
    ig_path = os.path.join(DATA_DIR, "interest-group-scores.json")
    ig_by_bio = {}   # bioguideId -> {org_name: score_str}
    if os.path.exists(ig_path):
        with open(ig_path) as f:
            ig_data = json.load(f)
        orgs = ig_data.get("organizations", {})
        # interest-group scores are keyed by ICPSR; convert to bioguide
        icpsr_to_bio = {v: k for k, v in bio_to_icpsr.items()}
        for org_key, org_info in orgs.items():
            org_name    = org_info.get("name", org_key)
            org_scores  = org_info.get("scores", {})
            polarity    = org_info.get("polarity", "conservative_high")
            for icpsr_str, score in org_scores.items():
                bio = icpsr_to_bio.get(icpsr_str)
                if not bio:
                    continue
                if bio not in ig_by_bio:
                    ig_by_bio[bio] = {}
                # Store as human-readable label
                label = f"{org_name}: {score}%"
                if polarity == "progressive_high":
                    label += " (100%=most progressive)"
                else:
                    label += " (100%=most conservative)"
                ig_by_bio[bio][org_key] = label

    # Load caches
    bill_cache        = load_cache(BILL_CACHE_PATH)
    sponsorship_cache = load_cache(SPONSORSHIP_CACHE_PATH)
    platform_cache    = load_cache(PLATFORM_CACHE_PATH)

    bill_cache_size_before = len(bill_cache)

    errors = []
    for i, member in enumerate(members, 1):
        bio = member["bioguideId"]
        print(f"\n[{i}/{len(members)}] Processing {member['displayName']}…")

        # Attach supplementary data
        member["_ig_ratings"]    = ig_by_bio.get(bio, {})
        member["_firstCongress"] = bio_to_fc.get(bio)

        try:
            result = build_member_input(
                member, congress, bio_to_icpsr,
                bill_cache, sponsorship_cache, platform_cache,
            )
            out_path = os.path.join(INPUTS_DIR, f"{bio}.json")
            with open(out_path, "w") as f:
                json.dump(result, f, indent=2)
        except Exception as e:
            print(f"  ERROR: {e}")
            errors.append((bio, str(e)))

        # Save caches periodically
        if i % 20 == 0:
            save_cache(BILL_CACHE_PATH,        bill_cache)
            save_cache(SPONSORSHIP_CACHE_PATH,  sponsorship_cache)
            save_cache(PLATFORM_CACHE_PATH,     platform_cache)
            print(f"  [caches saved at member {i}]")

    # Final cache save
    save_cache(BILL_CACHE_PATH,        bill_cache)
    save_cache(SPONSORSHIP_CACHE_PATH,  sponsorship_cache)
    save_cache(PLATFORM_CACHE_PATH,     platform_cache)

    new_bills = len(bill_cache) - bill_cache_size_before
    print(f"\n{'='*60}")
    print(f"Done. {len(members) - len(errors)} members written to {INPUTS_DIR}/")
    print(f"New bill titles fetched: {new_bills}")
    if errors:
        print(f"Errors ({len(errors)}):")
        for bio, msg in errors:
            print(f"  {bio}: {msg}")


if __name__ == "__main__":
    main()
