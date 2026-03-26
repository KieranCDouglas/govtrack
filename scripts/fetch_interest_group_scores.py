#!/usr/bin/env python3
"""
Fetch interest-group scorecard data and produce a composite social score.

Sources:
  1. NumbersUSA  — immigration grades (excellent within-party spread)
  2. Heritage Action — broad conservative scorecard

Outputs data/interest-group-scores.json with per-member scores from each org,
matched to ICPSR IDs via members-index.json.

Requires: selenium (pip install selenium) + Chrome/Chromium installed.
"""
import json
import os
import re
import sys
import time
import unicodedata

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(ROOT_DIR, "data")
OUTPUT = os.path.join(DATA_DIR, "interest-group-scores.json")
INDEX_PATH = os.path.join(DATA_DIR, "members-index.json")


def get_driver():
    """Create a headless Chrome Selenium driver."""
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    opts = Options()
    opts.add_argument("--headless")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--window-size=1920,10000")
    opts.add_argument(
        "user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
    return webdriver.Chrome(options=opts)


def strip_accents(s):
    """Remove accented characters: á→a, é→e, ñ→n, etc."""
    nfkd = unicodedata.normalize("NFKD", s)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def load_index(congress=119):
    """Load members-index.json and build lookup tables for matching."""
    with open(INDEX_PATH) as f:
        index = json.load(f)

    # Only current congress members
    members = [m for m in index if m.get("l") == congress]

    def extract_last(name):
        parts = name.strip().split()
        last = parts[-1].lower() if parts else ""
        if last in ("jr.", "jr", "sr.", "sr", "ii", "iii", "iv"):
            last = parts[-2].lower() if len(parts) > 1 else last
        return strip_accents(last)

    # Build lookup by (state, party_key, normalized_last_name) -> list of members
    # party_key: use actual party, also index Independents under "I"
    by_state_party_last = {}
    for m in members:
        state = m.get("s", "")
        party = m.get("p", "")
        name = m.get("n", "")
        last = extract_last(name)
        key = (state, party, last)
        by_state_party_last.setdefault(key, []).append(m)
        # Also index under "I" for independents (party="O" in the index)
        if party == "O":
            key_i = (state, "I", last)
            by_state_party_last.setdefault(key_i, []).append(m)

    # Build lookup by (state, last_name) ignoring party — for fallback
    by_state_last = {}
    for m in members:
        state = m.get("s", "")
        name = m.get("n", "")
        last = extract_last(name)
        key = (state, last)
        by_state_last.setdefault(key, []).append(m)

    return members, by_state_party_last, by_state_last


def normalize_name(name):
    """Normalize a member name for matching."""
    name = name.strip()
    name = re.sub(r'\b(Jr\.?|Sr\.?|III|II|IV)\s*$', '', name).strip()
    name = re.sub(r'\s+[A-Z]\.\s+', ' ', name)
    return name


# Common first-name variants
FIRST_NAME_VARIANTS = {
    "jeff": "jefferson", "bernie": "bernard", "dick": "richard",
    "bob": "robert", "bill": "william", "mike": "michael",
    "jim": "james", "joe": "joseph", "tom": "thomas",
    "ted": "edward", "dan": "daniel", "ben": "benjamin",
    "pat": "patrick", "al": "albert", "ed": "edward",
    "chuck": "charles", "pete": "peter", "rick": "richard",
    "ron": "ronald", "don": "donald", "jerry": "gerald",
    "chris": "christopher", "steve": "stephen", "tim": "timothy",
    "andy": "andrew", "nick": "nicholas",
}
# Build reverse mapping too
for k, v in list(FIRST_NAME_VARIANTS.items()):
    FIRST_NAME_VARIANTS[v] = k


def first_name_matches(a, b):
    """Check if two first names likely refer to the same person."""
    a, b = a.lower(), b.lower()
    if a == b or a.startswith(b) or b.startswith(a):
        return True
    # Check common variants
    a_var = FIRST_NAME_VARIANTS.get(a, a)
    b_var = FIRST_NAME_VARIANTS.get(b, b)
    return a_var == b or a == b_var or a_var == b_var


def match_member(name, state, party, chamber, by_state_party_last, by_state_last):
    """Try to match a member name to an index entry. Returns (icpsr, bioguide) or (None, None)."""
    clean = normalize_name(name)
    parts = clean.split()
    last = strip_accents(parts[-1].lower()) if parts else ""
    first = strip_accents(parts[0].lower()) if parts else ""

    def pick_best(candidates):
        """From candidates, pick the one whose first name matches best."""
        if len(candidates) == 1:
            return str(candidates[0]["i"]), candidates[0]["b"]
        # Filter by chamber first
        ch_filt = [m for m in candidates if m.get("c", "") == chamber] if chamber else candidates
        if len(ch_filt) == 1:
            return str(ch_filt[0]["i"]), ch_filt[0]["b"]
        pool = ch_filt if ch_filt else candidates
        for m in pool:
            m_name = strip_accents(m.get("n", ""))
            m_first = m_name.split()[0].lower() if m_name.split() else ""
            if first_name_matches(first, m_first):
                return str(m["i"]), m["b"]
        return None, None

    # 1) Try exact: state + party + last name
    key = (state, party, last)
    candidates = by_state_party_last.get(key, [])
    if candidates:
        icpsr, bio = pick_best(candidates)
        if icpsr:
            return icpsr, bio

    # 2) Fallback: state + last name (ignore party — handles party switches)
    key2 = (state, last)
    candidates = by_state_last.get(key2, [])
    if candidates:
        icpsr, bio = pick_best(candidates)
        if icpsr:
            return icpsr, bio

    # 3) Fuzzy: partial last name match within state
    for key3, cands in by_state_last.items():
        if key3[0] == state:
            stored_last = key3[1]
            if stored_last.startswith(last) or last.startswith(stored_last):
                for m in cands:
                    if not chamber or m.get("c", "") == chamber:
                        return str(m["i"]), m["b"]

    return None, None


# ---------------------------------------------------------------------------
#  NumbersUSA: Immigration grades
# ---------------------------------------------------------------------------

def fetch_numbersusa():
    """Fetch NumbersUSA immigration grades via headless Chrome. Returns {icpsr: score_0_to_100} or None."""
    print("\n=== Fetching NumbersUSA immigration grades ===")
    driver = get_driver()
    try:
        driver.get("https://www.numbersusa.com/content/my/tools/grades")
        # Wait for JS to render (the page loads grades via React)
        time.sleep(8)

        # Get the full rendered page text
        text = driver.find_element("tag name", "body").text

        # Parse entries like: "100% Rep Tom McClintock(R-CA05)"
        pattern = re.compile(
            r'(\d+)%\s+(Rep|Sen)\s+(.+?)\(([DRI])-([A-Z]{2})(\d*)\)',
            re.IGNORECASE
        )
        entries = pattern.findall(text)
        print(f"  Parsed {len(entries)} member entries from NumbersUSA")

        if len(entries) < 100:
            print(f"  WARNING: Expected 500+ entries, only got {len(entries)}")
            # Try scrolling to load more content
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight)")
            time.sleep(3)
            text = driver.find_element("tag name", "body").text
            entries = pattern.findall(text)
            print(f"  After scroll: {len(entries)} entries")

        if len(entries) < 100:
            print(f"  Page text length: {len(text)} chars")
            print(f"  Sample text (first 500): {text[:500]}")
            return None

    finally:
        driver.quit()

    members, by_spl, by_sl = load_index()

    scores = {}
    matched = 0
    unmatched = 0
    for pct, title, name, party, state, district in entries:
        chamber = "H" if title.lower() == "rep" else "S"
        icpsr, bio = match_member(name.strip(), state, party, chamber, by_spl, by_sl)
        if icpsr:
            scores[icpsr] = int(pct)
            matched += 1
        else:
            unmatched += 1
            if unmatched <= 20:
                print(f"  UNMATCHED: {pct}% {title} {name} ({party}-{state}{district})")

    print(f"  Matched: {matched}, Unmatched: {unmatched}")
    return scores


# ---------------------------------------------------------------------------
#  Heritage Action: Broad conservative scorecard
# ---------------------------------------------------------------------------

def fetch_heritage_action():
    """Fetch Heritage Action scorecard via headless Chrome. Returns {icpsr: score_0_to_100} or None."""
    print("\n=== Fetching Heritage Action scorecard ===")
    driver = get_driver()
    try:
        driver.get("https://heritageaction.com/scorecard/members/119")
        time.sleep(10)  # Heritage site is heavy JS

        text = driver.find_element("tag name", "body").text
        print(f"  Page text length: {len(text)} chars")

        # Heritage Action uses a table with member names and percentage scores
        # Try to find patterns like "Member Name 85%" or "85% Member Name"
        # Also look for structured data in the page source
        page_source = driver.page_source

        # Try __NEXT_DATA__ approach (Next.js)
        next_match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', page_source, re.DOTALL)
        if next_match:
            try:
                data = json.loads(next_match.group(1))
                result = _parse_heritage_nextdata(data)
                if result:
                    return result
            except json.JSONDecodeError:
                pass

        # Try parsing visible text
        # Heritage shows entries like: "Sen. Ted Cruz (TX) 100%"
        pattern = re.compile(
            r'(?:Rep|Sen)\.?\s+(.+?)\s*\(([A-Z]{2})\)\s*(\d+)%',
            re.IGNORECASE
        )
        entries = pattern.findall(text)
        if len(entries) > 50:
            print(f"  Parsed {len(entries)} entries from Heritage Action text")
            return _match_heritage_entries(entries)

        # Try matching just name + score patterns
        pattern2 = re.compile(r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(\d+)%')
        entries2 = pattern2.findall(text)
        if len(entries2) > 50:
            print(f"  Parsed {len(entries2)} name-score pairs from Heritage Action")
            # This is less reliable without party/state info
            return None

        print(f"  Could not parse Heritage Action data")
        print(f"  Sample text: {text[:500]}")
        return None
    finally:
        driver.quit()


def _parse_heritage_nextdata(data):
    """Extract member scores from Heritage Action __NEXT_DATA__."""
    try:
        props = data.get("props", {}).get("pageProps", {})
        members = props.get("members", props.get("data", props.get("allMembers", [])))
        if not isinstance(members, list) or len(members) < 50:
            # Try deeper navigation
            for key in props:
                val = props[key]
                if isinstance(val, list) and len(val) > 50:
                    members = val
                    break
                if isinstance(val, dict):
                    for k2 in val:
                        if isinstance(val[k2], list) and len(val[k2]) > 50:
                            members = val[k2]
                            break
        if not isinstance(members, list) or len(members) < 50:
            return None

        index_members, by_spl, by_sl = load_index()
        scores = {}
        for m in members:
            name = m.get("name", m.get("fullName", m.get("displayName", "")))
            score = m.get("score", m.get("percentage", m.get("rating", m.get("lifetime_score"))))
            party = m.get("party", "")
            state = m.get("state", "")
            chamber_str = m.get("chamber", m.get("type", ""))
            chamber = "S" if "sen" in str(chamber_str).lower() else "H"
            if name and score is not None:
                icpsr, _ = match_member(name, state, party[0] if party else "", chamber, by_spl, by_sl)
                if icpsr:
                    scores[icpsr] = int(float(score))
        return scores if len(scores) > 50 else None
    except Exception as e:
        print(f"  Error parsing Heritage Next data: {e}")
        return None


def _match_heritage_entries(entries):
    """Match Heritage Action text-parsed entries to ICPSR."""
    index_members, by_spl, by_sl = load_index()
    scores = {}
    for name, state, pct in entries:
        # Don't know party from this pattern — try both
        for party in ["R", "D"]:
            icpsr, _ = match_member(name.strip(), state, party, "", by_spl, by_sl)
            if icpsr:
                scores[icpsr] = int(pct)
                break
    return scores if len(scores) > 50 else None


# ---------------------------------------------------------------------------
#  Main
# ---------------------------------------------------------------------------

def main():
    print("Fetching interest group scores...")
    results = {}

    # NumbersUSA (immigration)
    nusa = fetch_numbersusa()
    if nusa:
        results["numbersusa"] = {
            "name": "NumbersUSA",
            "focus": "Immigration",
            "polarity": "conservative_high",  # high % = restrictionist/conservative
            "scores": nusa,
        }
        print(f"  NumbersUSA: {len(nusa)} members scored")

        # Quick distribution check
        vals = list(nusa.values())
        if vals:
            print(f"  Score range: {min(vals)}-{max(vals)}, mean={sum(vals)/len(vals):.1f}")
    else:
        print("  NumbersUSA: FAILED to get data")

    # Heritage Action (broad conservative)
    heritage = fetch_heritage_action()
    if heritage:
        results["heritage_action"] = {
            "name": "Heritage Action",
            "focus": "Broad Conservative",
            "polarity": "conservative_high",
            "scores": heritage,
        }
        print(f"  Heritage Action: {len(heritage)} members scored")
    else:
        print("  Heritage Action: FAILED to get data (likely JS-rendered)")

    if not results:
        print("\nERROR: No interest group data could be fetched!")
        print("The script may need manual data input.")
        sys.exit(1)

    # Write output
    output = {
        "meta": {
            "congress": 119,
            "sources": list(results.keys()),
            "member_counts": {k: len(v["scores"]) for k, v in results.items()},
        },
        "organizations": results,
    }

    with open(OUTPUT, "w") as f:
        json.dump(output, f, indent=2)

    total_members = max(len(v["scores"]) for v in results.values()) if results else 0
    print(f"\nWrote {OUTPUT} ({total_members} members, {len(results)} organizations)")


if __name__ == "__main__":
    main()
