import re

with open('assets/index-C3q1xJnh.js') as f:
    code = f.read()

# Get the full Issue Positions section
idx = code.find('Issue Positions')
chunk = code[max(0,idx-200):idx+3000]
print('=== ISSUE POSITIONS SECTION ===')
print(chunk[:3000])
print('\n\n')

# Find where the positions data comes from
# Look for the position generation/mapping
idx2 = code.find('Positions reflect')
if idx2 > 0:
    chunk2 = code[max(0,idx2-500):idx2+500]
    print('=== POSITIONS DISCLAIMER ===')
    print(chunk2[:800])
    print()

# Find the party-based positions data
for term in ['fiscal policy', 'tax policy', 'immigration policy', 'gun control', 'gun rights']:
    idx3 = code.find(term)
    if idx3 > 0:
        chunk3 = code[max(0,idx3-1000):idx3+1000]
        print(f'\n=== Near "{term}" ===')
        print(chunk3[:1500])
        break

# Also look for the position generation function
idx4 = code.find('"c.map(p=>e.jsxs')
if idx4 < 0:
    # Look for the mapped positions array
    idx4 = code.find('.map(p=>e.jsxs("div"')
    if idx4 > 0:
        # Check if near Issue Positions
        if abs(idx4 - code.find('Issue Positions')) < 500:
            chunk4 = code[max(0,idx4-2000):idx4+500]
            print('\n=== POSITIONS MAP GENERATION ===')
            print(chunk4[:2000])
