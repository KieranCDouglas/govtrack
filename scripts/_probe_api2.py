#!/usr/bin/env python3
"""Probe NumbersUSA Django grades API more thoroughly."""
import urllib.request, ssl, json, re

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def fetch(url):
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
            'Accept': 'application/json, text/html, */*',
            'Referer': 'https://www.numbersusa.com/grades/',
            'Origin': 'https://www.numbersusa.com',
        })
        resp = urllib.request.urlopen(req, context=ctx, timeout=15)
        data = resp.read().decode('utf-8', errors='replace')
        return resp.status, data
    except urllib.error.HTTPError as e:
        return e.code, None
    except Exception as e:
        return 0, str(e)

base = "https://grades.numbersusa.com/v1"

# Try known endpoint pattern: /gradecard/{id}/{congress}
# Try various legislator IDs
print("=== Individual legislator grades ===")
for leg_id in [1, 2, 100, 412, 300, 1000, 10000, 400300]:
    url = f"{base}/gradecard/{leg_id}/119"
    status, data = fetch(url)
    if status == 200 and data:
        try:
            j = json.loads(data)
            print(f"  ID {leg_id}: OK - keys: {list(j.keys())[:10]}")
            if 'legislator' in j:
                leg = j['legislator']
                print(f"    Name: {leg.get('firstname','')} {leg.get('lastname','')}")
                print(f"    Score: {leg.get('score')}, Grade: {leg.get('display_grade')}")
        except:
            print(f"  ID {leg_id}: status {status}, not JSON, first 200: {data[:200]}")
    else:
        print(f"  ID {leg_id}: status {status}")

# Try broader API endpoints  
print("\n=== Broader endpoints ===")
endpoints = [
    "/legislators",
    "/legislators/",
    "/legislators?congress=119",
    "/legislators/?congress_id=119",
    "/state-averages",
    "/state-averages/119",
    "/state-averages?congress_id=119",
    "/gradecard",
    "/grades",
    "/scores",
    "/scores/119",
    "/grades-list",
    "/grades-list/119",
    "/all-grades/119",
    "/report-cards",
    "/report-cards/119",
]
for ep in endpoints:
    url = base + ep
    status, data = fetch(url)
    preview = ""
    if data:
        preview = data[:150]
        try:
            j = json.loads(data)
            if isinstance(j, list):
                preview = f"LIST of {len(j)} items"
            elif isinstance(j, dict):
                preview = f"DICT keys: {list(j.keys())[:10]}"
        except:
            pass
    print(f"  {ep}: status {status} - {preview}")

# Also try the ultsys API
print("\n=== Ultsys API ===")
u_base = "https://api-awsprod.numbersusa.com/v1"
for ep in ["/legislators", "/members", "/grades", "/scores", "/legislators?congress=119"]:
    url = u_base + ep
    status, data = fetch(url)
    preview = ""
    if data:
        try:
            j = json.loads(data)
            if isinstance(j, list):
                preview = f"LIST of {len(j)} items"
            elif isinstance(j, dict):
                preview = f"DICT keys: {list(j.keys())[:10]}"
        except:
            preview = data[:150]
    print(f"  {ep}: status {status} - {preview}")
