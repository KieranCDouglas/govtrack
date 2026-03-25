import sys

BUNDLE = '/Users/kieran/Documents/GitHub/govtrack/assets/index-C3q1xJnh.js'

with open(BUNDLE, 'r') as f:
    js = f.read()

original = js

# Replace compass page quadrant boxes to use inline styles matching the quiz page
old = (
    '[{color:"border-[#ef7b45]/40 bg-[#ef7b45]/8",label:"Populist Left",'
    'sub:"econ-left + social-conservative. State nationalism, protectionism, cultural restriction."},'
    '{color:"border-[#cdedf6]/25 bg-[#cdedf6]/5",label:"Traditional Right",'
    'sub:"econ-right + social-conservative. Free markets, traditional values, low taxes."},'
    '{color:"border-[#5eb1bf]/40 bg-[#5eb1bf]/8",label:"Progressive Left",'
    'sub:"econ-left + social-progressive. Redistribution, state programs, individual autonomy."},'
    '{color:"border-[#5eb1bf]/50 bg-[#5eb1bf]/12",label:"Libertarian",'
    'sub:"econ-right + social-progressive. Free markets, open society, minimal state intervention."}]'
    '.map(v=>e.jsxs("div",{className:`border rounded-md px-2.5 py-2 ${v.color}`'
)

new = (
    '[{c:"rgba(239,123,69,0.15)",b:"rgba(239,123,69,0.4)",label:"Populist Left",'
    'sub:"econ-left + social-conservative. State nationalism, protectionism, cultural restriction."},'
    '{c:"rgba(205,237,246,0.08)",b:"rgba(205,237,246,0.3)",label:"Traditional Right",'
    'sub:"econ-right + social-conservative. Free markets, traditional values, low taxes."},'
    '{c:"rgba(94,177,191,0.12)",b:"rgba(94,177,191,0.5)",label:"Progressive Left",'
    'sub:"econ-left + social-progressive. Redistribution, state programs, individual autonomy."},'
    '{c:"rgba(94,177,191,0.18)",b:"rgba(94,177,191,0.6)",label:"Libertarian",'
    'sub:"econ-right + social-progressive. Free markets, open society, minimal state intervention."}]'
    '.map(v=>e.jsxs("div",{className:"border rounded-md px-2.5 py-2",style:{background:v.c,borderColor:v.b}'
)

count = js.count(old)
if count == 0:
    print("MISS: compass quadrant box code not found")
    print("Looking for:", old[:100])
    sys.exit(1)

js = js.replace(old, new)
print(f"OK: ({count}x) compass quadrant boxes -> inline styles matching quiz page")

with open(BUNDLE, 'w') as f:
    f.write(js)

print("Done!")
