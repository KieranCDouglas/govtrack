#!/usr/bin/env python3
"""Probe NumbersUSA API endpoints for grade data."""
import urllib.request, ssl, json

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def fetch(url):
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json',
        })
        resp = urllib.request.urlopen(req, context=ctx, timeout=30)
        data = resp.read().decode('utf-8', errors='replace')
        print(f"  Status: {resp.status}, Length: {len(data)}")
        print(f"  Content-Type: {resp.headers.get('Content-Type', 'unknown')}")
        # Try to parse as JSON
        try:
            j = json.loads(data)
            if isinstance(j, dict):
                print(f"  Keys: {list(j.keys())[:20]}")
            elif isinstance(j, list):
                print(f"  List of {len(j)} items")
                if j:
                    print(f"  First item: {json.dumps(j[0])[:300]}")
            return j
        except json.JSONDecodeError:
            print(f"  Not JSON. First 300 chars: {data[:300]}")
            return None
    except Exception as e:
        print(f"  ERROR: {e}")
        return None

# Try various API paths
base_urls = [
    "https://grades.numbersusa.com/v1",
    "https://api-awsprod.numbersusa.com/v1",
]

paths = [
    "/",
    "/grades",
    "/grades/",
    "/members",
    "/members/",
    "/grades/119",
    "/grades?congress=119",
    "/congress/119/grades",
    "/scorecard/119",
    "/members?congress=119",
    "/report-cards",
    "/report-cards/119",
]

for base in base_urls:
    for path in paths:
        url = base + path
        print(f"\nTrying: {url}")
        result = fetch(url)
        if result and isinstance(result, (list, dict)):
            if isinstance(result, list) and len(result) > 10:
                print("  *** PROMISING - large list returned ***")
            elif isinstance(result, dict) and any(k in str(result.keys()).lower() for k in ['member', 'grade', 'score']):
                print("  *** PROMISING - relevant keys found ***")
