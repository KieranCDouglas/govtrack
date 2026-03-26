#!/usr/bin/env python3
"""Quick spot-check of social scores."""
import json, statistics, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

with open(os.path.join(ROOT, "data/social-scores.json")) as f:
    data = json.load(f)
with open(os.path.join(ROOT, "data/members-index.json")) as f:
    idx = json.load(f)

imap = {str(m["i"]): (m["n"], m["p"], m["c"]) for m in idx if m.get("i")}

scores = data["scores"]
items = sorted(scores.items(), key=lambda x: x[1]["score"])

vals = [v["score"] for _, v in items]
print(f"Total scored: {len(items)}")
print(f"Fallback: {sum(1 for _,v in items if v['fallback'])}")
print(f"Mean: {statistics.mean(vals):.4f}, Median: {statistics.median(vals):.4f}")
print(f"Std: {statistics.stdev(vals):.4f}")
print(f"Min: {min(vals):.4f}, Max: {max(vals):.4f}")

print("\n--- Most progressive (top 10) ---")
for icpsr, s in items[:10]:
    name, party, ch = imap.get(icpsr, ("?", "?", "?"))
    print(f"  {name} ({party}-{ch}): {s['score']:+.4f} ({s['socialVotes']} votes)")

print("\n--- Most conservative (top 10) ---")
for icpsr, s in items[-10:]:
    name, party, ch = imap.get(icpsr, ("?", "?", "?"))
    print(f"  {name} ({party}-{ch}): {s['score']:+.4f} ({s['socialVotes']} votes)")

print("\n--- Moderates (near 0) ---")
mid = sorted(items, key=lambda x: abs(x[1]["score"]))
for icpsr, s in mid[:10]:
    name, party, ch = imap.get(icpsr, ("?", "?", "?"))
    print(f"  {name} ({party}-{ch}): {s['score']:+.4f} ({s['socialVotes']} votes)")

# Party breakdown
d_scores = [v["score"] for k, v in items if imap.get(k, ("","",""))[1] == "D"]
r_scores = [v["score"] for k, v in items if imap.get(k, ("","",""))[1] == "R"]
print(f"\nDem mean: {statistics.mean(d_scores):.4f} (n={len(d_scores)})")
print(f"Rep mean: {statistics.mean(r_scores):.4f} (n={len(r_scores)})")
