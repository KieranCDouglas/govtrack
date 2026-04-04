#!/usr/bin/env python3
"""
calibrate_quiz.py

Computes empirically-calibrated category weights for the ideology quiz by:
1. Loading member compass coordinates (compassX, compassY) and policyFingerprint
2. Direction-correcting fingerprint categories so 1.0 always = conservative
3. Computing Pearson correlations between category scores and compass axes
4. Blending empirical weights (60%) with conceptual axis-separation weights (40%)
5. Validating against anchor members and party clusters
6. Writing data/quiz-calibration.json

Run after any major update to members-current.json.
"""

import json
import math
import os
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
MEMBERS_FILE = REPO_ROOT / "data" / "members-current.json"
OUTPUT_FILE = REPO_ROOT / "data" / "quiz-calibration.json"

# Categories that are encoded inversely in pct_conservative
# (Dem mean > Rep mean, so high pct_conservative = progressive)
INVERTED_CATEGORIES = {"healthcare", "environment", "guns", "social_rights", "military_defense"}

# Anchor members with known compass coordinates (from compute_llm_scores.py)
ANCHORS = {
    "S000033": {"name": "Bernie Sanders",    "econ": -0.90, "social": -0.80},
    "W000817": {"name": "Elizabeth Warren",  "econ": -0.82, "social": -0.75},
    "G000592": {"name": "Jared Golden",      "econ": -0.20, "social":  0.35},
    "F000479": {"name": "John Fetterman",    "econ": -0.35, "social":  0.05},
    "F000466": {"name": "Brian Fitzpatrick", "econ":  0.20, "social":  0.10},
    "P000603": {"name": "Rand Paul",         "econ":  0.65, "social":  0.10},
    "L000575": {"name": "James Lankford",    "econ":  0.60, "social":  0.72},
    "C001098": {"name": "Ted Cruz",          "econ":  0.88, "social":  0.88},
}

# Conceptual axis-separation weights (hand-specified)
# Encodes that fiscal/healthcare/environment/trade drive X more,
# and guns/social_rights/criminal_justice/immigration drive Y more
CONCEPTUAL_WEIGHTS = {
    "fiscal_tax":       {"wX": 0.25, "wY": 0.06},
    "healthcare":       {"wX": 0.18, "wY": 0.08},
    "immigration":      {"wX": 0.15, "wY": 0.18},
    "environment":      {"wX": 0.18, "wY": 0.15},
    "guns":             {"wX": 0.08, "wY": 0.22},
    "criminal_justice": {"wX": 0.06, "wY": 0.14},
    "social_rights":    {"wX": 0.04, "wY": 0.12},
    "military_defense": {"wX": 0.06, "wY": 0.05},
}
# trade is excluded from empirical computation (fixed weight applied later)

BLEND_ALPHA = 0.40  # fraction of conceptual weight in final blend


def pearson(xs, ys):
    n = len(xs)
    if n < 2:
        return 0.0
    mx, my = sum(xs) / n, sum(ys) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    dx = math.sqrt(sum((x - mx) ** 2 for x in xs))
    dy = math.sqrt(sum((y - my) ** 2 for y in ys))
    if dx == 0 or dy == 0:
        return 0.0
    return num / (dx * dy)


def r_squared(actual, predicted):
    mean_a = sum(actual) / len(actual)
    ss_tot = sum((a - mean_a) ** 2 for a in actual)
    ss_res = sum((a - p) ** 2 for a, p in zip(actual, predicted))
    if ss_tot == 0:
        return 1.0
    return 1.0 - ss_res / ss_tot


def normalize_weights(weights_dict):
    """Normalize a dict of weights so they sum to 1.0."""
    total = sum(weights_dict.values())
    if total == 0:
        return weights_dict
    return {k: v / total for k, v in weights_dict.items()}


def main():
    print(f"Loading members from {MEMBERS_FILE}...")
    with open(MEMBERS_FILE) as f:
        members = json.load(f)

    print(f"  Loaded {len(members)} members")

    # ── 1. Extract oriented category scores and compass coordinates ──────────
    categories = list(CONCEPTUAL_WEIGHTS.keys())
    rows = []  # (bioguideId, party, compassX, compassY, {cat: oriented_score})

    for m in members:
        cx = m.get("compassX")
        cy = m.get("compassY")
        fp = m.get("policyFingerprint") or {}

        if cx is None or cy is None or not fp:
            continue

        cat_scores = {}
        for cat in categories:
            entry = fp.get(cat)
            if not entry or entry.get("total", 0) == 0:
                continue
            raw = entry["pct_conservative"]
            # Direction-correct: for inverted categories, flip so 1.0 = conservative
            oriented = (1.0 - raw) if cat in INVERTED_CATEGORIES else raw
            cat_scores[cat] = oriented

        # Include members with at least 7/8 categories; fill missing with 0.5 (neutral)
        if len(cat_scores) >= len(categories) - 1:
            for cat in categories:
                if cat not in cat_scores:
                    cat_scores[cat] = 0.5  # neutral fill
            rows.append({
                "bioguideId": m["bioguideId"],
                "party": m.get("party", ""),
                "compassX": cx,
                "compassY": cy,
                "scores": cat_scores,
            })

    print(f"  Members with complete fingerprints: {len(rows)}")

    # ── 2. Compute Pearson correlations ────────────────────────────────────
    print("\nEmpirical correlations with compass axes:")
    empirical_wX = {}
    empirical_wY = {}

    for cat in categories:
        cat_vals = [r["scores"][cat] for r in rows]
        cx_vals  = [r["compassX"] for r in rows]
        cy_vals  = [r["compassY"] for r in rows]

        corr_x = pearson(cat_vals, cx_vals)
        corr_y = pearson(cat_vals, cy_vals)
        empirical_wX[cat] = abs(corr_x)
        empirical_wY[cat] = abs(corr_y)
        print(f"  {cat:20s}  corr_X={corr_x:+.4f}  corr_Y={corr_y:+.4f}")

    # Normalize empirical weights
    empirical_wX = normalize_weights(empirical_wX)
    empirical_wY = normalize_weights(empirical_wY)

    # ── 3. Blend empirical + conceptual ───────────────────────────────────
    print(f"\nBlending: {1-BLEND_ALPHA:.0%} empirical + {BLEND_ALPHA:.0%} conceptual")

    conc_wX_raw = {cat: CONCEPTUAL_WEIGHTS[cat]["wX"] for cat in categories}
    conc_wY_raw = {cat: CONCEPTUAL_WEIGHTS[cat]["wY"] for cat in categories}
    conc_wX = normalize_weights(conc_wX_raw)
    conc_wY = normalize_weights(conc_wY_raw)

    blended_wX = {}
    blended_wY = {}
    for cat in categories:
        blended_wX[cat] = (1 - BLEND_ALPHA) * empirical_wX[cat] + BLEND_ALPHA * conc_wX[cat]
        blended_wY[cat] = (1 - BLEND_ALPHA) * empirical_wY[cat] + BLEND_ALPHA * conc_wY[cat]

    # Normalize blended weights
    blended_wX = normalize_weights(blended_wX)
    blended_wY = normalize_weights(blended_wY)

    print("\nFinal blended weights:")
    print(f"  {'Category':20s}  {'wX':>8}  {'wY':>8}")
    for cat in categories:
        print(f"  {cat:20s}  {blended_wX[cat]:8.4f}  {blended_wY[cat]:8.4f}")

    # ── 4. Compute predicted coordinates for all members ──────────────────
    def predict(scores):
        x = sum(blended_wX[cat] * (scores[cat] * 2 - 1) for cat in categories)
        y = sum(blended_wY[cat] * (scores[cat] * 2 - 1) for cat in categories)
        return max(-1.0, min(1.0, x)), max(-1.0, min(1.0, y))

    pred_x = []
    pred_y = []
    act_x  = []
    act_y  = []
    for r in rows:
        px, py = predict(r["scores"])
        pred_x.append(px)
        pred_y.append(py)
        act_x.append(r["compassX"])
        act_y.append(r["compassY"])

    r2_x = r_squared(act_x, pred_x)
    r2_y = r_squared(act_y, pred_y)
    print(f"\nValidation: R²_X={r2_x:.4f}  R²_Y={r2_y:.4f}")

    # ── 5. Anchor member validation ────────────────────────────────────────
    member_by_id = {m["bioguideId"]: m for m in members}
    print("\nAnchor member predicted vs. actual:")
    anchor_results = {}
    for bid, info in ANCHORS.items():
        m = member_by_id.get(bid)
        if not m:
            print(f"  {info['name']:25s}  NOT FOUND in members-current.json")
            continue
        fp = m.get("policyFingerprint") or {}
        scores = {}
        for cat in categories:
            entry = fp.get(cat)
            if entry and entry.get("total", 0) > 0:
                raw = entry["pct_conservative"]
                scores[cat] = (1.0 - raw) if cat in INVERTED_CATEGORIES else raw
        if len(scores) < len(categories) - 1:
            print(f"  {info['name']:25s}  INCOMPLETE fingerprint ({len(scores)}/{len(categories)} cats)")
            continue
        # Fill any single missing category with neutral
        for cat in categories:
            if cat not in scores:
                scores[cat] = 0.5
        px, py = predict(scores)
        ax = m.get("compassX", info["econ"])
        ay = m.get("compassY", info["social"])
        err_x = abs(px - ax)
        err_y = abs(py - ay)
        print(f"  {info['name']:25s}  actual=({ax:+.3f},{ay:+.3f})  pred=({px:+.3f},{py:+.3f})  err=({err_x:.3f},{err_y:.3f})")
        anchor_results[bid] = {
            "name": info["name"],
            "actual": [ax, ay],
            "predicted": [round(px, 4), round(py, 4)],
            "error": [round(err_x, 4), round(err_y, 4)],
        }

    # ── 6. Party cluster centroids ─────────────────────────────────────────
    dem_px = [pred_x[i] for i, r in enumerate(rows) if r["party"] == "Democrat"]
    dem_py = [pred_y[i] for i, r in enumerate(rows) if r["party"] == "Democrat"]
    rep_px = [pred_x[i] for i, r in enumerate(rows) if r["party"] == "Republican"]
    rep_py = [pred_y[i] for i, r in enumerate(rows) if r["party"] == "Republican"]

    dem_cx = sum(dem_px) / len(dem_px) if dem_px else 0
    dem_cy = sum(dem_py) / len(dem_py) if dem_py else 0
    rep_cx = sum(rep_px) / len(rep_px) if rep_px else 0
    rep_cy = sum(rep_py) / len(rep_py) if rep_py else 0

    print(f"\nParty cluster centroids (predicted):")
    print(f"  Democrats   ({len(dem_px)} members): X={dem_cx:+.3f}  Y={dem_cy:+.3f}")
    print(f"  Republicans ({len(rep_px)} members): X={rep_cx:+.3f}  Y={rep_cy:+.3f}")

    # ── 7. Write output ────────────────────────────────────────────────────
    output = {
        "generated": "2026-04-04",
        "method": f"pearson-correlation + conceptual blend (alpha={BLEND_ALPHA})",
        "n_members": len(rows),
        "r2_x": round(r2_x, 4),
        "r2_y": round(r2_y, 4),
        "party_clusters": {
            "democrat":   {"n": len(dem_px), "mean_x": round(dem_cx, 4), "mean_y": round(dem_cy, 4)},
            "republican": {"n": len(rep_px), "mean_x": round(rep_cx, 4), "mean_y": round(rep_cy, 4)},
        },
        "categories": {
            cat: {
                "wX": round(blended_wX[cat], 4),
                "wY": round(blended_wY[cat], 4),
                "flipDirection": cat in INVERTED_CATEGORIES,
            }
            for cat in categories
        },
        "anchors": anchor_results,
        "note": "trade category uses fixed conceptual weight wX=0.080 wY=0.020 (not in this calibration)"
    }

    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nWrote {OUTPUT_FILE}")
    print("\nDone.")


if __name__ == "__main__":
    main()
