with open('/Users/kieran/Documents/GitHub/govtrack/assets/index-C3q1xJnh.js') as f:
    js = f.read()

checks = [
    ('rgba(4,42,43', False, 'no old dark backgrounds remain'),
    ('#042a2b', False, 'no old canvas backgrounds remain'),
    ('#0a4a4c', True, 'new brighter canvas bg present'),
    ('rgba(9,72,74,0.65)', True, 'brighter canvas fill (member)'),
    ('rgba(9,72,74,0.55)', True, 'brighter canvas fill (full)'),
    ('hsl(var(--card))', True, 'theme-aware box backgrounds'),
    ('rgba(239,123,69,0.12)', True, 'boosted quadrant tints'),
    ('rgba(94,177,191,0.22)', True, 'boosted grid lines (member)'),
]
for s, expect, desc in checks:
    found = s in js
    ok = 'OK' if found == expect else 'FAIL'
    print(f'{ok}: {desc} (found={found})')

# Check axis labels
for label in ['Left","k+4', 'Right","L-k', 'Conservative","O,k', 'Progressive","O,G']:
    found = label.replace('"', '') in js.replace('"', '') or label in js
    print(f'{"OK" if found else "FAIL"}: axis label {label[:20]}')
