#!/usr/bin/env python3
"""Fetch NumbersUSA JS bundles and find API endpoint patterns."""
import urllib.request, ssl, re

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def fetch(url):
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'Accept': '*/*',
    })
    return urllib.request.urlopen(req, context=ctx, timeout=30).read().decode('utf-8', errors='replace')

# The main app bundle
js_url = "https://www.numbersusa.com/wp-content/themes/nusa-theme/public/app.ByrH1gN5.js"
js = fetch(js_url)
print(f"App bundle: {len(js)} chars")

# Look for API-related patterns
patterns_to_find = [
    r'grades[^"\']*api[^"\']',
    r'/v1/[a-z_/]+',
    r'django_api[^"\']*',
    r'ultsys_api[^"\']*',
    r'report.card',
    r'grade.card',
    r'members?\b[^"\']{0,50}',
    r'congress[^"\']{0,50}',
]

for pat in patterns_to_find:
    matches = re.findall(pat, js, re.IGNORECASE)
    if matches:
        unique = list(set(matches))[:10]
        print(f"\nPattern '{pat}':")
        for m in unique:
            print(f"  {m[:150]}")

# Also search for full URL patterns
url_patterns = re.findall(r'["\']([^"\']*(?:grades|api|v1)[^"\']*)["\']', js, re.IGNORECASE)
unique_urls = list(set(url_patterns))
print(f"\nURL patterns found ({len(unique_urls)}):")
for u in sorted(unique_urls)[:30]:
    print(f"  {u}")

# Look for fetch/axios calls
fetch_calls = re.findall(r'(?:fetch|axios|get|post)\s*\([^)]{0,200}\)', js, re.IGNORECASE)
print(f"\nFetch/Axios calls ({len(fetch_calls)}):")
for f in fetch_calls[:15]:
    print(f"  {f[:200]}")
