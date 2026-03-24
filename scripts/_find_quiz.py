import re

with open('assets/index-C3q1xJnh.js') as f:
    code = f.read()

# Broader search for quiz
idx = code.find('Strongly Agree')
print(f'Found "Strongly Agree" at offset {idx}')

# Look much wider
chunk = code[max(0,idx-15000):idx+5000]
all_cn = list(re.finditer(r'className:"([^"]+)"', chunk))
print(f'Total classNames in quiz area: {len(all_cn)}\n')

for m in all_cn:
    cn = m.group(1)
    if ('bg-card' in cn or ('bg-muted' in cn and 'rounded' in cn)) and len(cn) > 15:
        offset = m.end()
        ctx = chunk[offset:offset+300]
        child = re.search(r'children:"([^"]{3,60})"', ctx)
        hint = child.group(1) if child else ''
        print(f'CLASS: {cn[:100]}')
        if hint:
            print(f'  -> {hint}')
        print()

# Also search for the quiz result/overview container
print('\n=== Quiz result containers ===')
for term in ['Your Position', 'quiz result', 'results', 'You are closest']:
    idx2 = code.find(term)
    if idx2 > 0:
        chunk2 = code[max(0,idx2-3000):idx2+1000]
        for m in re.finditer(r'className:"([^"]*(?:bg-card|bg-muted)[^"]*)"', chunk2):
            cn = m.group(1)
            if len(cn) > 15:
                offset = m.end()
                ctx = chunk2[offset:offset+200]
                child = re.search(r'children:"([^"]{3,60})"', ctx)
                hint = child.group(1) if child else ''
                print(f'Near "{term}": {cn[:90]}')
                if hint:
                    print(f'  -> {hint}')
