#!/usr/bin/env python3
"""
Score members of Congress on two ideological axes using dual LLMs.

For each member with a scoring-input file:
  1. Builds a structured prompt (sponsorship → interest groups → votes → platform)
  2. Calls Claude (claude-sonnet-4-6) and GPT-4o in parallel
  3. Averages the two raw scores
  4. Applies anchor-based linear normalization to remove LLM bias
  5. Flags low-confidence members (inter-model divergence > 0.3)

Output: data/llm-scores.json

Usage:
  python3 scripts/compute_llm_scores.py                        # all scored members
  python3 scripts/compute_llm_scores.py --members S000033,C001098
  python3 scripts/compute_llm_scores.py --dry-run              # print prompts, no API calls
  python3 scripts/compute_llm_scores.py --anchors-only         # score only the 8 anchors
  python3 scripts/compute_llm_scores.py --congress 119

Environment variables:
  ANTHROPIC_API_KEY
  OPENAI_API_KEY
"""
import argparse
import csv
import json
import os
import re
import sys
import time
from datetime import date

SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR    = os.path.dirname(SCRIPT_DIR)
DATA_DIR    = os.path.join(ROOT_DIR, "data")
INPUTS_DIR  = os.path.join(DATA_DIR, "scoring-inputs")
OUTPUT_PATH = os.path.join(DATA_DIR, "llm-scores.json")

# ── Anchor calibration points ─────────────────────────────────────────────────
# Coordinates set by human editorial judgment, informed by documented voting
# records, NOMINATE scores, and known public positions.
# See plan file for full reasoning per member.

ANCHORS = {
    "S000033": {"name": "Bernie Sanders",    "econ": -0.90, "social": -0.80},
    # Defines collectivist pole. Social -0.80 not -1.0: strong civil libertarian
    # but not culturally radical.

    "W000817": {"name": "Elizabeth Warren",  "econ": -0.82, "social": -0.75},
    # Regulatory reformer more than democratic socialist. Slightly less extreme
    # than Sanders on both axes.

    "G000592": {"name": "Jared Golden",      "econ": -0.20, "social": +0.35},
    # Populist quadrant anchor. Only Dem to vote against ARP; pro-gun, pro-border,
    # pro-tariff. Self-described "progressive conservative."

    "F000479": {"name": "John Fetterman",    "econ": -0.35, "social": +0.05},
    # Progressive economics intact (ARP, IRA, union support) but documented
    # rightward shift on immigration, Israel, Bondi confirmation.

    "F000466": {"name": "Brian Fitzpatrick", "econ": +0.20, "social": +0.10},
    # Most genuinely centrist member. Problem Solvers co-chair. Voted for
    # infrastructure, gun safety, climate bills.

    "P000603": {"name": "Rand Paul",         "econ": +0.65, "social": +0.10},
    # Libertarian on surveillance/drugs/war — but 100% pro-life and voted against
    # LGBTQ protections. Selective libertarianism nets out slightly right of center.

    "L000575": {"name": "James Lankford",    "econ": +0.60, "social": +0.72},
    # Mainstream evangelical conservative. Tried bipartisan border deal.

    "C001098": {"name": "Ted Cruz",          "econ": +0.88, "social": +0.88},
    # Defines free-market/conservative pole. NOMINATE dim1 = 0.883.
}

ANCHOR_CALIBRATION_TEXT = "\n".join(
    f"  {v['name']}: economic={v['econ']:+.2f}, social={v['social']:+.2f}"
    for v in ANCHORS.values()
)

LOW_CONFIDENCE_THRESHOLD = 0.3


# ── Prompt builder ────────────────────────────────────────────────────────────

def build_prompt(inp):
    """Construct the full scoring prompt for one member."""
    name        = inp["displayName"]
    party       = inp["party"]
    state       = inp["state"]
    chamber     = inp["chamber"]
    fc          = inp.get("firstCongress") or "unknown"
    lc          = inp.get("lastCongress") or "present"
    alignment   = inp.get("partyAlignmentRate")
    alignment_s = f"{alignment:.0%}" if alignment is not None else "unknown"

    sponsored        = inp.get("sponsored",   [])
    cosponsored      = inp.get("cosponsored", [])
    committees       = inp.get("committees",  [])
    ig_ratings       = inp.get("interestGroups", {})
    donor_industries = inp.get("donorIndustries", [])
    votes            = inp.get("votes", [])

    lines = []

    lines.append(
        "You are scoring a member of Congress on two independent ideological axes.\n"
        "Return ONLY valid JSON with exactly these keys:\n"
        '  {"economic": float, "social": float, '
        '"economic_reasoning": "...", "social_reasoning": "..."}\n'
        "Floats must be in the range [-1.0, +1.0]. No other output."
    )

    lines.append("""
AXIS DEFINITIONS:
  Economic axis:
    -1.0 = Collectivist: redistribution, public ownership, heavy regulation,
           expanded welfare, progressive taxation
    +1.0 = Free-Market: deregulation, private ownership, low taxes,
           minimal redistribution, market-driven solutions

  Social axis:
    -1.0 = Progressive: expand personal freedoms, civil liberties protections,
           criminal justice reform, challenge traditional norms
    +1.0 = Conservative: traditional social norms, religious/cultural authority,
           tough-on-crime, restrict personal freedoms judged morally harmful
""")

    lines.append(f"ANCHOR CALIBRATION (use as reference points):\n{ANCHOR_CALIBRATION_TEXT}\n")

    lines.append(
        f"MEMBER: {name}\n"
        f"  Party: {party}  |  State: {state}  |  Chamber: {chamber}\n"
        f"  Congresses served: {fc}–{lc}\n"
        f"  Party alignment rate (votes with own party): {alignment_s}\n"
    )

    if committees:
        lines.append("COMMITTEE ASSIGNMENTS (signals policy priorities):")
        for c in committees:
            role = f" [{c['role']}]" if c.get("role") else ""
            lines.append(f"  {c['committee']}{role}")
        lines.append("")

    if sponsored:
        lines.append("BILLS SPONSORED (member chose to champion — strongest signal):")
        for b in sponsored[:20]:
            congress_tag = f"[{b['congress']}] " if b.get("congress") else ""
            status = f" ({b['status']})" if b.get("status") else ""
            lines.append(f"  {congress_tag}{b['number']}: {b['title']}{status}")
        lines.append("")

    if cosponsored:
        lines.append("BILLS COSPONSORED (signals agreement — secondary signal):")
        for b in cosponsored[:15]:
            congress_tag = f"[{b['congress']}] " if b.get("congress") else ""
            lines.append(f"  {congress_tag}{b['number']}: {b['title']}")
        lines.append("")

    if donor_industries:
        lines.append("TOP PAC DONOR INDUSTRIES (2022 cycle — signals who funds this member):")
        for d in donor_industries:
            lines.append(f"  ${d['amount']:>10,}  {d['industry']}")
        lines.append("")

    if ig_ratings:
        lines.append("INTEREST-GROUP RATINGS:")
        for org, label in ig_ratings.items():
            lines.append(f"  {label}")
        lines.append("")

    if votes:
        lines.append(f"ROLL-CALL VOTES ({len(votes)} substantive votes across congresses 117-119 — procedural filtered):")
        lines.append("  Congress | Date       | Bill       | Title/Description                          | Vote")
        lines.append("  " + "-" * 90)
        for v in votes:
            title   = (v.get("title") or v.get("question") or "")[:50]
            congress = v.get("congress", "")
            lines.append(f"  {congress}    | {v['date']} | {v['bill']:10} | {title:<50} | {v['position']}")
        lines.append("")

    lines.append(
        "INSTRUCTIONS:\n"
        "- Score each axis independently. Do NOT collapse economic and social onto\n"
        "  a single left-right axis.\n"
        "- Do not let party affiliation substitute for evidence. A Democrat who\n"
        "  consistently votes with Republicans on certain issues should reflect that.\n"
        "- Weight sponsored legislation and committee assignments heavily — these\n"
        "  reflect deliberate choices, not just party-line voting.\n"
        "- Use the anchor calibration to anchor your scale, not your priors.\n"
        "- Keep reasoning concise (1-3 sentences per axis).\n"
    )

    return "\n".join(lines)


# ── LLM callers ───────────────────────────────────────────────────────────────

def call_claude(prompt, model="claude-sonnet-4-6"):
    import anthropic
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    msg = client.messages.create(
        model=model,
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    text = msg.content[0].text.strip()
    # Strip markdown code fences if present (```json ... ``` or ``` ... ```)
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    text = text.strip()
    # Fix Claude's habit of using +0.20 (invalid JSON — + prefix not allowed)
    text = re.sub(r':\s*\+(\d)', r': \1', text)
    return json.loads(text)


def call_gpt(prompt, model="gpt-4o"):
    import openai
    client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    resp = client.chat.completions.create(
        model=model,
        max_tokens=512,
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": prompt}],
    )
    return json.loads(resp.choices[0].message.content.strip())


def score_member(bio, inp, dry_run=False):
    """Score one member. Returns (claude_result, gpt_result) or (None, None) on error."""
    prompt = build_prompt(inp)

    if dry_run:
        tokens_approx = len(prompt) // 4
        print(f"\n{'─'*60}")
        print(f"PROMPT for {inp['displayName']} (~{tokens_approx} tokens):")
        print(prompt[:1500] + ("\n[...truncated...]" if len(prompt) > 1500 else ""))
        return None, None

    claude_result = gpt_result = None

    try:
        claude_result = call_claude(prompt)
        time.sleep(0.5)
    except Exception as e:
        print(f"    Claude error: {e}")

    try:
        gpt_result = call_gpt(prompt)
        time.sleep(0.5)
    except Exception as e:
        print(f"    GPT error: {e}")

    return claude_result, gpt_result


# ── Anchor normalization ──────────────────────────────────────────────────────

def fit_linear(raw_vals, target_vals):
    """
    Fit a linear transform: normalized = a * raw + b
    using least-squares over (raw, target) pairs.
    Falls back to identity if not enough points.
    """
    n = len(raw_vals)
    if n < 2:
        return 1.0, 0.0

    sum_x  = sum(raw_vals)
    sum_y  = sum(target_vals)
    sum_xx = sum(x * x for x in raw_vals)
    sum_xy = sum(x * y for x, y in zip(raw_vals, target_vals))

    denom = n * sum_xx - sum_x * sum_x
    if abs(denom) < 1e-10:
        return 1.0, 0.0

    a = (n * sum_xy - sum_x * sum_y) / denom
    b = (sum_y - a * sum_x) / n
    return a, b


def apply_normalizer(raw, a, b):
    return round(max(-1.0, min(1.0, a * raw + b)), 4)


def normalize_scores(raw_scores, anchor_raw):
    """
    raw_scores:  {bio: {"econ": float, "social": float}}
    anchor_raw:  {bio: {"econ": float, "social": float}}  (subset of raw_scores)
    Returns:     {bio: {"econ": float, "social": float}}  (normalized)
    """
    # Build (raw, target) pairs for anchors present in both sets
    econ_pairs   = []
    social_pairs = []
    for bio, targets in ANCHORS.items():
        if bio in anchor_raw:
            econ_pairs.append(  (anchor_raw[bio]["econ"],   targets["econ"]))
            social_pairs.append((anchor_raw[bio]["social"], targets["social"]))

    print(f"\nNormalization: {len(econ_pairs)} anchor points for each axis")

    a_econ,   b_econ   = fit_linear([p[0] for p in econ_pairs],   [p[1] for p in econ_pairs])
    a_social, b_social = fit_linear([p[0] for p in social_pairs], [p[1] for p in social_pairs])

    print(f"  Economic  transform: normalized = {a_econ:.3f} * raw + {b_econ:.3f}")
    print(f"  Social    transform: normalized = {a_social:.3f} * raw + {b_social:.3f}")

    normalized = {}
    for bio, scores in raw_scores.items():
        normalized[bio] = {
            "econ":   apply_normalizer(scores["econ"],   a_econ,   b_econ),
            "social": apply_normalizer(scores["social"], a_social, b_social),
        }
    return normalized


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--members",      type=str,  default=None)
    parser.add_argument("--dry-run",      action="store_true")
    parser.add_argument("--anchors-only", action="store_true")
    parser.add_argument("--congress",     type=int,  default=119)
    args = parser.parse_args()

    dry_run     = args.dry_run
    congress    = args.congress

    if not dry_run:
        if "ANTHROPIC_API_KEY" not in os.environ:
            print("ERROR: ANTHROPIC_API_KEY not set")
            sys.exit(1)
        if "OPENAI_API_KEY" not in os.environ:
            print("ERROR: OPENAI_API_KEY not set")
            sys.exit(1)

    # Determine which members to score
    if args.anchors_only:
        filter_bios = set(ANCHORS.keys())
        print(f"Anchors-only mode: scoring {len(filter_bios)} anchor members")
    elif args.members:
        filter_bios = set(args.members.split(","))
    else:
        filter_bios = None

    # Load scoring inputs
    if not os.path.exists(INPUTS_DIR):
        print(f"ERROR: {INPUTS_DIR} not found. Run collect_scoring_data.py first.")
        sys.exit(1)

    inputs = {}
    for fname in sorted(os.listdir(INPUTS_DIR)):
        if not fname.endswith(".json"):
            continue
        bio = fname[:-5]
        if filter_bios and bio not in filter_bios:
            continue
        with open(os.path.join(INPUTS_DIR, fname)) as f:
            inputs[bio] = json.load(f)

    print(f"Loaded {len(inputs)} scoring inputs")

    # Score anchors first so normalization is computed immediately
    anchor_bios     = [bio for bio in ANCHORS if bio in inputs]
    non_anchor_bios = [bio for bio in inputs   if bio not in ANCHORS]
    ordered_bios    = anchor_bios + non_anchor_bios

    raw_scores   = {}   # bio -> {econ, social} (averaged raw)
    per_model    = {}   # bio -> {econ_claude, social_claude, econ_gpt, social_gpt}
    reasoning    = {}   # bio -> {economic_reasoning, social_reasoning}
    errors       = []

    total = len(ordered_bios)
    for i, bio in enumerate(ordered_bios, 1):
        inp  = inputs[bio]
        name = inp["displayName"]
        print(f"\n[{i}/{total}] {name} ({inp['party']}, {inp['state']})")

        claude_r, gpt_r = score_member(bio, inp, dry_run=dry_run)

        if dry_run:
            continue

        if claude_r is None and gpt_r is None:
            print(f"  SKIP — both models failed")
            errors.append(bio)
            continue

        # Extract scores robustly
        def get_score(result, key):
            if result is None:
                return None
            v = result.get(key)
            if v is None:
                return None
            try:
                return float(v)
            except (TypeError, ValueError):
                return None

        ce = get_score(claude_r, "economic")
        cs = get_score(claude_r, "social")
        ge = get_score(gpt_r,    "economic")
        gs = get_score(gpt_r,    "social")

        # Average available scores
        econ_vals   = [v for v in [ce, ge] if v is not None]
        social_vals = [v for v in [cs, gs] if v is not None]

        if not econ_vals or not social_vals:
            print(f"  SKIP — missing scores: claude={claude_r} gpt={gpt_r}")
            errors.append(bio)
            continue

        avg_econ   = sum(econ_vals)   / len(econ_vals)
        avg_social = sum(social_vals) / len(social_vals)

        raw_scores[bio]  = {"econ": round(avg_econ, 4), "social": round(avg_social, 4)}
        per_model[bio]   = {
            "econ_claude":   ce, "social_claude": cs,
            "econ_gpt":      ge, "social_gpt":    gs,
        }
        reasoning[bio] = {
            "economic_reasoning": (
                (claude_r or {}).get("economic_reasoning") or
                (gpt_r    or {}).get("economic_reasoning") or ""
            ),
            "social_reasoning": (
                (claude_r or {}).get("social_reasoning") or
                (gpt_r    or {}).get("social_reasoning") or ""
            ),
        }

        econ_div   = abs(ce - ge) if ce is not None and ge is not None else None
        social_div = abs(cs - gs) if cs is not None and gs is not None else None
        low_conf   = (
            (econ_div   is not None and econ_div   > LOW_CONFIDENCE_THRESHOLD) or
            (social_div is not None and social_div > LOW_CONFIDENCE_THRESHOLD)
        )

        ediv_str = f"{econ_div:.2f}"   if econ_div   is not None else "N/A"
        sdiv_str = f"{social_div:.2f}" if social_div is not None else "N/A"
        print(f"  Raw:  econ={avg_econ:+.3f}  social={avg_social:+.3f}"
              f"  divergence: E={ediv_str}  S={sdiv_str}"
              f"{'  ⚠ LOW CONFIDENCE' if low_conf else ''}")

        if bio in ANCHORS:
            target = ANCHORS[bio]
            print(f"  Target: econ={target['econ']:+.2f}  social={target['social']:+.2f}")

    if dry_run:
        print("\n[dry-run complete — no API calls made]")
        return

    if not raw_scores:
        print("\nNo scores to write.")
        return

    # Normalize using anchor members that were scored
    anchor_raw = {bio: raw_scores[bio] for bio in ANCHORS if bio in raw_scores}
    if len(anchor_raw) >= 2:
        normalized = normalize_scores(raw_scores, anchor_raw)
    else:
        print(f"WARNING: only {len(anchor_raw)} anchor(s) scored — skipping normalization")
        normalized = {bio: s.copy() for bio, s in raw_scores.items()}

    # Build output
    scores_out = {}
    low_conf_count = 0
    for bio in raw_scores:
        pm  = per_model[bio]
        ce, cs = pm["econ_claude"], pm["social_claude"]
        ge, gs = pm["econ_gpt"],    pm["social_gpt"]

        econ_div   = abs(ce - ge) if ce is not None and ge is not None else None
        social_div = abs(cs - gs) if cs is not None and gs is not None else None
        low_conf   = (
            (econ_div   is not None and econ_div   > LOW_CONFIDENCE_THRESHOLD) or
            (social_div is not None and social_div > LOW_CONFIDENCE_THRESHOLD)
        )
        if low_conf:
            low_conf_count += 1

        scores_out[bio] = {
            "econ_normalized":   normalized[bio]["econ"],
            "social_normalized": normalized[bio]["social"],
            "econ_raw_claude":   ce,
            "social_raw_claude": cs,
            "econ_raw_gpt":      ge,
            "social_raw_gpt":    gs,
            "low_confidence":    low_conf,
            "econ_divergence":   round(econ_div, 4)   if econ_div   is not None else None,
            "social_divergence": round(social_div, 4) if social_div is not None else None,
            "economic_reasoning":  reasoning[bio]["economic_reasoning"],
            "social_reasoning":    reasoning[bio]["social_reasoning"],
        }

    output = {
        "meta": {
            "congress":          congress,
            "generated":         date.today().isoformat(),
            "models":            ["claude-sonnet-4-6", "gpt-4o"],
            "anchors":           ANCHORS,
            "members_scored":    len(scores_out),
            "low_confidence_count": low_conf_count,
            "errors":            errors,
        },
        "scores": scores_out,
    }

    # Load and merge with any existing scores (so partial runs accumulate)
    existing = {}
    if os.path.exists(OUTPUT_PATH):
        with open(OUTPUT_PATH) as f:
            try:
                existing = json.load(f).get("scores", {})
            except Exception:
                pass

    merged = {**existing, **scores_out}   # new scores overwrite old
    output["scores"] = merged
    output["meta"]["members_scored"] = len(merged)

    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n{'='*60}")
    print(f"Scores written: {len(scores_out)} new  ({len(merged)} total in file)")
    print(f"Low-confidence: {low_conf_count}")
    if errors:
        print(f"Errors: {errors}")

    # Show anchor results
    if anchor_raw:
        print("\nAnchor verification (target vs. normalized):")
        print(f"  {'Name':<22} {'Econ tgt':>9} {'Econ norm':>10} {'Soc tgt':>9} {'Soc norm':>10}")
        print("  " + "-" * 65)
        for bio, target in ANCHORS.items():
            if bio not in scores_out:
                continue
            norm = scores_out[bio]
            print(f"  {ANCHORS[bio]['name']:<22}"
                  f" {target['econ']:>+9.2f} {norm['econ_normalized']:>+10.3f}"
                  f" {target['social']:>+9.2f} {norm['social_normalized']:>+10.3f}")

    # Write CSV for sanity-checking
    csv_path = os.path.join(DATA_DIR, "llm-scores-review.csv")
    with open(csv_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "bioguide", "name", "party", "state",
            "econ_claude", "econ_gpt", "econ_avg", "econ_normalized",
            "social_claude", "social_gpt", "social_avg", "social_normalized",
            "econ_divergence", "social_divergence", "low_confidence",
            "anchor", "anchor_econ_target", "anchor_social_target",
        ])
        for bio, s in sorted(scores_out.items(), key=lambda x: inputs.get(x[0], {}).get("displayName", "")):
            inp = inputs.get(bio, {})
            is_anchor = bio in ANCHORS
            writer.writerow([
                bio,
                inp.get("displayName", ""),
                inp.get("party", ""),
                inp.get("state", ""),
                f"{s['econ_raw_claude']:+.3f}"   if s["econ_raw_claude"]   is not None else "",
                f"{s['econ_raw_gpt']:+.3f}"      if s["econ_raw_gpt"]      is not None else "",
                f"{(s['econ_raw_claude'] + s['econ_raw_gpt']) / 2:+.3f}"
                    if s["econ_raw_claude"] is not None and s["econ_raw_gpt"] is not None else "",
                f"{s['econ_normalized']:+.3f}",
                f"{s['social_raw_claude']:+.3f}" if s["social_raw_claude"] is not None else "",
                f"{s['social_raw_gpt']:+.3f}"    if s["social_raw_gpt"]    is not None else "",
                f"{(s['social_raw_claude'] + s['social_raw_gpt']) / 2:+.3f}"
                    if s["social_raw_claude"] is not None and s["social_raw_gpt"] is not None else "",
                f"{s['social_normalized']:+.3f}",
                f"{s['econ_divergence']:.3f}"    if s["econ_divergence"]   is not None else "",
                f"{s['social_divergence']:.3f}"  if s["social_divergence"] is not None else "",
                "YES" if s["low_confidence"] else "",
                "ANCHOR" if is_anchor else "",
                f"{ANCHORS[bio]['econ']:+.2f}"   if is_anchor else "",
                f"{ANCHORS[bio]['social']:+.2f}" if is_anchor else "",
            ])
    print(f"Review CSV: {csv_path}")

    # Validation: correlation with NOMINATE dim1
    try:
        with open(os.path.join(DATA_DIR, "members-current.json")) as f:
            members = json.load(f)
        bio_to_dim1 = {m["bioguideId"]: m["dim1"]
                       for m in members if m.get("dim1") is not None}

        pairs = [(bio_to_dim1[bio], scores_out[bio]["econ_normalized"])
                 for bio in scores_out if bio in bio_to_dim1]

        if len(pairs) >= 3:
            n     = len(pairs)
            xs    = [p[0] for p in pairs]
            ys    = [p[1] for p in pairs]
            mx    = sum(xs) / n
            my    = sum(ys) / n
            num   = sum((x - mx) * (y - my) for x, y in pairs)
            denom = (sum((x - mx) ** 2 for x in xs) *
                     sum((y - my) ** 2 for y in ys)) ** 0.5
            r     = num / denom if denom > 0 else 0
            print(f"\nValidation: economic axis Pearson r vs NOMINATE dim1 = {r:.3f} (n={n})")
            if r < 0.75:
                print("  ⚠ WARNING: low correlation — review anchor coordinates and prompts")
    except Exception as e:
        print(f"\n(Validation skipped: {e})")


if __name__ == "__main__":
    main()
