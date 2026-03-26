import json, sys, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))

with open('data/members-current.json') as f:
    members = json.load(f)

sys.stdout.write('Total members: ' + str(len(members)) + '\n')

# Just check first 5 members
for m in members[:5]:
    cx = m.get('compassX')
    cy = m.get('compassY')
    d1 = m.get('dim1')
    d2 = m.get('dim2')
    name = m.get('name', 'unknown')
    party = m.get('party', '?')
    sys.stdout.write(name + ' (' + party + '): cX=' + str(cx) + ' cY=' + str(cy) + ' d1=' + str(d1) + ' d2=' + str(d2) + '\n')

sys.stdout.write('Done\n')
sys.stdout.flush()
