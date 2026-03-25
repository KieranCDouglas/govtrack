import re

with open('assets/index-C3q1xJnh.js') as f:
    code = f.read()

# Find "Policy Positions" or "Voting Record" or member detail sections
print('=== MEMBER DETAIL PAGE ===')
for term in ['Key Policy', 'Policy Position', 'Voting Record', 'Recent Votes', 'Ideology Score', 'policyHeterodoxy']:
    idx = code.find(term)
    if idx > 0:
        chunk = code[max(0,idx-200):idx+2000]
        print(f'\n--- "{term}" at offset {idx} ---')
        print(chunk[:2000])
        print()

# Find how votes link to source
print('\n\n=== VOTE LINKS / SOURCE ===')
for term in ['govtrack.us/congress/votes', 'vote_link', 'vote.link', '.link']:
    idx = code.find(term)
    if idx > 0:
        chunk = code[max(0,idx-300):idx+500]
        print(f'\n--- "{term}" at {idx} ---')
        print(chunk[:600])
        break
