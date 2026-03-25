#!/usr/bin/env python3
"""Check JS structure balance."""
with open('ui-enhancements.js') as f:
    code = f.read()

braces = parens = brackets = 0
in_string = False
escape_next = False
quote_char = None

for ch in code:
    if escape_next:
        escape_next = False
        continue
    if ch == '\\':
        if in_string:
            escape_next = True
        continue
    if in_string:
        if ch == quote_char:
            in_string = False
        continue
    if ch in ('"', "'", '`'):
        in_string = True
        quote_char = ch
        continue
    if ch == '{': braces += 1
    elif ch == '}': braces -= 1
    elif ch == '(': parens += 1
    elif ch == ')': parens -= 1
    elif ch == '[': brackets += 1
    elif ch == ']': brackets -= 1

print(f'Braces: {braces}, Parens: {parens}, Brackets: {brackets}')
if braces == 0 and parens == 0 and brackets == 0:
    print('All balanced!')
else:
    print('WARNING: Unbalanced')
