import re

with open('assets/index-C3q1xJnh.js') as f:
    code = f.read()

# Search for bg-card containers and identify what content they wrap
print('=== All bg-card containers ===')
for m in re.finditer(r'className:"([^"]*bg-card[^"]*)"', code):
    cn = m.group(1)
    pos = m.start()
    context = code[pos:pos+400]
    # Get a content hint
    title_m = re.search(r'children:"([^"]{5,60})"', context)
    hint = title_m.group(1) if title_m else ''
    print(f'  CLASS: {cn[:90]}')
    if hint:
        print(f'    CONTENT: {hint}')
    print()

# Also find bg-muted containers
print('\n=== bg-muted containers ===')
for m in re.finditer(r'className:"([^"]*bg-muted[^"]*)"', code):
    cn = m.group(1)
    pos = m.start()
    context = code[pos:pos+400]
    title_m = re.search(r'children:"([^"]{5,60})"', context)
    hint = title_m.group(1) if title_m else ''
    if len(cn) > 20:  # Skip small utility classes
        print(f'  CLASS: {cn[:90]}')
        if hint:
            print(f'    CONTENT: {hint}')
        print()
