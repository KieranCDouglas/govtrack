import re

with open('assets/index-C3q1xJnh.js') as f:
    code = f.read()

# Find the compass canvas drawing code
idx = code.find('getContext("2d")')
if idx > 0:
    # Get a big chunk around it
    chunk = code[max(0,idx-500):idx+5000]
    print('=== COMPASS CANVAS DRAWING CODE ===')
    print(chunk[:3000])
    print('\n...\n')

print('\n\n=== VOTE/BILL DISPLAY ===')
# Find how votes are rendered
for term in ['vote-card', 'VoteCard', 'vote_type', 'total_plus', 'Yea', 'Nay']:
    idx2 = code.find(term)
    if idx2 > 0:
        chunk2 = code[max(0,idx2-500):idx2+1500]
        print(f'\n--- Near "{term}" (offset {idx2}) ---')
        print(chunk2[:1500])
        break

print('\n\n=== MEMBER POSITIONS/POLICY ===')
# Find member positions section
for term in ['Positions', 'Policy Positions', 'policyHeterodoxy', 'heterodoxy']:
    idx3 = code.find(term)
    if idx3 > 0:
        chunk3 = code[max(0,idx3-500):idx3+2000]
        print(f'\n--- Near "{term}" (offset {idx3}) ---')
        print(chunk3[:2000])
        break
