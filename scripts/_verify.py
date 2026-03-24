with open('assets/index-C3q1xJnh.js') as f:
    c = f.read()
print('port/5000 count:', c.count('port/5000'))
print('fe patched:', 'const st="",fe=' in c)
idx = c.find('const st=')
if idx >= 0:
    print('st definition:', repr(c[idx:idx+40]))
