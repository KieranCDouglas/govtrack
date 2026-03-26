#!/usr/bin/env python3
"""Quick probe of NumbersUSA HTML structure."""
import urllib.request, ssl, re, json

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
req = urllib.request.Request(
    'https://www.numbersusa.com/content/my/tools/grades',
    headers={'User-Agent': 'Mozilla/5.0'}
)
html = urllib.request.urlopen(req, context=ctx, timeout=60).read().decode('utf-8', errors='replace')

scripts = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL)
print(f"Total HTML: {len(html)} chars, {len(scripts)} script tags")

for i, s in enumerate(scripts):
    if any(kw in s.lower() for kw in ['grade', 'member', 'score', 'percent', 'congress']):
        print(f"\nScript {i}: {len(s)} chars")
        print(f"  Preview: {s[:300]}")

for pattern in ['__NEXT_DATA__', 'window.__', 'grades', 'memberData', 'scorecard', 'apiUrl', 'api/']:
    idx = html.find(pattern)
    if idx >= 0:
        print(f"\nFound '{pattern}' at pos {idx}:")
        print(f"  {html[max(0,idx-50):idx+300]}")
