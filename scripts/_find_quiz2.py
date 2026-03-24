import re

with open('assets/index-C3q1xJnh.js') as f:
    code = f.read()

# Find ALL bg- classNames in the quiz area  
idx = code.find('Strongly Agree')
chunk = code[max(0,idx-15000):idx+5000]
all_cn = list(re.finditer(r'className:"([^"]+)"', chunk))

print(f'ALL classNames with bg- or border+rounded in quiz vicinity ({len(all_cn)} total):\n')
for m in all_cn:
    cn = m.group(1)
    if ('bg-' in cn and len(cn) > 10) or ('border' in cn and 'rounded' in cn and len(cn) > 20):
        offset = m.end()
        ctx = chunk[offset:offset+200]
        child = re.search(r'children:"([^"]{3,60})"', ctx)
        hint = child.group(1) if child else ''
        print(f'  {cn[:100]}')
        if hint:
            print(f'    -> {hint}')

# Also extract the specific quiz overview box text area
print('\n\n=== Searching for quiz overview/sidebar ===')
for term in ['quiz-overview', 'Quiz Overview', 'Your Result', 'Your Score', 'quiz-result', 'compass-result', 'position-result']:
    idx2 = code.find(term)
    if idx2 > 0:
        print(f'Found "{term}" at {idx2}')

# What about the quiz wrapping structure?
print('\n=== Quiz page structure ===')
# Find the quiz page component function - look for the quiz questions state
for term in ['setCurrentQuestion', 'currentQuestion', 'quizFinished', 'questionsData']:
    idx2 = code.find(term)
    if idx2 > 0:
        chunk2 = code[max(0,idx2-5000):idx2+5000]
        bgs = list(re.finditer(r'className:"([^"]*bg-[^"]*)"', chunk2))
        if bgs:
            print(f'\nNear "{term}" ({idx2}):')
            for m in bgs:
                cn = m.group(1)
                if len(cn) > 20:
                    print(f'  {cn[:100]}')
            break
