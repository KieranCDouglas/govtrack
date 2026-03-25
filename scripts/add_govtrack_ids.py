#!/usr/bin/env python3
"""
Fetch GovTrack person IDs for all historical members and add them to members-index.json.

Uses the unitedstates/congress-legislators YAML data (available as JSON)
which maps bioguide IDs to GovTrack IDs for all legislators.
Falls back to GovTrack API for any missing mappings.
"""

import json
import os
import ssl
import time
import urllib.request

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "..", "data")
PUBLIC_DIR = os.path.join(SCRIPT_DIR, "..", "public")
INDEX_PATH = os.path.join(DATA_DIR, "members-index.json")

# unitedstates/congress-legislators JSON endpoints
LEGISLATORS_CURRENT_URL = "https://theunitedstates.io/congress-legislators/legislators-current.json"
LEGISLATORS_HISTORICAL_URL = "https://theunitedstates.io/congress-legislators/legislators-historical.json"

# GovTrack API for fallback
GOVTRACK_PERSON_API = "https://www.govtrack.us/api/v2/person"


def create_ssl_context():
    """Create an unverified SSL context for environments with cert issues."""
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def fetch_json(url):
    """Fetch JSON from a URL."""
    ctx = create_ssl_context()
    req = urllib.request.Request(url, headers={"User-Agent": "CongressWatch/1.0"})
    with urllib.request.urlopen(req, context=ctx, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def build_bioguide_to_govtrack_map():
    """
    Build a mapping of bioguide_id -> govtrack_id from the
    unitedstates/congress-legislators dataset.
    """
    mapping = {}

    for label, url in [("current", LEGISLATORS_CURRENT_URL),
                        ("historical", LEGISLATORS_HISTORICAL_URL)]:
        print(f"Fetching {label} legislators from theunitedstates.io...")
        try:
            legislators = fetch_json(url)
            count = 0
            for leg in legislators:
                bioguide = leg.get("id", {}).get("bioguide")
                govtrack = leg.get("id", {}).get("govtrack")
                if bioguide and govtrack:
                    mapping[bioguide] = int(govtrack)
                    count += 1
            print(f"  Got {count} mappings from {label} legislators")
        except Exception as e:
            print(f"  WARNING: Failed to fetch {label}: {e}")

    return mapping


def fetch_govtrack_api_batch(bioguide_ids, mapping):
    """
    For any bioguide IDs not yet mapped, try the GovTrack API.
    Fetches in batches to be respectful.
    """
    missing = [b for b in bioguide_ids if b not in mapping]
    if not missing:
        return mapping

    print(f"\nFetching {len(missing)} remaining IDs from GovTrack API...")

    # GovTrack API supports fetching all persons with pagination
    offset = 0
    limit = 600
    total_from_api = 0

    while True:
        url = f"{GOVTRACK_PERSON_API}?limit={limit}&offset={offset}&format=json"
        try:
            data = fetch_json(url)
            objects = data.get("objects", [])
            if not objects:
                break

            for person in objects:
                bioguideid = person.get("bioguideid")
                govtrack_id = person.get("id")
                if bioguideid and govtrack_id:
                    if bioguideid not in mapping:
                        mapping[bioguideid] = int(govtrack_id)
                        total_from_api += 1

            meta = data.get("meta", {})
            total_count = meta.get("total_count", 0)
            offset += limit
            print(f"  Fetched {offset}/{total_count} persons...")

            if offset >= total_count:
                break

            time.sleep(0.5)  # Be nice to the API

        except Exception as e:
            print(f"  WARNING: GovTrack API error at offset {offset}: {e}")
            break

    print(f"  Got {total_from_api} additional mappings from GovTrack API")
    return mapping


def main():
    # Load current index
    print(f"Loading {INDEX_PATH}...")
    with open(INDEX_PATH) as f:
        members = json.load(f)

    print(f"Total members in index: {len(members)}")

    # Get all bioguide IDs
    bioguide_ids = [m["b"] for m in members]

    # Build mapping from congress-legislators dataset
    mapping = build_bioguide_to_govtrack_map()
    print(f"\nTotal mappings from congress-legislators: {len(mapping)}")

    # Check coverage
    matched = sum(1 for b in bioguide_ids if b in mapping)
    print(f"Matched: {matched}/{len(bioguide_ids)} ({matched*100//len(bioguide_ids)}%)")

    # Fetch remaining from GovTrack API
    if matched < len(bioguide_ids):
        mapping = fetch_govtrack_api_batch(bioguide_ids, mapping)
        matched = sum(1 for b in bioguide_ids if b in mapping)
        print(f"After API fetch: {matched}/{len(bioguide_ids)} ({matched*100//len(bioguide_ids)}%)")

    # Add govtrack IDs to index entries
    added = 0
    for m in members:
        gt_id = mapping.get(m["b"])
        if gt_id:
            m["g"] = gt_id
            added += 1

    print(f"\nAdded govtrackId to {added}/{len(members)} members")

    # Show some that are missing
    missing = [m for m in members if "g" not in m]
    if missing:
        print(f"Missing govtrackId for {len(missing)} members:")
        for m in missing[:10]:
            print(f"  {m['b']}: {m['n']} (Congress {m['l']})")
        if len(missing) > 10:
            print(f"  ... and {len(missing) - 10} more")

    # Save updated index
    with open(INDEX_PATH, "w") as f:
        json.dump(members, f, separators=(",", ":"))
    print(f"\nSaved updated index to {INDEX_PATH}")

    # Also copy to public directory
    public_path = os.path.join(PUBLIC_DIR, "members-index.json")
    if os.path.isdir(PUBLIC_DIR):
        with open(public_path, "w") as f:
            json.dump(members, f, separators=(",", ":"))
        print(f"Copied to {public_path}")

    # Stats
    with_votes_era = sum(1 for m in members if "g" in m and m.get("l", 0) >= 101)
    print(f"\nMembers with govtrackId from Congress 101+ (GovTrack vote era): {with_votes_era}")
    print("GovTrack has roll call vote data from ~1989 (101st Congress) onward.")


if __name__ == "__main__":
    main()
