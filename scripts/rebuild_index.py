#!/usr/bin/env python3
"""
Rebuild members-index.json from Voteview HSall_members.csv.
Downloads the full member dataset and creates a compact index with ICPSR IDs.
"""
import csv
import json
import io
import urllib.request
import ssl
import sys

VOTEVIEW_URL = "https://voteview.com/static/data/out/members/HSall_members.csv"
OUTPUT = "data/members-index.json"

def download_csv(url):
    print(f"Downloading {url}...")
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=120, context=ctx) as resp:
        data = resp.read().decode("utf-8")
    print(f"Downloaded {len(data)} bytes")
    return data

def title_case(s):
    return " ".join(w.capitalize() for w in s.lower().split())

def format_name(bioname):
    """Convert 'LAST, First Middle' to 'First Last'"""
    if not bioname:
        return ""
    bioname = bioname.strip().strip('"')
    if "," not in bioname:
        return title_case(bioname)
    parts = bioname.split(",", 1)
    last = title_case(parts[0].strip())
    first = parts[1].strip() if len(parts) > 1 else ""
    # Keep first name as-is (mixed case)
    if first:
        return f"{first} {last}"
    return last

def main():
    # Load existing index to preserve govtrackId mappings
    existing = {}
    try:
        with open(OUTPUT, "r") as f:
            old = json.load(f)
        for m in old:
            if m.get("b"):
                existing[m["b"]] = m
        print(f"Loaded {len(existing)} existing entries (for govtrackId preservation)")
    except FileNotFoundError:
        print("No existing index found, building from scratch")

    text = download_csv(VOTEVIEW_URL)
    reader = csv.DictReader(io.StringIO(text))
    
    # Aggregate per unique member (bioguide_id or icpsr)
    # Key: bioguide_id (preferred) or "icpsr:{icpsr}" as fallback
    members = {}
    
    party_map = {100: "D", 200: "R"}
    
    row_count = 0
    for row in reader:
        row_count += 1
        bioguide = row.get("bioguide_id", "").strip()
        icpsr = int(row.get("icpsr", 0) or 0)
        congress = int(row.get("congress", 0) or 0)
        chamber = row.get("chamber", "").strip()
        # Normalize chamber to single letter
        if chamber.lower() == "house":
            chamber = "H"
        elif chamber.lower() == "senate":
            chamber = "S"
        
        if not icpsr or not congress:
            continue
        
        key = bioguide if bioguide else f"icpsr:{icpsr}"
        
        if key not in members:
            state = row.get("state_abbrev", "").strip()
            party_code = int(row.get("party_code", 0) or 0)
            party = party_map.get(party_code, "O")
            bioname = row.get("bioname", "")
            
            members[key] = {
                "bioguide": bioguide,
                "name": format_name(bioname),
                "chamber": chamber,  # Will be updated to last chamber
                "state": state,
                "party": party,
                "first_congress": congress,
                "last_congress": congress,
                "icpsr": icpsr,
                "dim1": None,
                "dim2": None,
                "dim1_best": None,
                "dim2_best": None,
                "best_congress": 0,
            }
        
        m = members[key]
        
        # Update congress range
        if congress < m["first_congress"]:
            m["first_congress"] = congress
        if congress > m["last_congress"]:
            m["last_congress"] = congress
            m["chamber"] = chamber  # Use most recent chamber
        
        # Update ICPSR to most recent
        if congress >= m["last_congress"]:
            m["icpsr"] = icpsr
        
        # Keep the best (most recent) NOMINATE scores
        dim1 = row.get("nominate_dim1", "").strip()
        dim2 = row.get("nominate_dim2", "").strip()
        if dim1 and dim2 and dim1 != "NA" and dim2 != "NA":
            try:
                d1 = float(dim1)
                d2 = float(dim2)
                if congress > m["best_congress"]:
                    m["dim1_best"] = d1
                    m["dim2_best"] = d2
                    m["best_congress"] = congress
            except ValueError:
                pass
    
    print(f"Parsed {row_count} CSV rows -> {len(members)} unique members")
    
    # Build output
    output = []
    no_bioguide = 0
    for key, m in members.items():
        bio = m["bioguide"]
        if not bio:
            no_bioguide += 1
            continue
        
        # Get govtrackId from existing data
        old = existing.get(bio, {})
        govtrack_id = old.get("g")
        
        dim1 = m["dim1_best"]
        dim2 = m["dim2_best"]
        
        entry = {
            "b": bio,
            "n": m["name"],
            "c": m["chamber"],
            "s": m["state"],
            "p": m["party"],
            "l": m["last_congress"],
            "x": round(dim1, 4) if dim1 is not None else None,
            "y": round(dim2, 4) if dim2 is not None else None,
        }
        if govtrack_id:
            entry["g"] = govtrack_id
        entry["i"] = m["icpsr"]
        entry["fc"] = m["first_congress"]
        
        output.append(entry)
    
    print(f"Skipped {no_bioguide} members without bioguide_id")
    
    # Sort by bioguide_id for consistency
    output.sort(key=lambda x: x["b"])
    
    # Verify key members
    pelosi = next((m for m in output if m["b"] == "P000197"), None)
    print(f"Pelosi: {pelosi}")
    
    c119 = [m for m in output if m["l"] == 119]
    print(f"Congress 119 members: {len(c119)}")
    
    # Write output
    with open(OUTPUT, "w") as f:
        json.dump(output, f, separators=(",", ":"))
    
    print(f"Wrote {len(output)} members to {OUTPUT}")
    print(f"File size: {len(json.dumps(output, separators=(',', ':')))} bytes")

if __name__ == "__main__":
    main()
