import re

with open('assets/index-C3q1xJnh.js', 'r') as f:
    js = f.read()

# 1. Canvas backgrounds
print("=== CANVAS BACKGROUNDS ===")
for pat in [r'rgba\(4,42,43[^)]*\)', r'rgba\(9,91,93[^)]*\)', r'#042a2b', r'#095b5d', r'background:"[^"]*"']:
    for m in re.finditer(pat, js, re.IGNORECASE):
        ctx = js[max(0,m.start()-80):m.start()+200]
        print(f"  [{m.start()}] {ctx[:280]}")
        print()

# 2. Quadrant description boxes in JSX
print("=== QUADRANT BOXES (JSX) ===")
for label in ['Populist Left', 'Traditional Right', 'Progressive Left', 'Libertarian']:
    for m in re.finditer(re.escape(label), js):
        # Skip if it's in a fillText call (canvas)
        before = js[max(0,m.start()-30):m.start()]
        if 'fillText' in before:
            continue
        ctx = js[max(0,m.start()-200):m.start()+400]
        print(f"  [{m.start()}] ...{ctx}...")
        print()

# 3. Quiz result/position area
print("=== QUIZ RESULT ===")
for pat in ['Your Position', 'You landed', 'Your result']:
    for m in re.finditer(pat, js, re.IGNORECASE):
        ctx = js[max(0,m.start()-200):m.start()+500]
        print(f"  [{m.start()}] {ctx[:700]}")
        print()

# 4. Quiz compass canvas
print("=== QUIZ COMPASS ===")
idx = js.find('quiz')
while idx != -1:
    ctx = js[max(0,idx-50):idx+100]
    if 'canvas' in ctx.lower() or 'compass' in ctx.lower() or 'getContext' in ctx:
        print(f"  [{idx}] {ctx}")
        print()
    idx = js.find('quiz', idx+1)
    if idx > 120000:
        break
