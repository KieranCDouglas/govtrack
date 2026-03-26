#!/usr/bin/env python3
"""Deeper probe of NumbersUSA HTML to find how grade data is loaded."""
import urllib.request, ssl, re, json

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def fetch(url):
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': '*/*',
    })
    return urllib.request.urlopen(req, context=ctx, timeout=30).read().decode('utf-8', errors='replace')

# Fetch the grades page HTML
html = fetch('https://www.numbersusa.com/content/my/tools/grades')

# Check for known member names in the HTML
for name in ['McClintock', 'Biggs', 'Pelosi', 'Schumer', 'Jeffries']:
    idx = html.find(name)
    if idx >= 0:
        print(f"Found '{name}' at pos {idx}: ...{html[max(0,idx-100):idx+100]}...")
    else:
        print(f"'{name}' NOT found in raw HTML")

# Find all <script src="..."> tags to identify JS bundles
js_urls = re.findall(r'<script[^>]+src="([^"]+)"', html)
print(f"\nJS bundles: {len(js_urls)}")
for url in js_urls:
    print(f"  {url}")

# Look for any fetch/axios/XHR patterns in inline scripts
scripts = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL)
for i, s in enumerate(scripts):
    if any(kw in s for kw in ['fetch(', 'axios', 'XMLHttpRequest', 'api', '/v1/']):
        print(f"\nScript {i} has API calls ({len(s)} chars):")
        # Find URL patterns
        urls_in_script = re.findall(r'["\']([^"\']*(?:api|v1|grade|member|score)[^"\']*)["\']', s, re.IGNORECASE)
        for u in urls_in_script:
            print(f"  URL pattern: {u}")
        # Show relevant snippets
        for kw in ['fetch(', 'grades', 'members', '/v1/']:
            idx = s.find(kw)
            if idx >= 0:
                print(f"  Near '{kw}': ...{s[max(0,idx-50):idx+100]}...")
