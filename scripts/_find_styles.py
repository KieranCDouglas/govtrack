import re

with open('assets/index-C3q1xJnh.js') as f:
    code = f.read()

# Find compass page - look for canvas related code on the compass page
for term in ['compass-container', 'compassCanvas', 'canvas', 'compassRef', 'Explore the interactive', 'Political Compass Explorer']:
    idx = code.find(term)
    if idx > 0:
        chunk = code[max(0,idx-2000):idx+1000]
        matches = list(re.finditer(r'className:"([^"]+)"', chunk))
        for m in matches:
            cn = m.group(1)
            if ('bg-' in cn or 'border' in cn) and len(cn) > 15:
                print(f'Near "{term}": {cn}')

print("\n--- Quiz containers ---")
for term in ['Quiz', 'quiz-overview', 'Your Position', 'quiz result', 'Take the Political', 'question']:
    idx = code.find(term)
    if idx > 0:
        chunk = code[max(0,idx-1500):idx+500]
        matches = list(re.finditer(r'className:"([^"]+)"', chunk))
        for m in matches:
            cn = m.group(1)
            if ('bg-' in cn) and len(cn) > 15:
                print(f'Near "{term}": {cn}')
