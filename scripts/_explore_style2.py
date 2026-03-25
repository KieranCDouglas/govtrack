import re, json

with open('assets/index-C3q1xJnh.js', 'r') as f:
    js = f.read()

# Find the quiz page quadrant box code (around 111534)
print("=== QUIZ QUADRANT BOXES ===")
chunk = js[111500:112300]
print(chunk)
print()

# Find the compass page quadrant boxes (around 90767)
print("=== COMPASS QUADRANT BOXES ===")
chunk = js[90700:91700]
print(chunk)
print()

# Find axis legend on compass page
print("=== COMPASS AXIS LEGEND ===")
# Search for the axis description text on compass page
for pat in ['Economic.*Left.*collectivist', 'Social.*Up.*conservative']:
    for m in re.finditer(pat, js):
        if m.start() > 80000 and m.start() < 100000:
            print(f"[{m.start()}] {js[max(0,m.start()-200):m.start()+400]}")
            print()

# Find quiz axis description box
print("=== QUIZ AXIS BOX ===")
chunk = js[110500:111000]
print(chunk)
