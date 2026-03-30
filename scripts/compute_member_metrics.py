#!/usr/bin/env python3
"""
Compute deterministic per-member metrics from scoring-input files.

Produces data/member-metrics.json with:
  - party_alignment_overall: % votes with own party majority
  - party_alignment_by_category: same, broken down by policy area
  - policy_fingerprint: per-category vote breakdown (pct_conservative, total)
  - sponsored_policy_areas: areas where member has sponsored bills
  - cosponsored_policy_areas: areas where member has cosponsored bills

These metrics feed into:
  1. The LLM scoring prompt (party alignment + sponsorship sections)
  2. members-current.json as policyFingerprint (replaces policyHeterodoxy)

Usage:
  python3 scripts/compute_member_metrics.py              # all scored members
  python3 scripts/compute_member_metrics.py --members S000033,C001098
  python3 scripts/compute_member_metrics.py --congress 119
"""
import argparse
import json
import os
import re
import sys
from collections import defaultdict

SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR    = os.path.dirname(SCRIPT_DIR)
DATA_DIR    = os.path.join(ROOT_DIR, "data")
VOTES_DIR   = os.path.join(DATA_DIR, "votes")
INPUTS_DIR  = os.path.join(DATA_DIR, "scoring-inputs")
OUTPUT_PATH = os.path.join(DATA_DIR, "member-metrics.json")

# ── Policy category keyword matching ─────────────────────────────────────────
# Applied to: bill number + question text + bill title (from scoring-input)
# Each category gets its own conservative-direction definition for fingerprint scoring.

CATEGORIES = {
    "fiscal_tax": {
        "keywords": ["tax", "budget", "appropriat", "spending", "deficit", "debt",
                     "reconcil", "fiscal", "revenue", "irs", "big beautiful",
                     "continuing resolution", "omnibus"],
        "conservative_is_yea": True,   # cutting taxes/spending = conservative
    },
    "healthcare": {
        "keywords": ["health", "medicare", "medicaid", "aca", "obamacare", "drug",
                     "prescri", "insurance", "hospital", "pharma", "opioid"],
        "conservative_is_yea": False,  # Nay on ACA expansion = conservative
    },
    "immigration": {
        "keywords": ["border", "immigr", "asylum", "visa", "citizenship", "alien",
                     "deportat", "sanctuary", "laken", "riley", "undocumented"],
        "conservative_is_yea": True,
    },
    "environment": {
        "keywords": ["climate", "clean energy", "epa", "emission", "environ",
                     "fossil", "green new", "oil", "gas", "coal", "pollution",
                     "renewable", "carbon"],
        "conservative_is_yea": False,  # Nay on clean-energy bills = conservative
    },
    "guns": {
        "keywords": ["firearm", "gun", "weapon", "background check",
                     "second amendment", "assault weapon"],
        "conservative_is_yea": False,  # Nay on gun-safety bills = conservative
    },
    "criminal_justice": {
        "keywords": ["sentenc", "polic", "prison", "criminal justice", "incarcerat",
                     "fentanyl", "death penalty", "mandatory minimum", "dc crimes",
                     "dc policing", "halt fentanyl"],
        "conservative_is_yea": True,
    },
    "social_rights": {
        "keywords": ["abortion", "lgbtq", "gender", "marriage", "religious freedom",
                     "transgender", "reproductive", "born alive", "women in sports",
                     "children's innocence", "parenting"],
        "conservative_is_yea": True,
    },
    "military_defense": {
        "keywords": ["defense", "military", "ndaa", "veteran", "army", "navy",
                     "nato", "ukraine", "israel", "pentagon", "troops",
                     "armed forces", "national security"],
        "conservative_is_yea": True,
    },
    "trade": {
        "keywords": ["tariff", "trade agreement", "wto", "import", "export",
                     "free trade", "commerce", "nafta", "usmca"],
        "conservative_is_yea": True,
    },
    "elections": {
        "keywords": ["voting right", "election security", "campaign finance",
                     "filibuster", "electoral college", "voter id",
                     "proof of citizenship", "safeguard american voter"],
        "conservative_is_yea": True,
    },
}


def categorize_vote(vote):
    """Return (category_key, conservative_is_yea) or (None, None) if uncategorized."""
    text = " ".join(filter(None, [
        vote.get("bill", ""),
        vote.get("question", ""),
        vote.get("title", ""),
    ])).lower()

    for cat, cfg in CATEGORIES.items():
        if any(kw in text for kw in cfg["keywords"]):
            return cat, cfg["conservative_is_yea"]
    return None, None


# ── Party majority computation ────────────────────────────────────────────────

def compute_party_majorities(all_inputs):
    """
    For each vote (identified by date+bill+question), compute what position
    the majority of each party took.
    Returns: {vote_key: {"D": "Yea"|"Nay", "R": "Yea"|"Nay"}}
    """
    # Accumulate party votes per vote key
    # vote_key = f"{date}|{bill}|{question}"
    party_tallies = defaultdict(lambda: {"D": {"Yea": 0, "Nay": 0},
                                          "R": {"Yea": 0, "Nay": 0},
                                          "I": {"Yea": 0, "Nay": 0}})

    for inp in all_inputs.values():
        party = inp.get("party", "")
        party_code = "D" if party == "Democrat" else ("R" if party == "Republican" else "I")
        for vote in inp.get("votes", []):
            key = f"{vote['date']}|{vote['bill']}|{vote['question']}"
            party_tallies[key][party_code][vote["position"]] += 1

    majorities = {}
    for key, parties in party_tallies.items():
        row = {}
        for p, counts in parties.items():
            if counts["Yea"] + counts["Nay"] == 0:
                continue
            row[p] = "Yea" if counts["Yea"] >= counts["Nay"] else "Nay"
        majorities[key] = row
    return majorities


# ── Per-member metrics ────────────────────────────────────────────────────────

def compute_metrics_for_member(inp, majorities):
    party     = inp.get("party", "")
    party_key = "D" if party == "Democrat" else ("R" if party == "Republican" else "I")
    votes     = inp.get("votes", [])

    # Party alignment
    aligned_total    = 0
    alignment_den    = 0
    cat_aligned      = defaultdict(lambda: [0, 0])  # [aligned, total]

    # Policy fingerprint
    cat_yea = defaultdict(int)
    cat_nay = defaultdict(int)

    for vote in votes:
        pos = vote["position"]  # "Yea" or "Nay"
        key = f"{vote['date']}|{vote['bill']}|{vote['question']}"
        cat, cons_is_yea = categorize_vote(vote)

        # Party alignment
        maj = majorities.get(key, {})
        party_pos = maj.get(party_key)
        if party_pos:
            alignment_den += 1
            if pos == party_pos:
                aligned_total += 1
            if cat:
                cat_aligned[cat][1] += 1
                if pos == party_pos:
                    cat_aligned[cat][0] += 1

        # Policy fingerprint
        if cat and cons_is_yea is not None:
            is_conservative = (pos == "Yea") == cons_is_yea
            if is_conservative:
                cat_yea[cat] += 1
            else:
                cat_nay[cat] += 1

    overall_alignment = (
        round(aligned_total / alignment_den, 4) if alignment_den > 0 else None
    )

    alignment_by_cat = {}
    for cat, (aligned, total) in cat_aligned.items():
        if total > 0:
            alignment_by_cat[cat] = round(aligned / total, 4)

    fingerprint = {}
    all_cats = set(list(cat_yea.keys()) + list(cat_nay.keys()))
    for cat in all_cats:
        y = cat_yea[cat]
        n = cat_nay[cat]
        total = y + n
        if total > 0:
            fingerprint[cat] = {
                "total":           total,
                "pct_conservative": round(y / total, 4),
            }

    # Sponsorship areas
    sponsored_areas   = list({b["policyArea"] for b in inp.get("sponsored",   []) if b.get("policyArea")})
    cosponsored_areas = list({b["policyArea"] for b in inp.get("cosponsored", []) if b.get("policyArea")})

    return {
        "party_alignment_overall":     overall_alignment,
        "party_alignment_by_category": alignment_by_cat,
        "policy_fingerprint":          fingerprint,
        "sponsored_policy_areas":      sponsored_areas,
        "cosponsored_policy_areas":    cosponsored_areas,
    }


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--members", type=str, default=None)
    args = parser.parse_args()

    filter_bios = set(args.members.split(",")) if args.members else None

    # Load all available scoring inputs
    if not os.path.exists(INPUTS_DIR):
        print(f"ERROR: {INPUTS_DIR} not found. Run collect_scoring_data.py first.")
        sys.exit(1)

    all_inputs = {}
    for fname in os.listdir(INPUTS_DIR):
        if not fname.endswith(".json"):
            continue
        bio = fname[:-5]
        if filter_bios and bio not in filter_bios:
            continue
        with open(os.path.join(INPUTS_DIR, fname)) as f:
            all_inputs[bio] = json.load(f)

    print(f"Loaded {len(all_inputs)} scoring inputs")

    # Compute party majorities across all loaded members
    print("Computing party majority positions…")
    majorities = compute_party_majorities(all_inputs)
    print(f"  {len(majorities)} unique votes tracked")

    # Compute per-member metrics
    metrics_out = {}
    for bio, inp in sorted(all_inputs.items()):
        metrics = compute_metrics_for_member(inp, majorities)
        metrics_out[bio] = metrics

        # Also write party_alignment_rate back into the scoring-input file
        # so the LLM prompt builder can read it
        inp["partyAlignmentRate"] = metrics["party_alignment_overall"]
        with open(os.path.join(INPUTS_DIR, f"{bio}.json"), "w") as f:
            json.dump(inp, f, indent=2)

    with open(OUTPUT_PATH, "w") as f:
        json.dump(metrics_out, f, separators=(",", ":"))

    print(f"\nWritten: {OUTPUT_PATH}")

    # Summary stats
    alignments = [v["party_alignment_overall"]
                  for v in metrics_out.values()
                  if v["party_alignment_overall"] is not None]
    if alignments:
        print(f"\nParty alignment summary ({len(alignments)} members):")
        print(f"  Mean:  {sum(alignments)/len(alignments):.1%}")
        print(f"  Min:   {min(alignments):.1%}")
        print(f"  Max:   {max(alignments):.1%}")

    # Spot-check: list most cross-partisan members
    sorted_members = sorted(
        [(bio, m["party_alignment_overall"])
         for bio, m in metrics_out.items()
         if m["party_alignment_overall"] is not None],
        key=lambda x: x[1]
    )
    print("\n  Lowest party alignment (most independent):")
    for bio, rate in sorted_members[:5]:
        name = all_inputs[bio]["displayName"]
        party = all_inputs[bio]["party"]
        print(f"    {name} ({party}): {rate:.1%}")
    print("  Highest party alignment:")
    for bio, rate in sorted_members[-5:]:
        name = all_inputs[bio]["displayName"]
        party = all_inputs[bio]["party"]
        print(f"    {name} ({party}): {rate:.1%}")


if __name__ == "__main__":
    main()
