#!/usr/bin/env python3
"""
Parse interest-group scorecard CSVs and merge into data/interest-group-scores.json.

Supported files (drop in data/scorecards/):
  lcv_house.csv    — League of Conservation Voters, House
  lcv_senate.csv   — League of Conservation Voters, Senate
  pp_house.csv     — Planned Parenthood Action, House
  pp_senate.csv    — Planned Parenthood Action, Senate

Maps member names → bioguide IDs via data/members-current.json.
Unmatched members are reported at the end.

Usage:
  python3 scripts/parse_scorecards.py
"""
import csv
import json
import os
import re
import sys
from difflib import get_close_matches

SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR     = os.path.dirname(SCRIPT_DIR)
DATA_DIR     = os.path.join(ROOT_DIR, "data")
SCORECARDS   = os.path.join(DATA_DIR, "scorecards")
IG_PATH      = os.path.join(DATA_DIR, "interest-group-scores.json")
CURRENT_PATH = os.path.join(DATA_DIR, "members-current.json")

# ── Org metadata ──────────────────────────────────────────────────────────────

ORGS = {
    "lcv": {
        "name":     "League of Conservation Voters",
        "focus":    "Environment",
        "polarity": "progressive_high",  # high score = progressive/pro-environment
    },
    "pp": {
        "name":     "Planned Parenthood Action",
        "focus":    "Reproductive Rights",
        "polarity": "progressive_high",  # high score = pro-choice
    },
}

# ── Hard overrides: scorecard name → bioguide ID ─────────────────────────────
# For members whose scorecard name can't be resolved via nickname expansion alone.

NAME_OVERRIDES = {
    "morgan griffith":  "G000568",  # H. Morgan Griffith
    "greg steube":      "S001214",  # W. Gregory Steube
    "andy barr":        "B001282",  # Harold Rogers Barr goes by Andy
    "garland barr":     "B001282",  # LCV uses his formal first name Garland
    "chuy garcia":      "G000586",  # Jesús "Chuy" García
    "gt thompson":      "T000467",  # Glenn "GT" Thompson
    "jeff van drew":    "V000133",  # Jefferson Van Drew
    "william ogles":    "O000175",  # Andy Ogles (formal: Andrew Ogles)
    "paco vargas":      "V000130",  # Juan Vargas goes by Paco
}

# ── Nickname → formal name map ────────────────────────────────────────────────
# Scorecard files often use nicknames; members-current.json uses formal names.

NICKNAMES = {
    "chris":      "christopher",
    "dick":       "richard",
    "rick":       "richard",
    "chuck":      "charles",
    "charlie":    "charles",
    "jim":        "james",
    "jimmy":      "james",
    "jack":       "john",
    "jake":       "jacob",
    "mike":       "michael",
    "mick":       "michael",
    "nick":       "nicholas",
    "nic":        "nicholas",
    "bill":       "william",
    "will":       "william",
    "willie":     "william",
    "liz":        "elizabeth",
    "beth":       "elizabeth",
    "betty":      "elizabeth",
    "maggie":     "margaret",
    "meg":        "margaret",
    "peggy":      "margaret",
    "ed":         "edward",
    "ted":        "edward",
    "tom":        "thomas",
    "tommy":      "thomas",
    "tim":        "timothy",
    "timmothy":   "timothy",
    "bob":        "robert",
    "rob":        "robert",
    "bobby":      "robert",
    "dan":        "daniel",
    "danny":      "daniel",
    "dave":       "david",
    "pat":        "patrick",
    "joe":        "joseph",
    "joey":       "joseph",
    "ben":        "benjamin",
    "andy":       "andrew",
    "drew":       "andrew",
    "tony":       "anthony",
    "sam":        "samuel",
    "fred":       "frederick",
    "greg":       "gregory",
    "lou":        "louis",
    "louie":      "louis",
    "al":         "albert",
    "alex":       "alexander",
    "steve":      "steven",
    "stephen":    "steven",
    "mark":       "marcus",
    "matt":       "matthew",
    "don":        "donald",
    "ron":        "ronald",
    "jerry":      "gerald",
    "gary":       "garland",
    "gene":       "eugene",
    "ray":        "raymond",
    "jay":        "john",
    "sue":        "susan",
    "susie":      "susan",
    "barb":       "barbara",
    "katie":      "katherine",
    "kate":       "katherine",
    "kathy":      "kathleen",
    "kay":        "kathleen",
    "debbie":     "deborah",
    "deb":        "deborah",
    "jan":        "janice",
    "jan":        "janet",
    "nan":        "nancy",
    "connie":     "constance",
    "ginny":      "virginia",
    "lisa":       "elizabeth",
    "lizzie":     "elizabeth",
    # Congress-specific nicknames
    "ted":        "theodore",
    "chip":       "charles",
    "val":        "valerie",
    "gt":         "glenn",
    "chuy":       "jesus",
    "abe":        "abraham",
    "captain":    "clay",
    "jen":        "jennifer",
    "jeff":       "jefferson",
    "lou":        "jose",
    "garland":    "harold",   # Andy Barr's formal first name
}

# ── Name normalization ────────────────────────────────────────────────────────

def normalize_name(name: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace."""
    name = name.lower()
    name = re.sub(r"['\-\.]", "", name)
    name = re.sub(r"\s+", " ", name).strip()
    # Drop common suffixes
    name = re.sub(r"\b(jr|sr|ii|iii|iv)\b", "", name).strip()
    return name


def build_name_index(members: list) -> dict:
    """
    Returns two dicts:
      full_name_index: normalized "first last" → bioguide
      last_name_index: normalized "last" → [bioguide, ...]  (for fallback)
    """
    full_idx = {}
    last_idx = {}
    for m in members:
        bio  = m["bioguideId"]
        name = m.get("displayName", "")
        parts = name.strip().split()
        if not parts:
            continue
        # displayName is "First [Middle] Last [Suffix]"
        first = parts[0]
        last  = parts[-1]
        # Also try without suffix
        if last.lower() in ("jr", "sr", "ii", "iii", "iv") and len(parts) > 2:
            last = parts[-2]

        full_key = normalize_name(f"{first} {last}")
        full_idx[full_key] = bio

        last_key = normalize_name(last)
        last_idx.setdefault(last_key, []).append(bio)

    return full_idx, last_idx


def expand_nickname(first: str) -> list:
    """Return list of first-name variants to try (nickname + formal)."""
    first = first.lower()
    variants = [first]
    if first in NICKNAMES:
        variants.append(NICKNAMES[first])
    # Also check reverse: if this IS a formal name, add its nicknames
    for nick, formal in NICKNAMES.items():
        if formal == first and nick not in variants:
            variants.append(nick)
    return variants


def match_name(raw_name: str, full_idx: dict, last_idx: dict, members_by_bio: dict) -> str | None:
    """Try to find a bioguide ID for a raw name string."""
    raw_name = raw_name.strip()

    # Check hard overrides first
    override_key = normalize_name(raw_name)
    if override_key in NAME_OVERRIDES:
        return NAME_OVERRIDES[override_key]

    # Parse into first / last
    if "," in raw_name:
        parts = [p.strip() for p in raw_name.split(",", 1)]
        first, last = parts[1].split()[0], parts[0]
    else:
        parts = raw_name.split()
        if len(parts) < 2:
            return None
        first, last = parts[0], parts[-1]

    # Build candidate keys with nickname expansion
    candidates = []
    for f in expand_nickname(first):
        candidates.append(normalize_name(f"{f} {last}"))

    for c in candidates:
        if c in full_idx:
            return full_idx[c]

    # Fuzzy fallback
    all_keys = list(full_idx.keys())
    for c in candidates:
        matches = get_close_matches(c, all_keys, n=1, cutoff=0.82)
        if matches:
            return full_idx[matches[0]]

    return None


# ── CSV parsers ───────────────────────────────────────────────────────────────

def parse_lcv(filepath: str) -> dict:
    """
    LCV CSV format:
      Header row: Senate / House (skip)
      Column row: First Name, Last Name, Party, District, Year Score, Lifetime Score, URL
      State rows: single value (skip)
      Data rows:  Katie, Britt, R, , 0, 2, https://...
    Returns: {(first, last): year_score}
    """
    scores = {}
    with open(filepath, newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        header_found = False
        for row in reader:
            if not row:
                continue
            # Header row detection
            if not header_found:
                joined = ",".join(row).lower()
                if "first name" in joined or "last name" in joined:
                    header_found = True
                continue
            # Skip state label rows (single non-empty cell)
            non_empty = [c for c in row if c.strip()]
            if len(non_empty) <= 1:
                continue
            # Data row: First Name, Last Name, Party, District, Year Score, ...
            if len(row) < 5:
                continue
            first = row[0].strip()
            last  = row[1].strip()
            try:
                score = int(row[4].strip())
            except (ValueError, IndexError):
                continue
            if first and last:
                scores[(first, last)] = score
    return scores


def parse_pp(filepath: str) -> dict:
    """
    PP CSV format:
      Row 1: "Name, Score, ..." (header — skip)
      Data:  "Angela Alsobrooks, 100, ..."
    Returns: {full_name_string: score}
    """
    scores = {}
    with open(filepath, newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        header_skipped = False
        for row in reader:
            if not row:
                continue
            if not header_skipped:
                header_skipped = True
                continue
            name = row[0].strip()
            if not name:
                continue
            try:
                score = int(row[1].strip())
            except (ValueError, IndexError):
                continue
            scores[name] = score
    return scores


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    # Load current members
    with open(CURRENT_PATH) as f:
        members = json.load(f)
    members_by_bio = {m["bioguideId"]: m for m in members}
    full_idx, last_idx = build_name_index(members)
    print(f"Loaded {len(members)} current members for name matching")

    # Load existing interest-group-scores.json
    if os.path.exists(IG_PATH):
        with open(IG_PATH) as f:
            ig_data = json.load(f)
    else:
        ig_data = {"meta": {"congress": 119, "sources": [], "member_counts": {}}, "organizations": {}}

    unmatched_all = []

    # ── LCV ───────────────────────────────────────────────────────────────────
    for chamber in ("house", "senate"):
        fname = os.path.join(SCORECARDS, f"lcv_{chamber}.csv")
        if not os.path.exists(fname):
            print(f"  Skipping {fname} (not found)")
            continue

        raw = parse_lcv(fname)
        print(f"\nLCV {chamber}: {len(raw)} rows parsed")

        org_key = "lcv"
        if org_key not in ig_data["organizations"]:
            ig_data["organizations"][org_key] = {**ORGS[org_key], "scores": {}}

        matched = 0
        unmatched = []
        for (first, last), score in raw.items():
            full = f"{first} {last}"
            bio = match_name(full, full_idx, last_idx, members_by_bio)
            if bio:
                ig_data["organizations"][org_key]["scores"][bio] = score
                matched += 1
            else:
                unmatched.append(full)

        print(f"  Matched: {matched} / {len(raw)}")
        if unmatched:
            print(f"  Unmatched ({len(unmatched)}): {unmatched[:10]}{'...' if len(unmatched)>10 else ''}")
            unmatched_all.extend([f"LCV/{chamber}: {n}" for n in unmatched])

    # ── Planned Parenthood ────────────────────────────────────────────────────
    for chamber in ("house", "senate"):
        fname = os.path.join(SCORECARDS, f"pp_{chamber}.csv")
        if not os.path.exists(fname):
            print(f"  Skipping {fname} (not found)")
            continue

        raw = parse_pp(fname)
        print(f"\nPP {chamber}: {len(raw)} rows parsed")

        org_key = "pp"
        if org_key not in ig_data["organizations"]:
            ig_data["organizations"][org_key] = {**ORGS[org_key], "scores": {}}

        matched = 0
        unmatched = []
        for name, score in raw.items():
            bio = match_name(name, full_idx, last_idx, members_by_bio)
            if bio:
                ig_data["organizations"][org_key]["scores"][bio] = score
                matched += 1
            else:
                unmatched.append(name)

        print(f"  Matched: {matched} / {len(raw)}")
        if unmatched:
            print(f"  Unmatched ({len(unmatched)}): {unmatched[:10]}{'...' if len(unmatched)>10 else ''}")
            unmatched_all.extend([f"PP/{chamber}: {n}" for n in unmatched])

    # ── Update meta ───────────────────────────────────────────────────────────
    for org_key in ("lcv", "pp"):
        if org_key in ig_data["organizations"]:
            count = len(ig_data["organizations"][org_key]["scores"])
            ig_data["meta"]["member_counts"][org_key] = count
            if org_key not in ig_data["meta"]["sources"]:
                ig_data["meta"]["sources"].append(org_key)

    # ── Write output ──────────────────────────────────────────────────────────
    with open(IG_PATH, "w") as f:
        json.dump(ig_data, f, indent=2)

    print(f"\nWritten: {IG_PATH}")
    for org_key in ("lcv", "pp"):
        if org_key in ig_data["organizations"]:
            print(f"  {org_key}: {ig_data['meta']['member_counts'].get(org_key, 0)} members scored")

    if unmatched_all:
        print(f"\nTotal unmatched: {len(unmatched_all)}")


if __name__ == "__main__":
    main()
