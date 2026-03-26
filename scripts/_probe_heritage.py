#!/usr/bin/env python3
"""Try Heritage Action with Selenium page interaction."""
import time, json, re
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC

opts = Options()
opts.add_argument("--headless")
opts.add_argument("--no-sandbox")
opts.add_argument("--disable-dev-shm-usage")
opts.add_argument("--window-size=1920,10000")
driver = webdriver.Chrome(options=opts)

try:
    driver.get("https://heritageaction.com/scorecard/members/119")
    time.sleep(8)
    
    # Check what's on the page
    print("Page title:", driver.title)
    text = driver.find_element("tag name", "body").text
    print(f"Initial text ({len(text)} chars):")
    print(text[:1000])
    print("---")
    
    # Try to find and interact with the session selector
    selects = driver.find_elements(By.TAG_NAME, "select")
    print(f"\nFound {len(selects)} <select> elements")
    for i, s in enumerate(selects):
        opts_el = s.find_elements(By.TAG_NAME, "option")
        opts_text = [o.text for o in opts_el[:5]]
        print(f"  Select {i}: id='{s.get_attribute('id')}' options: {opts_text}")
    
    # Try selecting "119th Congress" if there's a session dropdown
    for s in selects:
        opts_el = s.find_elements(By.TAG_NAME, "option")
        for o in opts_el:
            if "119" in o.text:
                print(f"\n  Selecting: '{o.text}'")
                sel = Select(s)
                sel.select_by_visible_text(o.text)
                time.sleep(8)
                text2 = driver.find_element("tag name", "body").text
                print(f"  After selection: {len(text2)} chars")
                # Look for score patterns
                pct_matches = re.findall(r'(\d+)%', text2)
                print(f"  Found {len(pct_matches)} percentage values")
                if len(pct_matches) > 50:
                    print(f"  Sample percentages: {pct_matches[:20]}")
                print(f"  Text preview: {text2[:2000]}")
                break

    # Also check page source for embedded data
    source = driver.page_source
    # Look for JSON data
    json_scripts = re.findall(r'<script[^>]*type="application/json"[^>]*>(.*?)</script>', source, re.DOTALL)
    print(f"\nFound {len(json_scripts)} JSON scripts")
    for i, js in enumerate(json_scripts):
        print(f"  Script {i}: {len(js)} chars, preview: {js[:200]}")

finally:
    driver.quit()
