import re

with open('assets/index-C3q1xJnh.js') as f:
    code = f.read()

# Extract layout around compass canvas
idx = code.find('getContext("2d")')
chunk = code[max(0,idx-6000):idx+2000]

# Find ALL classNames with bg- that look like containers
all_cn = list(re.finditer(r'className:"([^"]+)"', chunk))
print(f'Total classNames in compass area: {len(all_cn)}\n')

for m in all_cn:
    cn = m.group(1)
    # Only show meaningful container classes
    if ('bg-' in cn or ('border' in cn and 'rounded' in cn)) and len(cn) > 15:
        # Try to find nearby content
        offset = m.end()
        ctx = chunk[offset:offset+200]
        child = re.search(r'children:"([^"]{3,50})"', ctx)
        hint = child.group(1) if child else ''
        print(f'{cn[:100]}')
        if hint:
            print(f'  -> {hint}')
        print()

print('\n\n=== QUIZ AREA ===\n')
# Find quiz by looking for quiz-specific terms
for term in ['Strongly Agree', 'question_', 'answers', 'quizState', 'setQuizState']:
    idx = code.find(term)
    if idx > 0:
        chunk2 = code[max(0,idx-8000):idx+3000]
        all_cn2 = list(re.finditer(r'className:"([^"]+)"', chunk2))
        print(f'Near "{term}" - {len(all_cn2)} classNames')
        for m in all_cn2:
            cn = m.group(1)
            if ('bg-card' in cn or 'bg-muted' in cn) and len(cn) > 15:
                offset = m.end()
                ctx = chunk2[offset:offset+200]
                child = re.search(r'children:"([^"]{3,50})"', ctx)
                hint = child.group(1) if child else ''
                print(f'  {cn[:100]}')
                if hint:
                    print(f'    -> {hint}')
        break
