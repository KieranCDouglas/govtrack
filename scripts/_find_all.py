import re

with open('assets/index-C3q1xJnh.js') as f:
    code = f.read()

# The quiz page - let me look at a much wider area around "Your Result"
idx = code.find('Your Result')
chunk = code[max(0,idx-8000):idx+8000]
bgs = list(re.finditer(r'className:"([^"]+)"', chunk))

print(f'=== All classNames (with bg- or border) near "Your Result" ===\n')
for m in bgs:
    cn = m.group(1)
    if ('bg-' in cn or ('border' in cn and 'rounded' in cn)) and len(cn) > 15:
        offset = m.end()
        ctx = chunk[offset:offset+300]
        child = re.search(r'children:"([^"]{3,60})"', ctx)
        hint = child.group(1) if child else ''
        abs_pos = m.start() + max(0, idx-8000)
        print(f'  [{abs_pos}] {cn[:100]}')
        if hint:
            print(f'    -> {hint}')

# Now let me check what the actual compass page contains - broader
print('\n\n=== Compass page containers ===')
idx2 = code.find('Political Compass Explorer')
if idx2 < 0:
    idx2 = code.find('Compass Explorer')
if idx2 < 0:
    idx2 = code.find('getContext("2d")')
print(f'Anchor at offset {idx2}')
chunk2 = code[max(0,idx2-10000):idx2+5000]
bgs2 = list(re.finditer(r'className:"([^"]+)"', chunk2))
print(f'Total classNames: {len(bgs2)}\n')
for m in bgs2:
    cn = m.group(1)
    if ('bg-card' in cn or ('bg-muted' in cn and 'rounded' in cn) or ('border' in cn and 'rounded' in cn and 'bg-' in cn)):
        offset = m.end()
        ctx = chunk2[offset:offset+300]
        child = re.search(r'children:"([^"]{3,60})"', ctx)
        hint = child.group(1) if child else ''
        abs_pos = m.start() + max(0, idx2-10000)
        print(f'  [{abs_pos}] {cn[:100]}')
        if hint:
            print(f'    -> {hint}')
