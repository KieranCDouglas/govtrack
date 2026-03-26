#!/usr/bin/env python3
"""
Generate personalized policy summaries for all members of Congress.

Uses pre-processed vote data + NOMINATE scores to build a per-member stats
context, then calls GPT-4o-mini to produce a 3-4 sentence policy summary.

Outputs: data/member-summaries.json  { "bioguideId": "summary text", ... }

Usage:
  # Full batch (all 12k+ historical members)
  OPENAI_API_KEY=sk-... python3 scripts/generate_summaries.py

  # Current members only (for weekly refresh)
  OPENAI_API_KEY=sk-... python3 scripts/generate_summaries.py --current-only

  # Resume an interrupted batch (skips members already in output)
  OPENAI_API_KEY=sk-... python3 scripts/generate_summaries.py --resume

  # Small test run
  OPENAI_API_KEY=sk-... python3 scripts/generate_summaries.py --test 5
"""
import argparse
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

# ---------------------------------------------------------------------------
#  OpenAI API
# ---------------------------------------------------------------------------

API_KEY = os.environ.get("OPENAI_API_KEY", "")
API_URL = "https://api.openai.com/v1/chat/completions"
MODEL = "gpt-4o-mini"
MAX_TOKENS_HISTORIC = 250
MAX_TOKENS_MODERN = 450
TEMPERATURE = 0.7

# Members serving in Congress 100+ (~1987+) get enhanced summaries with bullet points
MODERN_CONGRESS_THRESHOLD = 100

# Rate limiting: GPT-4o-mini tier-1 = 500 RPM, 200k TPM
BATCH_SIZE = 40          # send this many, then pause
BATCH_PAUSE = 5          # seconds between batches
REQUEST_PAUSE = 0.15     # seconds between individual requests

# SSL context for macOS
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

PARTY_NAMES = {"D": "Democrat", "R": "Republican", "O": "Independent"}
CHAMBER_NAMES = {"H": "House", "S": "Senate"}

# Congress year ranges (approximate)
def congress_years(c):
    start = 1789 + (c - 1) * 2
    return (start, start + 1)


def call_openai(system_prompt, user_prompt, retries=3, max_tokens=None):
    """Call GPT-4o-mini with retry logic."""
    payload = json.dumps({
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": max_tokens or MAX_TOKENS_HISTORIC,
        "temperature": TEMPERATURE,
    }).encode("utf-8")

    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(API_URL, data=payload, headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
            })
            with urllib.request.urlopen(req, context=ctx, timeout=30) as resp:
                data = json.loads(resp.read())
                return data["choices"][0]["message"]["content"].strip()
        except Exception as e:
            if attempt < retries:
                err_str = str(e)
                # Rate limit: back off
                if "429" in err_str:
                    wait = 30 * (attempt + 1)
                    print(f"    rate limited, waiting {wait}s...")
                    time.sleep(wait)
                else:
                    wait = 5 * (attempt + 1)
                    print(f"    retry {attempt+1}: {err_str[:100]}")
                    time.sleep(wait)
            else:
                print(f"    FAILED after {retries} retries: {e}")
                return None


# ---------------------------------------------------------------------------
#  Vote analysis
# ---------------------------------------------------------------------------

def load_vote_data(chamber_code, congress):
    """Load pre-processed vote JSON for a chamber+congress."""
    key = f"{chamber_code}{congress}"
    path = os.path.join(VOTES_DIR, f"{key}.json")
    if not os.path.exists(path):
        return None
    with open(path) as f:
        return json.load(f)


def compute_member_vote_stats(icpsr, chamber_code, first_congress, last_congress):
    """Compute voting statistics for a member across their career."""
    total_yea = 0
    total_nay = 0
    total_other = 0
    total_rolls = 0
    congresses_served = 0

    for cong in range(first_congress, last_congress + 1):
        data = load_vote_data(chamber_code, cong)
        if not data:
            continue
        votes_str = data["v"].get(str(icpsr), "")
        if not votes_str:
            continue

        congresses_served += 1
        for ch in votes_str:
            c = int(ch)
            total_rolls += 1
            if 1 <= c <= 3:
                total_yea += 1
            elif 4 <= c <= 6:
                total_nay += 1
            else:
                total_other += 1

    participated = total_yea + total_nay
    participation_rate = participated / total_rolls if total_rolls > 0 else 0

    return {
        "total_votes": total_rolls,
        "yea": total_yea,
        "nay": total_nay,
        "not_voting": total_other,
        "participation_rate": round(participation_rate * 100, 1),
        "congresses_served": congresses_served,
    }


def compute_party_context(member, all_members_in_congress):
    """Compute where this member sits relative to their party."""
    party = member["p"]
    chamber = member["c"]
    dim1 = member.get("x")
    if dim1 is None:
        return None

    # Get all same-party, same-chamber members in same congress
    peers = [m for m in all_members_in_congress
             if m["p"] == party and m["c"] == chamber and m.get("x") is not None]

    if len(peers) < 3:
        return None

    scores = sorted([m["x"] for m in peers])
    rank = sum(1 for s in scores if s < dim1)
    percentile = round(rank / len(scores) * 100, 1)

    return {
        "party_size": len(peers),
        "econ_percentile": percentile,
        "party_median": round(scores[len(scores) // 2], 3),
    }


# ---------------------------------------------------------------------------
#  Prompt construction
# ---------------------------------------------------------------------------

SYSTEM_PROMPT_HISTORIC = """You are a concise, nonpartisan congressional analyst for a political data website.
Write a 3-4 sentence policy summary for the given member of Congress.

Rules:
- Be specific to THIS member using the data provided. Never write generic party descriptions.
- Mention their ideological position relative to their party (e.g., "among the most moderate" or "one of the furthest-right").
- Reference their voting participation and any notable patterns from the stats.
- Use plain language accessible to a general audience. No jargon.
- Do NOT start with the member's name. Start with a characterization (e.g., "A centrist Democrat..." or "One of the most conservative House Republicans...").
- Frame positions in the context of their time period.
- Do NOT mention DW-NOMINATE by name. Just describe their position naturally.
- Do NOT use bullet points or headers. Write flowing prose."""

SYSTEM_PROMPT_MODERN = """You are a concise, nonpartisan congressional analyst for a political data website.
Write a policy profile for the given member of Congress.

Format your response EXACTLY like this:
First, write a 2-3 sentence overview paragraph (do NOT start with the member's name — start with a characterization like "A centrist Democrat..." or "One of the most conservative House Republicans...").

Then add a blank line, followed by 3-5 bullet points on specific policy stances, each starting with "- ". Each bullet should name a concrete issue and their position (supports/opposes). Prioritize issues where they diverge from their party or have taken notable stances.

Rules:
- Be specific to THIS member using the data provided. Never write generic party descriptions.
- Mention their ideological position relative to their party in the overview.
- If heterodoxy data is provided, use it to identify their notable policy stances for the bullet points.
- Use plain language accessible to a general audience. No jargon.
- Do NOT mention DW-NOMINATE by name. Just describe their position naturally.
- Bullet points should be specific and substantive (e.g., "Supports stricter gun control measures, breaking from the Republican caucus" not just "Moderate on social issues").
- Base bullet points on the policy heterodoxy data, voting patterns, and ideological scores provided. Infer specific issue positions from the data."""


def build_user_prompt(member, vote_stats, party_ctx, heterodoxy=None):
    """Build the per-member prompt with all available data."""
    name = member["n"]
    party = PARTY_NAMES.get(member["p"], "Independent")
    chamber = CHAMBER_NAMES.get(member["c"], member["c"])
    state = member["s"]
    first_c = member.get("fc", member["l"])
    last_c = member["l"]
    dim1 = member.get("x")
    dim2 = member.get("y")

    first_years = congress_years(first_c)
    last_years = congress_years(last_c)

    lines = [
        f"Member: {name}",
        f"Party: {party}",
        f"Chamber: {chamber}",
        f"State: {state}",
        f"Served: Congress {first_c} ({first_years[0]}-{first_years[1]}) to Congress {last_c} ({last_years[0]}-{last_years[1]})",
    ]

    if dim1 is not None:
        direction = "right/conservative" if dim1 > 0 else "left/progressive"
        lines.append(f"Economic ideology score: {dim1:.3f} ({direction}, scale -1 to +1)")
    if dim2 is not None:
        direction2 = "positive (conservative/traditional)" if dim2 > 0 else "negative (progressive/libertarian)"
        lines.append(f"Social dimension score: {dim2:.3f} ({direction2})")

    if party_ctx:
        lines.append(f"Relative to {party} {chamber} caucus: {party_ctx['econ_percentile']}th percentile on economic axis ({party_ctx['party_size']} members, party median: {party_ctx['party_median']:.3f})")

    if vote_stats and vote_stats["total_votes"] > 0:
        lines.append(f"Voting record: {vote_stats['yea']} yea, {vote_stats['nay']} nay, {vote_stats['not_voting']} not voting ({vote_stats['participation_rate']}% participation across {vote_stats['congresses_served']} congress(es))")

    if heterodoxy:
        het_items = []
        for k, v in heterodoxy.items():
            if v is not None and v > 0.15:
                het_items.append(f"{k.replace('_', ' ')}: {v:.0%} heterodox")
        if het_items:
            lines.append(f"Policy areas where they diverge from party: {', '.join(het_items)}")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
#  Main
# ---------------------------------------------------------------------------

# Cache for vote data files (avoid re-reading)
_vote_cache = {}

def get_vote_data_cached(chamber_code, congress):
    key = f"{chamber_code}{congress}"
    if key not in _vote_cache:
        _vote_cache[key] = load_vote_data(chamber_code, congress)
    return _vote_cache[key]


def compute_member_vote_stats_fast(icpsr, chamber_code, first_congress, last_congress):
    """Faster version using cached vote data."""
    total_yea = 0
    total_nay = 0
    total_other = 0
    total_rolls = 0
    congresses_served = 0

    for cong in range(first_congress, last_congress + 1):
        data = get_vote_data_cached(chamber_code, cong)
        if not data:
            continue
        votes_str = data["v"].get(str(icpsr), "")
        if not votes_str:
            continue

        congresses_served += 1
        for ch in votes_str:
            c = int(ch)
            total_rolls += 1
            if 1 <= c <= 3:
                total_yea += 1
            elif 4 <= c <= 6:
                total_nay += 1
            else:
                total_other += 1

    participated = total_yea + total_nay
    participation_rate = participated / total_rolls if total_rolls > 0 else 0

    return {
        "total_votes": total_rolls,
        "yea": total_yea,
        "nay": total_nay,
        "not_voting": total_other,
        "participation_rate": round(participation_rate * 100, 1),
        "congresses_served": congresses_served,
    }


def main():
    parser = argparse.ArgumentParser(description="Generate member policy summaries")
    parser.add_argument("--current-only", action="store_true",
                        help="Only generate for current congress members")
    parser.add_argument("--resume", action="store_true",
                        help="Skip members already in output file")
    parser.add_argument("--test", type=int, default=0,
                        help="Generate only N summaries for testing")
    parser.add_argument("--congress", type=int, default=119,
                        help="Current congress number")
    args = parser.parse_args()

    if not API_KEY:
        print("ERROR: Set OPENAI_API_KEY environment variable")
        sys.exit(1)

    # Load members index
    index_path = os.path.join(DATA_DIR, "members-index.json")
    with open(index_path) as f:
        all_members = json.load(f)
    print(f"Loaded {len(all_members)} members from index")

    # Load current members for heterodoxy data
    current_path = os.path.join(DATA_DIR, "members-current.json")
    heterodoxy_map = {}
    try:
        with open(current_path) as f:
            for m in json.load(f):
                bio = m.get("bioguideId", "")
                ph = m.get("policyHeterodoxy")
                if ph and isinstance(ph, dict):
                    heterodoxy_map[bio] = ph
    except FileNotFoundError:
        pass

    # Filter members
    if args.current_only:
        members = [m for m in all_members if m["l"] == args.congress]
        print(f"Filtering to {len(members)} current congress members")
    else:
        members = all_members

    # Build per-congress member lists for party context
    congress_members = {}
    for m in all_members:
        c = m["l"]
        if c not in congress_members:
            congress_members[c] = []
        congress_members[c].append(m)

    # Load existing summaries for resume
    output_path = os.path.join(DATA_DIR, "member-summaries.json")
    existing = {}
    if args.resume:
        try:
            with open(output_path) as f:
                existing = json.load(f)
            print(f"Resuming: {len(existing)} existing summaries loaded")
        except FileNotFoundError:
            pass

    if args.test:
        members = members[:args.test]
        print(f"Test mode: generating {args.test} summaries")

    # Generate summaries
    summaries = dict(existing)  # Start with existing if resuming
    total = len(members)
    skipped = 0
    failed = 0
    generated = 0

    print(f"\nGenerating summaries for {total} members...\n")
    start_time = time.time()

    for i, member in enumerate(members):
        bio = member["b"]

        # Skip if already done (resume mode)
        if bio in summaries:
            skipped += 1
            continue

        # Build context
        first_c = member.get("fc", member["l"])
        last_c = member["l"]
        vote_stats = compute_member_vote_stats_fast(
            member["i"], member["c"], first_c, last_c
        )
        party_ctx = compute_party_context(member, congress_members.get(last_c, []))
        heterodoxy = heterodoxy_map.get(bio)

        prompt = build_user_prompt(member, vote_stats, party_ctx, heterodoxy)

        # Use enhanced prompt for modern members
        last_c = member["l"]
        is_modern = last_c >= MODERN_CONGRESS_THRESHOLD
        sys_prompt = SYSTEM_PROMPT_MODERN if is_modern else SYSTEM_PROMPT_HISTORIC
        max_tok = MAX_TOKENS_MODERN if is_modern else MAX_TOKENS_HISTORIC

        # Call API
        summary = call_openai(sys_prompt, prompt, max_tokens=max_tok)
        if summary:
            summaries[bio] = summary
            generated += 1
        else:
            failed += 1

        # Progress
        done = i + 1
        if done % 10 == 0 or done == total:
            elapsed = time.time() - start_time
            rate = generated / elapsed if elapsed > 0 else 0
            eta = (total - done) / rate / 60 if rate > 0 else 0
            print(f"  [{done}/{total}] generated={generated} skipped={skipped} "
                  f"failed={failed} ({rate:.1f}/sec, ~{eta:.1f}min remaining)")

        # Save checkpoint every 100 members
        if generated % 100 == 0 and generated > 0:
            with open(output_path, "w") as f:
                json.dump(summaries, f, separators=(",", ":"))
            print(f"  ** checkpoint saved ({len(summaries)} total) **")

        # Rate limiting
        time.sleep(REQUEST_PAUSE)
        if generated % BATCH_SIZE == 0 and generated > 0:
            time.sleep(BATCH_PAUSE)

    # Final save
    with open(output_path, "w") as f:
        json.dump(summaries, f, separators=(",", ":"))

    elapsed = time.time() - start_time
    print(f"\nDone! {generated} generated, {skipped} skipped, {failed} failed")
    print(f"Total summaries: {len(summaries)}")
    print(f"Time: {elapsed:.1f}s ({elapsed/60:.1f}min)")
    print(f"Output: {output_path} ({os.path.getsize(output_path):,} bytes)")


if __name__ == "__main__":
    main()
