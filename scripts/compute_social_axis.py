#!/usr/bin/env python3
"""
Compute a social/cultural ideology score for each member of Congress.

Sources:
  1. Interest-group scorecard data (data/interest-group-scores.json)
     - NumbersUSA (immigration grades)
  2. Curated social-issue roll-call votes from the current Congress
     - Immigration: Laken Riley, Sanctuary Cities, DUI protections, etc.
     - Drugs/Crime: HALT Fentanyl, DC CRIMES, Policing, PROTECT Our Kids
     - Abortion/Gender: Born-Alive, Women in Sports, Children's Innocence
     - Environment: CA Pollution Control Rule

Score range: -1 (most progressive) to +1 (most conservative).
Output: data/social-scores.json (consumed by update_current.py).
"""
import json
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(ROOT_DIR, "data")
VOTES_DIR = os.path.join(DATA_DIR, "votes")
IG_PATH = os.path.join(DATA_DIR, "interest-group-scores.json")
INDEX_PATH = os.path.join(DATA_DIR, "members-index.json")
OUTPUT_PATH = os.path.join(DATA_DIR, "social-scores.json")


# ---------------------------------------------------------------------------
# Curated social-issue votes for the 119th Congress.
# Each entry: (rollcall_number, conservative_is_yea, category, description)
#
# Only SUBSTANTIVE votes (not procedural) where Yea/Nay reflects a clear
# social-policy position.  These were identified by checking Democratic
# crossover rates — each included vote has at least *some* within-party
# variation so the scores are not purely party-line.
# ---------------------------------------------------------------------------
CURATED_HOUSE_VOTES_119 = [
    # --- Immigration / Border ---
    (5,   True, "immigration", "Laken Riley Act"),
    (22,  True, "immigration", "Laken Riley Act (Senate version)"),
    (16,  True, "immigration", "Preventing Violence Against Women by Illegal Aliens Act"),
    (170, True, "immigration", "DC Federal Immigration Compliance Act"),
    (152, True, "immigration", "Save SBA from Sanctuary Cities Act"),
    (182, True, "immigration", "Protect Communities from DUIs Act"),
    (183, True, "immigration", "Special Interest Alien Reporting Act"),
    # --- Drugs / Crime / Law Enforcement ---
    (32,  True, "crime",       "HALT Fentanyl Act"),
    (165, True, "crime",       "HALT Fentanyl Act (Senate version)"),
    (269, True, "crime",       "DC CRIMES Act"),
    (274, True, "crime",       "DC Policing Protection Act"),
    (312, True, "crime",       "PROTECT Our Kids Act"),
    (331, True, "crime",       "Protect America's Workforce Act"),
    # --- Abortion / Gender / Family ---
    (11,  True, "social",      "Protection of Women and Girls in Sports Act"),
    (26,  True, "social",      "Born-Alive Abortion Survivors Protection Act"),
    (350, True, "social",      "Protect Children's Innocence Act"),
    (397, True, "social",      "Supporting Pregnant and Parenting Women Act"),
    # --- Environment (social-adjacent regulatory) ---
    (113, True, "regulatory",  "CA Pollution Control Rule Disapproval"),
]

CURATED_SENATE_VOTES_119 = [
    # --- Immigration (S5 Laken Riley series) ---
    (1,  True, "immigration", "Laken Riley Act – cloture"),
    (3,  True, "immigration", "S5 amendment: expand offenses for mandatory detention"),
    (5,  True, "immigration", "Laken Riley Act – passage"),
    (6,  True, "immigration", "S5 amendment: crimes resulting in death/serious injury"),
    (7,  True, "immigration", "Laken Riley Act – engrossment"),
    # --- Abortion / Gender ---
    (11, True, "social",      "S6: prohibit healthcare practitioner – born alive"),
]


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


def compute_curated_vote_scores(congress=119):
    """
    Score members 0-100 based on curated social-issue roll-call votes.
    100 = voted conservative on every scored vote; 0 = voted progressive on all.

    Votes are grouped by category and averaged per-category first, then
    categories are averaged.  This prevents immigration (many votes) from
    dominating the composite.
    """
    house_votes_map = {119: CURATED_HOUSE_VOTES_119}
    senate_votes_map = {119: CURATED_SENATE_VOTES_119}

    house_curated = house_votes_map.get(congress, [])
    senate_curated = senate_votes_map.get(congress, [])

    if not house_curated and not senate_curated:
        print("  No curated votes defined for this congress")
        return {}

    # Load vote files
    scores_by_cat = {}  # icpsr -> {category -> (conservative_count, total_count)}

    for chamber_code, curated_list in [("H", house_curated), ("S", senate_curated)]:
        vote_file = os.path.join(VOTES_DIR, f"{chamber_code}{congress}.json")
        if not os.path.exists(vote_file):
            print(f"  WARNING: {vote_file} not found")
            continue
        with open(vote_file) as f:
            vdata = json.load(f)

        rollcalls = vdata["r"]
        member_votes = vdata["v"]
        rc_index = {rc[0]: i for i, rc in enumerate(rollcalls)}

        for rc_num, cons_is_yea, category, desc in curated_list:
            if rc_num not in rc_index:
                print(f"  WARNING: RC{rc_num} not found in {chamber_code}{congress}")
                continue
            pos = rc_index[rc_num]

            for icpsr, vote_str in member_votes.items():
                if pos >= len(vote_str):
                    continue
                v = vote_str[pos]
                if v not in ("1", "6"):
                    continue  # skip absent/not-voting

                # 1 = yea, 6 = nay
                is_conservative = (v == "1") == cons_is_yea

                if icpsr not in scores_by_cat:
                    scores_by_cat[icpsr] = {}
                if category not in scores_by_cat[icpsr]:
                    scores_by_cat[icpsr][category] = [0, 0]
                scores_by_cat[icpsr][category][1] += 1  # total
                if is_conservative:
                    scores_by_cat[icpsr][category][0] += 1  # conservative

    # Compute per-member score: average of per-category percentages
    result = {}
    for icpsr, cats in scores_by_cat.items():
        cat_pcts = []
        for cat, (cons, total) in cats.items():
            if total > 0:
                cat_pcts.append(cons / total * 100.0)
        if cat_pcts:
            result[icpsr] = round(sum(cat_pcts) / len(cat_pcts), 1)

    # Stats
    if result:
        vals = list(result.values())
        print(f"\n  Curated vote scores: {len(result)} members")
        print(f"    Range: {min(vals):.1f}% - {max(vals):.1f}%")
        print(f"    Mean:  {sum(vals)/len(vals):.1f}%")
        print(f"    Categories used: {sorted(set(c for cats in scores_by_cat.values() for c in cats))}")

    return result


def compute_composite(congress=119):
    """Build composite social scores from interest-group data + curated votes."""
    # Load interest-group scores
    if not os.path.exists(IG_PATH):
        print(f"  WARNING: {IG_PATH} not found. Will use curated votes only.")
        ig_data = {"organizations": {}}
    else:
        with open(IG_PATH) as f:
            ig_data = json.load(f)

    orgs = ig_data.get("organizations", {})
    org_names = list(orgs.keys())
    print(f"  Interest-group sources: {org_names}")

    # Compute curated vote-based scores
    print("\n  Computing curated social-issue vote scores...")
    curated_scores = compute_curated_vote_scores(congress)

    # Load members index for fallback and counting
    with open(INDEX_PATH) as f:
        index = json.load(f)
    current_members = {str(m["i"]): m for m in index if m.get("l") == congress and m.get("i")}
    print(f"\n  Current congress members: {len(current_members)}")

    # Collect all normalized scores per member.
    # Each source contributes one normalized value in [-1, +1].
    member_composites = {}  # icpsr -> list of normalized scores
    source_labels = []

    # 1) Interest-group sources (e.g. NumbersUSA)
    for org_key, org_info in orgs.items():
        polarity = org_info.get("polarity", "conservative_high")
        org_scores = org_info.get("scores", {})
        source_labels.append(org_key)
        for icpsr, pct in org_scores.items():
            normalized = normalize_score(pct, polarity)
            member_composites.setdefault(icpsr, []).append(normalized)

    # 2) Curated social-issue votes
    if curated_scores:
        source_labels.append("curated_social_votes")
        for icpsr, pct in curated_scores.items():
            normalized = normalize_score(pct, "conservative_high")
            member_composites.setdefault(icpsr, []).append(normalized)

    print(f"  Composite sources: {source_labels}")

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
                "socialVotes": len(raw_scores),  # number of sources
                "progressive": 0,
                "conservative": 0,
                "fallback": False,
            }
            ig_count += 1
        else:
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
            "sources": source_labels,
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
