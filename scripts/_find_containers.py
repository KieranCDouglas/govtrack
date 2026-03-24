import re

with open('assets/index-C3q1xJnh.js') as f:
    code = f.read()

# Find the compass page component - look for canvas and compass together
# The compass page has a canvas element for drawing
for term in ['compassRef', 'canvasRef', 'getContext("2d")', 'fillRect']:
    idx = code.find(term)
    if idx > 0:
        # Look at a wider radius for container classNames
        chunk = code[max(0,idx-3000):idx+3000]
        all_bg = list(re.finditer(r'className:"([^"]*(?:bg-card|bg-muted)[^"]*)"', chunk))
        if all_bg:
            print(f'=== Near "{term}" (offset {idx}) ===')
            for m in all_bg:
                cn = m.group(1)
                # Get nearby content
                ctx = code[m.start()+idx-3000:m.start()+idx-3000+400] if m.start()+idx-3000 > 0 else ''
                print(f'  {cn[:80]}')
            print()

# Find quiz page - look for answers/questions
print('\n=== Quiz page structure ===')
for term in ['Strongly Agree', 'Strongly Disagree', 'Question ']:
    idx = code.find(term)
    if idx > 0:
        chunk = code[max(0,idx-5000):idx+1000]
        all_bg = list(re.finditer(r'className:"([^"]*(?:bg-card|bg-muted/)[^"]*)"', chunk))
        for m in all_bg:
            cn = m.group(1)
            if len(cn) > 20:
                print(f'  Near "{term}": {cn[:90]}')
        break

# Try to find the major page-level containers by looking for compass page route
print('\n=== Route-level containers ===')
for route_term in ['compass', 'quiz']:
    idx = code.find(f'path:"/{route_term}"')
    if idx < 0:
        idx = code.find(f'"/{route_term}"')
    if idx > 0:
        chunk = code[max(0,idx-200):idx+5000]
        all_bg = list(re.finditer(r'className:"([^"]*bg-[^"]*)"', chunk))
        print(f'\nNear route "/{route_term}":')
        for m in all_bg[:10]:
            cn = m.group(1)
            if len(cn) > 30:
                print(f'  {cn[:100]}')
