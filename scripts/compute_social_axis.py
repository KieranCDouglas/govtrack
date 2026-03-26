#!/usr/bin/env python3
"""
Compute a social/cultural ideology score for each member of Congress.

Primary source: interest-group scorecard data (data/interest-group-scores.json)
scraped from organizations like NumbersUSA. These provide excellent within-party
spread that keyword-based vote classification cannot achieve.

Fallback: DW-NOMINATE dim2 scores from the members-index.

Score range: -1 (most progressive) to +1 (most conservative).
Output: data/social-scores.json (consumed by update_current.py).
"""
import json
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(ROOT_DIR, "data")
IG_PATH = os.path.join(DATA_DIR, "interest-group-scores.json")
INDEX_PATH = os.path.join(DATA_DIR, "members-index.json")
OUTPUT_PATH = os.path.join(DATA_DIR, "social-scores.json")


def normalize_score(pct, polarity):
    """
    Convert a 0-100 percentage to a -1..+1 score.
    polarity="conservative_high" means 100%=most conservative=+1.
    polarity="progressive_high" means 100%=most progressive=-1.
    """
    s = (pct / 50.0) - 1.0  # maps 0→-1, 50→0, 100→+1
    if polarity == "progressive_high":
        s = -s  # flip so progressive=negative
    return round(max(-1.0, min(1.0, s)), 4)


def compute_composite(congress=119):
    """Build composite social scores from interest-group data."""
    # Load interest-group scores
    if not os.path.exists(IG_PATH):
        print(f"  ERROR: {IG_PATH} not found. Run fetch_interest_group_scores.py first.")
        sys.exit(1)

    with open(IG_PATH) as f:
        ig_data = json.load(f)

    orgs = ig_data.get("organizations", {})
    org_names = list(orgs.keys())
    print(f"  Interest-group sources: {org_names}")

    # Load members index for fallback and counting
    with open(INDEX_PATH) as f:
        index = json.load(f)
    current_members = {str(m["i"]): m for m in index if m.get("l") == congress and m.get("i")}
    print(f"  Current congress members: {len(current_members)}")

    # Compute composite: average of normalized scores across all orgs
    member_composites = {}  # icpsr -> list of normalized scores
    for org_key, org_info in orgs.items():
        polarity = org_info.get("polarity", "conservative_high")
        org_scores = org_info.get("scores", {})
        for icpsr, pct in org_scores.items():
            normalized = normalize_score(pct, polarity)
            member_composites.setdefault(icpsr, []).append(normalized)

    # Build output scores
    scores_out = {}
    ig_count = 0
    fallback_count = 0

    for icpsr, m in current_members.items():
        if icpsr in member_composites:
            raw_scores = member_composites[icpsr]
            composite = sum(raw_scores) / len(raw_scores)
            score = round(max(-1.0, min(1.0, composite)), 4)
            scores_out[icpsr] = {
                "score": score,
                "socialVotes": len(raw_scores),  # number of org sources
                "progressive": 0,   # not applicable for composite
                "conservative": 0,
                "fallback": False,
            }
            ig_count += 1
        else:
            # No interest-group data — mark as fallback
            scores_out[icpsr] = {
                "score": 0.0,
                "socialVotes": 0,
                "progressive": 0,
                "conservative": 0,
                "fallback": True,
            }
            fallback_count += 1

    # Distribution check
    ig_scores = [s["score"] for s in scores_out.values() if not s["fallback"]]
    if ig_scores:
        print(f"\n  Distribution of interest-group composite scores:")
        print(f"    Range: [{min(ig_scores):.3f}, {max(ig_scores):.3f}]")
        print(f"    Mean:  {sum(ig_scores)/len(ig_scores):.3f}")

        # Party breakdown
        r_scores = [s["score"] for ic, s in scores_out.items()
                     if not s["fallback"] and current_members.get(ic, {}).get("p") == "R"]
        d_scores = [s["score"] for ic, s in scores_out.items()
                     if not s["fallback"] and current_members.get(ic, {}).get("p") in ("D", "O")]
        if r_scores:
            print(f"    R: [{min(r_scores):.3f}, {max(r_scores):.3f}], mean={sum(r_scores)/len(r_scores):.3f}, n={len(r_scores)}")
        if d_scores:
            print(f"    D: [{min(d_scores):.3f}, {max(d_scores):.3f}], mean={sum(d_scores)/len(d_scores):.3f}, n={len(d_scores)}")

    print(f"\n  Summary:")
    print(f"    Members with IG data:      {ig_count}")
    print(f"    Members fallback:          {fallback_count}")
    print(f"    Total scored:              {len(scores_out)}")

    output = {
        "meta": {
            "congress": congress,
            "sources": org_names,
            "members_scored": ig_count,
            "members_fallback": fallback_count,
        },
        "scores": scores_out,
    }

    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, separators=(",", ":"))
    print(f"\n  Written to {OUTPUT_PATH} ({os.path.getsize(OUTPUT_PATH):,} bytes)")

    return output


def main():
    congress = int(sys.argv[1]) if len(sys.argv) > 1 else 119
    print(f"Computing social axis scores for Congress {congress}\n")
    result = compute_composite(congress)

    # Print sample scores for spot-checking
    print("\n  Sample scores:")
    items = sorted(result["scores"].items(), key=lambda x: x[1]["score"])
    # Most progressive
    print("  Most progressive (bottom 5):")
    for icpsr, s in items[:5]:
        fb = " [FALLBACK]" if s["fallback"] else ""
        print(f"    ICPSR {icpsr}: score={s['score']:+.4f}{fb}")
    # Most conservative
    print("  Most conservative (top 5):")
    for icpsr, s in items[-5:]:
        fb = " [FALLBACK]" if s["fallback"] else ""
        print(f"    ICPSR {icpsr}: score={s['score']:+.4f}{fb}")


if __name__ == "__main__":
    main()
