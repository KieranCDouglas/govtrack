#!/usr/bin/env python3
"""Final verification of the pipeline output."""
import json

with open("data/interest-group-scores.json") as f:
    ig = json.load(f)
print(f"Interest group sources: {ig['meta']['sources']}")
print(f"Member counts: {ig['meta']['member_counts']}")

with open("data/social-scores.json") as f:
    ss = json.load(f)
total = len(ss["scores"])
fallback = sum(1 for s in ss["scores"].values() if s["fallback"])
print(f"Social scores: {total} total, {fallback} fallback")

with open("data/members-current.json") as f:
    mc = json.load(f)
has_compass = sum(1 for m in mc if m.get("compassY") is not None and m.get("compassX") is not None)
print(f"Members current: {len(mc)} total, {has_compass} with compass coords")

names_to_check = ["Boebert", "Golden", "Pelosi", "Fitzpatrick", "Biggs", "Ocasio", "Jordan", "Bacon", "Kaptur"]
print("\nSpot checks:")
for name in names_to_check:
    for m in mc:
        if name.lower() in m.get("displayName", "").lower():
            print(f"  {m['displayName']:30s} X={m.get('compassX','?'):>7}  Y={m.get('compassY','?'):>7}")
            break
