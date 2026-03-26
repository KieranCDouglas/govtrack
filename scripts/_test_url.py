import re

def bill_id_to_url(raw_id, congress):
    if not raw_id or not congress:
        return ''
    ident = re.sub(r'[.\s]', '', raw_id).upper().strip()
    type_map = {
        'HR': 'house-bill', 'S': 'senate-bill',
        'HRES': 'house-resolution', 'SRES': 'senate-resolution',
        'HJRES': 'house-joint-resolution', 'SJRES': 'senate-joint-resolution',
        'HCONRES': 'house-concurrent-resolution', 'SCONRES': 'senate-concurrent-resolution'
    }
    prefixes = ['HCONRES','SCONRES','HJRES','SJRES','HRES','SRES','HR','S']
    for p in prefixes:
        if ident.startswith(p):
            num = ident[len(p):]
            if num and num.isdigit():
                c = int(congress)
                suf = 'st' if c==1 else 'nd' if c==2 else 'rd' if c==3 else 'th'
                return f'https://www.congress.gov/bill/{c}{suf}-congress/{type_map[p]}/{num}'
    return ''

tests = [
    ('HR29', '119'),
    ('HRES5', '119'),
    ('HJRES42', '119'),
    ('S100', '119'),
    ('H.R. 29', '119'),
    ('S. 100', '119'),
    ('', '119'),
    ('HR29', ''),
    ('HR29', 119),
    ('PN2', '119'),
]
for t in tests:
    result = bill_id_to_url(t[0], t[1])
    print(f'{repr(t[0]):15} {str(t[1]):>5} => {result or "(empty)"}')
