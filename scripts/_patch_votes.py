#!/usr/bin/env python3
"""Patch the bundle for vote overhaul:
  1. Increase vote limit from 50 → 500
  2. Add party-line + vote metadata fields to vote objects
  3. Add data attributes to vote item DOM elements
  4. Rename 'Recent Voting Record' → 'Voting Record'
"""
import pathlib, sys

BUNDLE = pathlib.Path("assets/index-C3q1xJnh.js")
src = BUNDLE.read_text()
ok = 0
total = 4

# ---------- 1. Vote limit 50 → 500 ----------
old = "async function ra(t,r,s=50){"
new = "async function ra(t,r,s=500){"
if old not in src:
    print("SKIP 1: already patched or string not found")
else:
    src = src.replace(old, new, 1)
    ok += 1
    print("OK 1: vote limit 50 → 500")

# ---------- 2. Add fields to vote object ----------
old = 'congress:c.congress||119}}),source:"govtrack.us"}'
new = (
    'congress:c.congress||119,'
    'voteId:c.id||void 0,'
    'mjrPctPlus:c.majority_party_percent_plus??void 0,'
    'pctPlus:c.percent_plus??void 0,'
    'totalPlus:c.total_plus??void 0,'
    'totalMinus:c.total_minus??void 0,'
    'totalOther:c.total_other??void 0,'
    'questionDetails:c.question_details||void 0'
    '}}),source:"govtrack.us"}'
)
if old not in src:
    print("SKIP 2: already patched or string not found")
else:
    src = src.replace(old, new, 1)
    ok += 1
    print("OK 2: added vote metadata fields")

# ---------- 3. Add data attributes to vote items ----------
old = '"data-bill-gt-id":p.billGovtrackId||"","data-bill-display":p.billId||"","data-vote-result":p.result||""'
new = (
    '"data-bill-gt-id":p.billGovtrackId||"",'
    '"data-bill-display":p.billId||"",'
    '"data-vote-result":p.result||"",'
    '"data-vote-id":p.voteId||"",'
    '"data-position":p.position||"",'
    '"data-chamber":p.chamber||"",'
    '"data-mjr-pct-plus":p.mjrPctPlus??"",'
    '"data-pct-plus":p.pctPlus??"",'
    '"data-total-plus":p.totalPlus??"",'
    '"data-total-minus":p.totalMinus??"",'
    '"data-question-details":p.questionDetails||""'
)
if old not in src:
    print("SKIP 3: already patched or string not found")
else:
    src = src.replace(old, new, 1)
    ok += 1
    print("OK 3: added data attributes to vote items")

# ---------- 4. Rename section title ----------
old = '"Recent Voting Record"'
new = '"Voting Record"'
if old not in src:
    print("SKIP 4: already patched or string not found")
else:
    src = src.replace(old, new, 1)
    ok += 1
    print("OK 4: renamed section title")

BUNDLE.write_text(src)
print(f"\nBundle: {ok}/{total} patches applied")
if ok < total:
    print("WARNING: some patches were skipped (may already be applied)")
