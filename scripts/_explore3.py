import re

with open('assets/index-C3q1xJnh.js') as f:
    code = f.read()

# Find "Key Policy" / positions section on member detail page
print('=== MEMBER POSITIONS / KEY POLICY ===')
for term in ['Key Policy', 'Key Issues', 'Issue Position', 'Position on', 'positions', 'stances', 'believes']:
    indices = []
    idx = 0
    while True:
        idx = code.find(term, idx)
        if idx < 0:
            break
        # Check context
        chunk = code[max(0,idx-100):idx+100]
        if any(x in chunk.lower() for x in ['classname', 'children', 'jsx', 'div']):
            indices.append(idx)
        idx += 1
    if indices:
        print(f'\n"{term}" found at {indices[:5]}')
        for i in indices[:2]:
            chunk = code[max(0,i-300):i+500]
            print(chunk[:600])
            print('...')

# Search for known policy labels
print('\n\n=== POLICY LABELS ===')
for term in ['Fiscal', 'Immigration', 'Healthcare', 'Defense', 'Environment', 'Social Rights']:
    idx = code.find(f'"{term}')
    if idx < 0:
        idx = code.find(f"'{term}")
    if idx > 0:
        chunk = code[max(0,idx-200):idx+400]
        print(f'\n--- "{term}" at {idx} ---')
        print(chunk[:400])
        print()
        break

# Also get the full member detail component structure
print('\n=== MEMBER DETAIL FULL STRUCTURE ===')
idx = code.find('Recent Voting Record')
if idx > 0:
    # Go backward to find the component start
    chunk = code[max(0,idx-15000):idx+5000]
    # Find section headers
    headers = re.findall(r'children:"([^"]*(?:Record|Position|Policy|Ideology|Score|Overview|Profile|Summary|About)[^"]*)"', chunk)
    print('Section headers found:')
    for h in headers:
        print(f'  - {h}')
