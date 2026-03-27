#!/usr/bin/env python3
"""Check data-loader.js for syntax/structural issues."""
import re, os

path = os.path.join(os.path.dirname(__file__), '..', 'data-loader.js')
with open(path) as f:
    content = f.read()

lines = content.split('\n')
print(f"Total lines: {len(lines)}")
print(f"Starts with IIFE: {content.strip().startswith('(function()')}")
print(f"Ends with IIFE close: {content.strip().endswith('})();')}")

# Non-ASCII
non_ascii = [(i+1, repr(ch)) for i, ch in enumerate(content) if ord(ch) > 127]
print(f"Non-ASCII chars: {len(non_ascii)}")
for line_approx, r in non_ascii[:5]:
    print(f"  char: {r}")

# Named functions
funcs = re.findall(r'function\s+(\w+)\s*\(', content)
print(f"Named functions ({len(funcs)}): {funcs}")

# Key globals
for name in ['window.__cwLoadVotes', 'window.__cwVoteLinks', 'window.__cwVoteDates',
             'window.fetch', 'originalFetch', '_govtrackIdCache', '_membersIndex']:
    count = content.count(name)
    print(f"  {name}: {count} occurrences")

# Check braces balance
opens = content.count('{')
closes = content.count('}')
print(f"Braces: {{ {opens} }} {closes} (diff: {opens - closes})")

parens_o = content.count('(')
parens_c = content.count(')')
print(f"Parens: ( {parens_o} ) {parens_c} (diff: {parens_o - parens_c})")

brackets_o = content.count('[')
brackets_c = content.count(']')
print(f"Brackets: [ {brackets_o} ] {brackets_c} (diff: {brackets_o - brackets_c})")

# Check if __cwLoadVotes is properly closed
idx = content.find('window.__cwLoadVotes = function')
if idx >= 0:
    line_num = content[:idx].count('\n') + 1
    print(f"\n__cwLoadVotes starts at line {line_num}")
    # Find its closing
    depth = 0
    started = False
    for i in range(idx, len(content)):
        if content[i] == '{':
            depth += 1
            started = True
        elif content[i] == '}':
            depth -= 1
            if started and depth == 0:
                end_line = content[:i].count('\n') + 1
                print(f"__cwLoadVotes closes at line {end_line}")
                print(f"Next chars: {repr(content[i:i+10])}")
                break
else:
    print("WARNING: __cwLoadVotes NOT FOUND!")
