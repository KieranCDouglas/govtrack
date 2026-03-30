#!/usr/bin/env python3
"""
Aggregate OpenSecrets PAC donation data into top industries per member.

Reads:
  data/opensecrets/pacs22.txt       — PAC to candidate donations (2022 cycle)
  data/opensecrets/CRP_Categories.txt — industry code → sector name
  data/opensecrets/CRP IDs.xls      — OpenSecrets CID → member name (for name matching)
  data/members-current.json         — for bioguide ID lookup

Writes:
  data/donor-industries.json        — bioguide → top industries with amounts

Usage:
  python3 scripts/parse_opensecrets.py
"""
import csv
import json
import os
import re
from collections import defaultdict
from difflib import get_close_matches

SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR    = os.path.dirname(SCRIPT_DIR)
DATA_DIR    = os.path.join(ROOT_DIR, "data")
OS_DIR      = os.path.join(DATA_DIR, "opensecrets")

PACS_PATH   = os.path.join(OS_DIR, "pacs22.txt")
CATS_PATH   = os.path.join(OS_DIR, "CRP_Categories.txt")
IDS_PATH    = os.path.join(OS_DIR, "CRP IDs.xls")
OUTPUT_PATH = os.path.join(DATA_DIR, "donor-industries.json")
CURRENT_PATH = os.path.join(DATA_DIR, "members-current.json")

TOP_N = 7   # top industries to keep per member


# ── Load industry code → sector name ─────────────────────────────────────────

def load_categories():
    """Returns catcode -> {industry, sector} dict."""
    cats = {}
    with open(CATS_PATH, encoding="utf-8", errors="replace") as f:
        reader = csv.reader(f, delimiter="\t")
        header_found = False
        for row in reader:
            if not row:
                continue
            if not header_found:
                if row[0].strip() == "Catcode":
                    header_found = True
                continue
            if len(row) < 5:
                continue
            catcode  = row[0].strip()
            industry = row[3].strip()
            sector   = row[4].strip()
            if catcode:
                cats[catcode] = {"industry": industry, "sector": sector}
    print(f"Loaded {len(cats)} industry codes")
    return cats


# ── Load CID → name from CRP IDs.xls ─────────────────────────────────────────

def load_cid_names():
    """Returns CID -> name dict from Members 118th and 117th sheets."""
    import xlrd
    wb = xlrd.open_workbook(IDS_PATH)
    cid_to_name = {}
    for sheet_name in ["Members 118th", "Members 117th", "Members 119th"]:
        if sheet_name not in wb.sheet_names():
            continue
        ws = wb.sheet_by_name(sheet_name)
        header_row = None
        for i in range(ws.nrows):
            row = ws.row_values(i)
            if "CID" in row:
                header_row = i
                break
        if header_row is None:
            continue
        headers = ws.row_values(header_row)
        cid_idx  = headers.index("CID")
        name_idx = headers.index("CRPName")
        for i in range(header_row + 1, ws.nrows):
            row = ws.row_values(i)
            cid  = str(row[cid_idx]).strip()  if cid_idx  < len(row) else ""
            name = str(row[name_idx]).strip() if name_idx < len(row) else ""
            if cid and name and cid.startswith("N"):
                cid_to_name[cid] = name
    print(f"Loaded {len(cid_to_name)} CID→name mappings")
    return cid_to_name


# ── Name matching: CRP name → bioguide ───────────────────────────────────────

def normalize_name(name):
    name = name.lower()
    name = re.sub(r"['\-\.\,]", "", name)
    name = re.sub(r"\s+", " ", name).strip()
    name = re.sub(r"\b(jr|sr|ii|iii|iv)\b", "", name).strip()
    return name


def build_bio_name_index(members):
    """Returns normalized 'last first' -> bioguide and 'last' -> [bioguide]."""
    full_idx = {}
    last_idx = defaultdict(list)
    for m in members:
        bio   = m["bioguideId"]
        parts = m.get("displayName", "").strip().split()
        if len(parts) < 2:
            continue
        first = parts[0]
        last  = parts[-1]
        if last.lower() in ("jr", "sr", "ii", "iii", "iv") and len(parts) > 2:
            last = parts[-2]
        key = normalize_name(f"{last} {first}")
        full_idx[key] = bio
        last_idx[normalize_name(last)].append(bio)
    return full_idx, last_idx


def crp_name_to_bio(crp_name, full_idx, last_idx):
    """
    CRP names are 'Last, First' format.
    Returns bioguide ID or None.
    """
    crp_name = crp_name.strip()
    if "," in crp_name:
        parts = [p.strip() for p in crp_name.split(",", 1)]
        last  = parts[0]
        first = parts[1].split()[0] if parts[1] else ""
    else:
        words = crp_name.split()
        last  = words[0] if words else ""
        first = words[1] if len(words) > 1 else ""

    key = normalize_name(f"{last} {first}")
    if key in full_idx:
        return full_idx[key]

    # Fuzzy match
    matches = get_close_matches(key, list(full_idx.keys()), n=1, cutoff=0.82)
    if matches:
        return full_idx[matches[0]]

    return None


# ── Aggregate PAC donations by CID → industry ────────────────────────────────

def aggregate_pac_industries(cats):
    """
    Parse pacs22.txt and aggregate total PAC donations per (CID, industry).
    pacs22.txt columns (pipe-delimited):
      cycle, FECRecNo, PACID, CID, Amount, Date, RealCode, Type, DI, FECCandID
    """
    cid_industry_totals = defaultdict(lambda: defaultdict(int))
    skipped = 0
    total   = 0

    with open(PACS_PATH, encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            # Format: |2022|,|FECRecNo|,|PACID|,|CID|,Amount,Date,|RealCode|,...
            parts = line.split(",")
            if len(parts) < 7:
                continue

            def strip_pipes(s):
                return s.strip().strip("|").strip()

            cid      = strip_pipes(parts[3])
            try:
                amount = int(float(parts[4].strip()))
            except ValueError:
                skipped += 1
                continue
            realcode = strip_pipes(parts[6])

            if not cid.startswith("N") or not realcode:
                continue

            # Map realcode to industry
            cat = cats.get(realcode)
            if not cat:
                # Try first 5 chars (some codes have subcategory suffix)
                cat = cats.get(realcode[:5])
            if not cat:
                skipped += 1
                continue

            industry = cat["industry"]
            if amount > 0:  # only count positive donations
                cid_industry_totals[cid][industry] += amount
            total += 1

    print(f"Processed {total} PAC donations, skipped {skipped}")
    return cid_industry_totals


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    # Load reference data
    cats         = load_categories()
    cid_to_name  = load_cid_names()

    # Load current members for bioguide matching
    with open(CURRENT_PATH) as f:
        members = json.load(f)
    full_idx, last_idx = build_bio_name_index(members)
    print(f"Loaded {len(members)} current members")

    # Aggregate PAC donations
    print("Aggregating PAC donations (758K rows, may take ~30s)…")
    cid_totals = aggregate_pac_industries(cats)
    print(f"Found donation data for {len(cid_totals)} candidates")

    # Match CIDs to bioguide IDs
    donor_data  = {}
    matched     = 0
    unmatched   = []

    for cid, industry_totals in cid_totals.items():
        crp_name = cid_to_name.get(cid, "")
        if not crp_name:
            continue

        bio = crp_name_to_bio(crp_name, full_idx, last_idx)
        if not bio:
            unmatched.append(crp_name)
            continue

        # Sort by amount descending, keep top N
        top = sorted(industry_totals.items(), key=lambda x: x[1], reverse=True)[:TOP_N]
        donor_data[bio] = [
            {"industry": ind, "amount": amt}
            for ind, amt in top
            if amt > 0
        ]
        matched += 1

    print(f"Matched: {matched} current members with donor data")
    print(f"Unmatched CIDs: {len(unmatched)}")

    with open(OUTPUT_PATH, "w") as f:
        json.dump({
            "meta": {"cycle": 2022, "source": "OpenSecrets", "top_n": TOP_N},
            "donors": donor_data,
        }, f, indent=2)

    print(f"Written: {OUTPUT_PATH}")

    # Show sample
    sample_bio = next(iter(donor_data))
    sample_name = next(m["displayName"] for m in members if m["bioguideId"] == sample_bio)
    print(f"\nSample — {sample_name} ({sample_bio}):")
    for d in donor_data[sample_bio]:
        print(f"  ${d['amount']:>10,}  {d['industry']}")


if __name__ == "__main__":
    main()
