#!/usr/bin/env python3
"""
Compute a social/cultural ideology score for each member of Congress.

Reads vote data from data/votes/{H,S}119.json, classifies rollcalls as
social/cultural using keyword patterns, determines the progressive direction
via party majority rule, and outputs per-member scores to data/social-scores.json.

Score range: -1 (most progressive) to +1 (most conservative).
Members with fewer than 10 classified social votes are flagged for fallback.
"""
import json
import os
import re
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(ROOT_DIR, "data")
VOTES_DIR = os.path.join(DATA_DIR, "votes")

# Minimum classified social votes to produce a non-fallback score
MIN_SOCIAL_VOTES = 10

# Minimum party consensus (fraction) to determine progressive direction
PARTY_CONSENSUS = 0.70

# ---------------------------------------------------------------------------
# Keyword patterns for social/cultural vote classification
# Each pattern is compiled as case-insensitive regex.
# A rollcall is "social" if its description or bill text matches any pattern.
# ---------------------------------------------------------------------------
SOCIAL_KEYWORDS = [
    # Abortion / Reproductive rights
    r"\babortion\b", r"\breproductive\b", r"\broe\b", r"\bpro.?life\b",
    r"\bpro.?choice\b", r"\bcontraception\b", r"\bcontraceptive\b",
    r"\b(?:in vitro|ivf)\b", r"\bfetal\b", r"\bfetus\b",
    r"\bplanned parenthood\b", r"\bfamily planning\b",
    r"\bbirth control\b", r"\bpregnancy\b", r"\bprenatal\b",
    r"\bborn.?alive\b",

    # LGBTQ+ / Gender
    r"\blgbt\w*\b", r"\btransgender\b",
    r"\bsame.?sex\b", r"\bmarriage equality\b", r"\bgender identity\b",
    r"\bsexual orientation\b", r"\b(?:gay|lesbian)\b",
    r"\bdrag (?:queen|show|performance)\b",
    r"\bwomen.*(?:sports|athlet)\b", r"\bgirls.*(?:sports|athlet)\b",
    r"\bfemale athlet\b", r"\bbiological (?:sex|male|female)\b",

    # Guns / Firearms
    r"\bguns?\b", r"\bfirearms?\b", r"\bsecond amendment\b",
    r"\bassault weapon\b", r"\bbackground check\b", r"\bred flag\b",
    r"\bammunition\b", r"\bconcealed carry\b",
    r"\b(?:bureau of alcohol|atf)\b", r"\bgun violence\b",
    r"\bghost gun\b", r"\bbump stock\b",

    # Immigration / Aliens
    r"\bimmigra\w+\b", r"\bborder (?:security|wall|patrol|protection|crisis)\b",
    r"\basylum\b", r"\bdeportat\w+\b", r"\bdaca\b", r"\bsanctuary\b",
    r"\bvisa\b", r"\bundocumented\b", r"\billegal aliens?\b",
    r"\b(?:ice|customs enforcement)\b", r"\bdream(?:er)?s?\b",
    r"\brefugee\b", r"\bnaturalization\b",
    r"\binadmissible aliens?\b", r"\baliens?\b",
    r"\blaken riley\b",

    # Civil rights / Equality
    r"\bcivil rights\b", r"\bvoting rights\b", r"\bdiscrimination\b",
    r"\baffirmative action\b", r"\bdei\b",
    r"\bracial equity\b", r"\bhate crime\b", r"\bequal protection\b",
    r"\bequal rights amendment\b", r"\bjuneteenth\b",
    r"\breparation\b", r"\bsystemic racism\b",

    # Religious liberty
    r"\breligious (?:freedom|liberty)\b", r"\bfaith.?based\b",
    r"\bprayer\b", r"\bestablishment clause\b", r"\bchurch and state\b",
    r"\breligious exemption\b",

    # Criminal justice / Drugs
    r"\bsentencing\b", r"\bincarceration\b",
    r"\bpolice reform\b", r"\bpolicing\b",
    r"\bdeath penalty\b", r"\bcapital punishment\b",
    r"\bmarijuana\b", r"\bcannabis\b", r"\bdrug (?:policy|enforcement)\b",
    r"\bqualified immunity\b", r"\bbail reform\b",
    r"\bprison reform\b", r"\bjuvenile justice\b",
    r"\bfentanyl\b", r"\bcontrolled substance\b", r"\bopioid\b",
    r"\bdrug traffick\w+\b", r"\bnarcotics?\b",

    # Cultural / Education
    r"\bcritical race theory\b", r"\bcrt\b",
    r"\btitle ix\b",
    r"\bschool (?:curriculum|choice|voucher)\b",
    r"\bparental rights\b", r"\bbook ban\b",
    r"\bflag (?:protection|desecration|burning)\b",
    r"\bcensorship\b",
    r"\bpledge of allegiance\b",
    r"\bdiversity.*inclusion\b",

    # Death / end of life
    r"\beuthanasia\b", r"\bassisted suicide\b",

    # Misc social
    r"\bhuman trafficking\b", r"\bdomestic violence\b",
    r"\bchild (?:abuse|welfare|protection)\b",
    r"\bsex (?:trafficking|offender)\b",
    r"\bviolence against women\b",
]

# Compile all patterns once
_SOCIAL_PATTERNS = [re.compile(p, re.IGNORECASE) for p in SOCIAL_KEYWORDS]


def is_social_vote(description, bill_number=""):
    """Return True if this rollcall's text matches any social keyword."""
    text = (description or "") + " " + (bill_number or "")
    for pat in _SOCIAL_PATTERNS:
        if pat.search(text):
            return True
    return False


def load_votes(chamber, congress):
    """Load vote JSON for a chamber/congress pair."""
    path = os.path.join(VOTES_DIR, f"{chamber}{congress}.json")
    if not os.path.exists(path):
        print(f"  WARNING: {path} not found, skipping")
        return None
    with open(path) as f:
        return json.load(f)


def build_party_map(index_path, congress):
    """Build ICPSR → party mapping from members-index.json."""
    with open(index_path) as f:
        index = json.load(f)
    party_map = {}
    for m in index:
        if m.get("l") == congress and m.get("i"):
            party_map[str(m["i"])] = m["p"]
    return party_map


def classify_and_score(congress=119):
    """Main pipeline: classify votes, determine direction, score members."""
    index_path = os.path.join(DATA_DIR, "members-index.json")
    party_map = build_party_map(index_path, congress)
    print(f"  Loaded {len(party_map)} members from index for Congress {congress}")

    total_rollcalls = 0
    classified_rollcalls = 0
    skipped_no_consensus = 0

    # Each entry: {"progressive": int, "conservative": int, "total_social": int}
    member_scores = {}

    for chamber in ["H", "S"]:
        data = load_votes(chamber, congress)
        if not data:
            continue

        rollcalls = data["r"]
        votes = data["v"]
        n_rolls = len(rollcalls)
        total_rollcalls += n_rolls
        print(f"  {chamber}{congress}: {n_rolls} rollcalls, {len(votes)} members")

        for idx, rc in enumerate(rollcalls):
            # rc: [rollnum, date, bill, question, result, yea, nay, desc]
            desc = rc[7] if len(rc) > 7 else ""
            bill = rc[2] if len(rc) > 2 else ""
            question = rc[3] if len(rc) > 3 else ""

            # Combine description + question + bill for matching
            if not is_social_vote(desc, bill):
                if not is_social_vote(question, bill):
                    continue

            classified_rollcalls += 1

            # Count party votes for this rollcall to determine direction
            d_yea, d_nay, r_yea, r_nay = 0, 0, 0, 0
            for icpsr, vote_str in votes.items():
                if idx >= len(vote_str):
                    continue
                cast = int(vote_str[idx])
                party = party_map.get(icpsr)
                if not party:
                    continue
                if 1 <= cast <= 3:  # Yea
                    if party == "D":
                        d_yea += 1
                    elif party == "R":
                        r_yea += 1
                elif 4 <= cast <= 6:  # Nay
                    if party == "D":
                        d_nay += 1
                    elif party == "R":
                        r_nay += 1

            # Determine progressive direction via party majority rule
            d_total = d_yea + d_nay
            r_total = r_yea + r_nay
            if d_total == 0:
                skipped_no_consensus += 1
                continue

            d_yea_pct = d_yea / d_total if d_total > 0 else 0.5

            if d_yea_pct >= PARTY_CONSENSUS:
                # Dem majority voted Yea → Yea is progressive
                progressive_is_yea = True
            elif (1 - d_yea_pct) >= PARTY_CONSENSUS:
                # Dem majority voted Nay → Nay is progressive
                progressive_is_yea = False
            else:
                # No clear consensus — skip
                skipped_no_consensus += 1
                continue

            # Score each member on this rollcall
            for icpsr, vote_str in votes.items():
                if idx >= len(vote_str):
                    continue
                cast = int(vote_str[idx])
                is_yea = 1 <= cast <= 3
                is_nay = 4 <= cast <= 6
                if not is_yea and not is_nay:
                    continue  # Absent/present — skip

                if icpsr not in member_scores:
                    member_scores[icpsr] = {"progressive": 0, "conservative": 0, "total_social": 0}

                ms = member_scores[icpsr]
                ms["total_social"] += 1

                if progressive_is_yea:
                    if is_yea:
                        ms["progressive"] += 1
                    else:
                        ms["conservative"] += 1
                else:
                    if is_nay:
                        ms["progressive"] += 1
                    else:
                        ms["conservative"] += 1

    # Compute final scores
    scores_out = {}
    fallback_count = 0
    for icpsr, ms in member_scores.items():
        total = ms["progressive"] + ms["conservative"]
        if total == 0:
            continue
        # Score: -1 = most progressive, +1 = most conservative
        raw = (ms["conservative"] - ms["progressive"]) / total
        score = round(max(-1.0, min(1.0, raw)), 4)
        fallback = ms["total_social"] < MIN_SOCIAL_VOTES
        if fallback:
            fallback_count += 1
        scores_out[icpsr] = {
            "score": score,
            "socialVotes": ms["total_social"],
            "progressive": ms["progressive"],
            "conservative": ms["conservative"],
            "fallback": fallback,
        }

    print(f"\n  Summary:")
    print(f"    Total rollcalls:           {total_rollcalls}")
    print(f"    Classified as social:      {classified_rollcalls}")
    print(f"    Skipped (no consensus):    {skipped_no_consensus}")
    print(f"    Used for scoring:          {classified_rollcalls - skipped_no_consensus}")
    print(f"    Members scored:            {len(scores_out)}")
    print(f"    Members flagged fallback:  {fallback_count}")

    output = {
        "meta": {
            "congress": congress,
            "total_rollcalls": total_rollcalls,
            "classified_social": classified_rollcalls,
            "used_for_scoring": classified_rollcalls - skipped_no_consensus,
            "skipped_no_consensus": skipped_no_consensus,
            "members_scored": len(scores_out),
            "members_fallback": fallback_count,
        },
        "scores": scores_out,
    }

    out_path = os.path.join(DATA_DIR, "social-scores.json")
    with open(out_path, "w") as f:
        json.dump(output, f, separators=(",", ":"))
    print(f"\n  Written to {out_path} ({os.path.getsize(out_path):,} bytes)")

    return output


def main():
    congress = int(sys.argv[1]) if len(sys.argv) > 1 else 119
    print(f"Computing social axis scores for Congress {congress}\n")
    result = classify_and_score(congress)

    # Print sample scores for spot-checking
    print("\n  Sample scores (first 10):")
    for icpsr, s in list(result["scores"].items())[:10]:
        fb = " [FALLBACK]" if s["fallback"] else ""
        print(f"    ICPSR {icpsr}: score={s['score']:+.4f}  "
              f"prog={s['progressive']} cons={s['conservative']} "
              f"total={s['socialVotes']}{fb}")


if __name__ == "__main__":
    main()
