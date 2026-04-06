#!/usr/bin/env python3
"""
enrich_ballot_measures.py

Scores each ballot measure on the same two ideological axes used for
Congress members (economic and social), and detects framing gaps where
a measure's title obscures its structural policy effect.

Reads:  data/ballot-measures.json  (output of fetch_ballot_measures.py)
Writes: data/ballot-measures.json  (adds enrichment fields in-place)

Skips measures that already have all six enrichment fields, so re-runs
are additive and cheap. New measures added by a fresh scrape get picked
up automatically on the next run.

Usage:
  python3 scripts/enrich_ballot_measures.py            # enrich new measures
  python3 scripts/enrich_ballot_measures.py --dry-run  # list measures, no API calls
  python3 scripts/enrich_ballot_measures.py --force    # re-score all measures
"""
import argparse
import json
import os
import re
import sys
import time

SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR     = os.path.dirname(SCRIPT_DIR)
DATA_DIR     = os.path.join(ROOT_DIR, "data")
INPUT_PATH   = os.path.join(DATA_DIR, "ballot-measures.json")
OUTPUT_PATH  = INPUT_PATH  # write back to same file

ENRICHMENT_FIELDS = ("econScore", "socialScore", "econReasoning",
                     "socialReasoning", "framingFlag", "framingNote")

VALID_FRAMING_FLAGS = {
    "mandatory_minimum",
    "revenue_impact",
    "procedural_power_shift",
    "scope_expansion",
    "rights_framing",
}

MODEL = "claude-haiku-4-5-20251001"


def needs_enrichment(measure: dict) -> bool:
    return not all(k in measure for k in ENRICHMENT_FIELDS)


def build_prompt(measure: dict) -> str:
    return f"""You are scoring a ballot measure on two ideological axes used to map U.S. political positions.

MEASURE:
  State: {measure['state']}
  Type: {measure['type']}
  Title: {measure['title']}
  Description: {measure['summary']}
  Category: {measure['category']}

─── SCORING INSTRUCTIONS ───────────────────────────────────────────────────────

Score each measure based on how it aligns with the American political spectrum —
specifically, which side of the U.S. political divide (Democrat vs. Republican,
left vs. right) would predominantly back this measure if it appeared on a ballot.

ECONOMIC AXIS (-1.0 to +1.0):
  -1.0 = Left / Democrat-aligned (redistribution, public programs, regulation, progressive taxation)
  +1.0 = Right / Republican-aligned (tax cuts, deregulation, private ownership, market-driven)
  0.0  = Neutral / no significant economic dimension

SOCIAL AXIS (-1.0 to +1.0):
  -1.0 = Left / Democrat-aligned (abortion rights, LGBTQ+ protections, criminal justice reform,
         voting rights expansion, drug legalization, separation of church and state)
  +1.0 = Right / Republican-aligned (gun rights, abortion restrictions, anti-drug-legalization,
         mandatory minimums, voter ID, immigration restriction, religious exemptions,
         traditional family definitions, anti-trans policies)
  0.0  = Neutral / no significant social dimension

CRITICAL GUIDANCE — common scoring mistakes to avoid:
  - Gun rights amendments score POSITIVE (conservative/right), even if framed as "individual rights"
  - Voter ID requirements score POSITIVE (conservative/right)
  - Citizenship voting requirements score POSITIVE (conservative/right)
  - Drug legalization restrictions score POSITIVE (conservative/right)
  - Same-sex marriage protections score NEGATIVE (progressive/left)
  - Abortion rights protections score NEGATIVE (progressive/left)
  - Voting rights restoration for felons scores NEGATIVE (progressive/left)
  - Religious exemption expansions score POSITIVE (conservative/right)
  - Do NOT conflate libertarian philosophy with left/progressive — gun rights and
    religious exemptions are conservative positions in the U.S. political context
    even when framed as "freedom" or "individual rights"

Calibration anchors for reference:
  Bernie Sanders:    economic=-0.90, social=-0.80
  Elizabeth Warren:  economic=-0.82, social=-0.75
  Brian Fitzpatrick: economic=+0.20, social=+0.10  (moderate centrist)
  Rand Paul:         economic=+0.65, social=+0.10  (libertarian — note: gun rights etc. still +)
  Ted Cruz:          economic=+0.88, social=+0.88  (hard conservative)

─── FRAMING ANALYSIS ───────────────────────────────────────────────────────────

Also check whether the measure's title or framing obscures its structural policy effect.
Use ONLY one of these categories or null:

  mandatory_minimum    — emotionally appealing cause (child safety, victim protection) that
                         conceals removal of judicial discretion over sentencing or bail
  revenue_impact       — benefit framing (grocery tax relief, rate caps) obscures the fiscal
                         mechanism or who ultimately bears the cost
  procedural_power_shift — framed as election/process reform but structurally shifts power
                           between branches or institutions
  scope_expansion      — emotionally loaded anchor (trafficking, terrorism) used to expand
                         government authority well beyond the named cause
  rights_framing       — "rights" or "freedom" language applied to a restriction, or
                         restriction language applied to an expansion
  null                 — title and framing accurately reflect the structural policy effect

IMPORTANT: Only flag a measure if the gap between framing and structural effect is MATERIAL
and NON-OBVIOUS to a typical voter. Do not flag every partisan measure.

─── REQUIRED OUTPUT ────────────────────────────────────────────────────────────

Return ONLY valid JSON with exactly these six keys:

{{
  "econScore": <float -1.0 to 1.0>,
  "socialScore": <float -1.0 to 1.0>,
  "econReasoning": "<1-2 neutral sentences explaining the economic score>",
  "socialReasoning": "<1-2 neutral sentences explaining the social score>",
  "framingFlag": "<one of the categories above, or null>",
  "framingNote": "<if framingFlag is non-null: one neutral sentence on the gap; otherwise null>"
}}

No other output. Return valid JSON only."""


def call_claude(client, measure: dict) -> dict:
    prompt = build_prompt(measure)
    msg = client.messages.create(
        model=MODEL,
        max_tokens=400,
        messages=[{"role": "user", "content": prompt}],
    )
    text = msg.content[0].text.strip()
    # Strip markdown code fences if present
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


def validate_and_apply(measure: dict, result: dict) -> None:
    """Validate API result and write enrichment fields onto measure in-place."""
    # Clamp scores to [-1, 1]
    econ   = max(-1.0, min(1.0, float(result.get("econScore",   0.0))))
    social = max(-1.0, min(1.0, float(result.get("socialScore", 0.0))))

    flag = result.get("framingFlag")
    if flag not in VALID_FRAMING_FLAGS:
        if flag is not None:
            print(f"  WARNING: unexpected framingFlag '{flag}' — setting to null")
        flag = None

    note = result.get("framingNote") if flag else None

    measure["econScore"]     = round(econ,   3)
    measure["socialScore"]   = round(social, 3)
    measure["econReasoning"] = result.get("econReasoning",   "")
    measure["socialReasoning"] = result.get("socialReasoning", "")
    measure["framingFlag"]   = flag
    measure["framingNote"]   = note


def main():
    parser = argparse.ArgumentParser(description="Enrich ballot measures with ideology scores")
    parser.add_argument("--dry-run", action="store_true", help="List measures to enrich, no API calls")
    parser.add_argument("--force",   action="store_true", help="Re-score all measures, even if already enriched")
    args = parser.parse_args()

    if not os.path.exists(INPUT_PATH):
        print(f"ERROR: {INPUT_PATH} not found. Run fetch_ballot_measures.py first.", file=sys.stderr)
        sys.exit(1)

    with open(INPUT_PATH, "r") as f:
        measures = json.load(f)

    to_enrich = [m for m in measures if args.force or needs_enrichment(m)]

    if not to_enrich:
        print(f"All {len(measures)} measures already enriched. Use --force to re-score.")
        return

    print(f"Enriching {len(to_enrich)}/{len(measures)} measures...")

    if args.dry_run:
        for m in to_enrich:
            print(f"  [dry-run] {m['stateCode']} — {m['title'][:70]}")
        print(f"\nDry run complete. {len(to_enrich)} measure(s) would be enriched.")
        return

    try:
        import anthropic
    except ImportError:
        print("ERROR: anthropic package not installed. Run: pip install anthropic", file=sys.stderr)
        sys.exit(1)

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: ANTHROPIC_API_KEY environment variable not set.", file=sys.stderr)
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)
    errors = 0

    for i, measure in enumerate(to_enrich, 1):
        label = f"{measure['stateCode']} — {measure['title'][:60]}"
        print(f"[{i}/{len(to_enrich)}] {label}")

        try:
            result = call_claude(client, measure)
            validate_and_apply(measure, result)
            flag = measure["framingFlag"]
            print(f"  econ={measure['econScore']:+.3f}  social={measure['socialScore']:+.3f}"
                  f"  framing={flag if flag else 'none'}")
            time.sleep(0.3)  # gentle rate limiting
        except Exception as e:
            print(f"  ERROR: {e} — skipping (will retry on next run)")
            errors += 1

    # Write back regardless of errors — preserve partial progress
    with open(OUTPUT_PATH, "w") as f:
        json.dump(measures, f, indent=2)

    enriched = len(to_enrich) - errors
    print(f"\nDone. {enriched}/{len(to_enrich)} measures enriched. Written to {OUTPUT_PATH}")
    if errors:
        print(f"  {errors} measure(s) failed — they will be retried on next run.")
        sys.exit(1)


if __name__ == "__main__":
    main()
