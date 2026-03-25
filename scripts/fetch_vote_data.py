#!/usr/bin/env python3
"""
Fetch Voteview vote + rollcall CSVs and generate compact JSON files.

For each congress/chamber pair, produces data/votes/{C}{congress}.json:
{
  "r": [[rollnum, date, bill, question, result, yea, nay, desc], ...],
  "v": {"icpsr": "16119...", ...}   // cast codes as single-digit string
}

Cast codes: 1-3=Yea, 4-6=Nay, 7=Present, 8-9=Not Voting, 0=missing
This avoids CORS issues by hosting vote data on the same origin.
"""
import csv
import io
import json
import os
import ssl
import sys
import time
import urllib.request

BASE = "https://voteview.com/static/data/out"
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "votes")
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE


def fetch(url, retries=3):
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0",
                "Accept-Encoding": "identity",  # avoid gzip issues
            })
            with urllib.request.urlopen(req, context=ctx, timeout=180) as r:
                # Read in chunks to avoid hanging on large files
                chunks = []
                while True:
                    chunk = r.read(65536)
                    if not chunk:
                        break
                    chunks.append(chunk)
                return b"".join(chunks).decode("utf-8")
        except Exception as e:
            if attempt < retries:
                wait = 3 * (attempt + 1)
                print(f"retry {attempt+1} (wait {wait}s)...", end=" ", flush=True)
                time.sleep(wait)
            else:
                raise


def process_congress(chamber, congress, force=False):
    """Download and process one chamber/congress pair."""
    key = f"{chamber}{congress}"
    out_path = os.path.join(OUT_DIR, f"{key}.json")

    if os.path.exists(out_path) and not force:
        return "skip"

    # Voteview uses zero-padded congress numbers for < 100
    padded_key = f"{chamber}{congress:03d}" if congress < 100 else f"{chamber}{congress}"
    votes_url = f"{BASE}/votes/{padded_key}_votes.csv"
    rolls_url = f"{BASE}/rollcalls/{padded_key}_rollcalls.csv"

    try:
        votes_text = fetch(votes_url)
        rolls_text = fetch(rolls_url)
    except Exception as e:
        return f"fetch-error: {e}"

    rollcalls_raw = list(csv.DictReader(io.StringIO(rolls_text)))
    if not rollcalls_raw:
        return "no-rollcalls"

    # Rollcall array: [rollnum, date, bill, question, result, yea, nay, desc]
    rollcall_order = []
    rollcalls = []
    for rc in rollcalls_raw:
        rn = rc.get("rollnumber", "").strip()
        rollcall_order.append(rn)
        desc = (rc.get("dtl_desc", "") or rc.get("vote_desc", "")).strip()
        if len(desc) > 200:
            desc = desc[:197] + "..."
        rollcalls.append([
            int(rn) if rn.isdigit() else rn,
            rc.get("date", "").strip(),
            rc.get("bill_number", "").strip(),
            rc.get("vote_question", "").strip(),
            rc.get("vote_result", "").strip(),
            int(rc.get("yea_count", "0").strip() or "0"),
            int(rc.get("nay_count", "0").strip() or "0"),
            desc,
        ])

    # Parse votes: icpsr -> {rollnumber -> cast_code}
    icpsr_votes = {}
    for line in votes_text.split("\n")[1:]:
        if not line.strip():
            continue
        parts = line.split(",")
        if len(parts) < 5:
            continue
        icpsr = parts[3].strip()
        rollnum = parts[2].strip()
        cc = parts[4].strip()
        cast_code = int(cc) if cc.isdigit() else 9
        if cast_code > 9:
            cast_code = 9
        if icpsr not in icpsr_votes:
            icpsr_votes[icpsr] = {}
        icpsr_votes[icpsr][rollnum] = cast_code

    # Compact votes: {icpsr: "16119..." (one digit per rollcall)}
    votes = {}
    for icpsr, vote_map in icpsr_votes.items():
        codes = []
        for rn in rollcall_order:
            codes.append(str(vote_map.get(rn, 0)))
        votes[icpsr] = "".join(codes)

    data = {"r": rollcalls, "v": votes}
    with open(out_path, "w") as f:
        json.dump(data, f, separators=(",", ":"))

    size = os.path.getsize(out_path)
    return f"ok ({size:,}b, {len(rollcalls)} rolls, {len(votes)} members)"


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    force = "--force" in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    start = int(args[0]) if len(args) > 0 else 1
    end = int(args[1]) if len(args) > 1 else 119

    total = (end - start + 1) * 2
    done = 0

    for congress in range(end, start - 1, -1):
        for chamber in ["S", "H"]:
            done += 1
            key = f"{chamber}{congress}"
            sys.stdout.write(f"[{done}/{total}] {key}... ")
            sys.stdout.flush()
            try:
                result = process_congress(chamber, congress, force=force)
                print(result)
            except Exception as e:
                print(f"ERROR: {e}")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
