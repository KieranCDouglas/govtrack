#!/usr/bin/env python3
"""
Compare ideology scores across multiple model runs.

Reads:
  data/llm-scores-review-{label}.csv  for each run label
  data/llm-scores-review.csv          as the baseline (sonnet+gpt4o)

Writes:
  data/model-comparison.csv  — side-by-side econ/social for each run,
                               plus delta vs baseline and agreement flag

Usage:
  python3 scripts/compare_model_runs.py
"""
import csv
import json
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR   = os.path.dirname(SCRIPT_DIR)
DATA_DIR   = os.path.join(ROOT_DIR, "data")
OUTPUT     = os.path.join(DATA_DIR, "model-comparison.csv")

# Runs to compare: (label, json filename, description)
RUNS = [
    ("sonnet_gpt4o",    "llm-scores.json",              "Sonnet 4.6 + GPT-4o (baseline)"),
    ("sonnet_only",     "llm-scores-sonnet-only.json",   "Sonnet 4.6 only"),
    ("haiku_gpt4omini", "llm-scores-haiku-gpt4omini.json","Haiku 4.5 + GPT-4o mini"),
]


def load_run(json_path):
    """Returns dict: bioguide -> {econ, social, lc}"""
    if not os.path.exists(json_path):
        return {}
    with open(json_path) as f:
        data = json.load(f)
    result = {}
    for bio, s in data.get("scores", {}).items():
        try:
            result[bio] = {
                "econ":   float(s["econ_normalized"]),
                "social": float(s["social_normalized"]),
                "lc":     s.get("low_confidence", False),
            }
        except (KeyError, TypeError, ValueError):
            pass
    return result


def main():
    # Load all runs
    runs = []
    for label, fname, desc in RUNS:
        data = load_run(os.path.join(DATA_DIR, fname))
        runs.append((label, desc, data))
        print(f"{desc}: {len(data)} members loaded")

    if not runs[0][2]:
        print("ERROR: baseline run not found")
        return

    # Get all bioguides present in baseline
    baseline_data = runs[0][2]
    all_bios = sorted(baseline_data.keys())

    # Load names
    with open(os.path.join(DATA_DIR, "members-current.json")) as f:
        members = json.load(f)
    bio_to_info = {m["bioguideId"]: (m["displayName"], m["party"][:3], m["state"])
                   for m in members}

    # Write comparison CSV
    with open(OUTPUT, "w", newline="") as f:
        writer = csv.writer(f)

        # Header
        header = ["bioguide", "name", "party", "state"]
        for label, desc, _ in runs:
            header += [f"econ_{label}", f"social_{label}"]
        for label, desc, _ in runs[1:]:  # deltas vs baseline
            header += [f"econ_delta_{label}", f"social_delta_{label}"]
        header += ["max_econ_delta", "max_social_delta", "high_disagreement"]
        writer.writerow(header)

        for bio in all_bios:
            name, party, state = bio_to_info.get(bio, (bio, "?", "?"))
            row = [bio, name, party, state]

            scores = []
            for label, desc, data in runs:
                s = data.get(bio)
                if s:
                    row += [f"{s['econ']:+.3f}", f"{s['social']:+.3f}"]
                    scores.append(s)
                else:
                    row += ["", ""]
                    scores.append(None)

            # Deltas vs baseline
            base = scores[0]
            econ_deltas   = []
            social_deltas = []
            for s in scores[1:]:
                if s and base:
                    ed = s["econ"]   - base["econ"]
                    sd = s["social"] - base["social"]
                    row += [f"{ed:+.3f}", f"{sd:+.3f}"]
                    econ_deltas.append(abs(ed))
                    social_deltas.append(abs(sd))
                else:
                    row += ["", ""]

            max_ed = max(econ_deltas)   if econ_deltas   else 0
            max_sd = max(social_deltas) if social_deltas else 0
            row += [f"{max_ed:.3f}", f"{max_sd:.3f}"]
            row += ["YES" if max_ed > 0.15 or max_sd > 0.15 else ""]

            writer.writerow(row)

    print(f"\nComparison written: {OUTPUT}")
    print(f"Rows: {len(all_bios)}")


if __name__ == "__main__":
    main()
