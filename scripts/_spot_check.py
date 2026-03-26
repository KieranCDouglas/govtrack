#!/usr/bin/env python3
"""Spot-check notable members on the political compass."""
import json

with open('data/members-current.json') as f:
    members = json.load(f)

# Notable members to check
checks = [
    # Progressive Dems
    "Alexandria Ocasio-Cortez", "Ilhan Omar", "Rashida Tlaib", "Ayanna Pressley",
    "Bernie Sanders", "Elizabeth Warren", "Ed Markey",
    # Moderate Dems  
    "Jared Golden", "Henry Cuellar", "Marie Perez", "Don Davis", 
    "Josh Gottheimer", "Elissa Slotkin", "John Fetterman",
    "Mark Kelly", "Ruben Gallego", "Joe Manchin",
    # Moderate R
    "Brian Fitzpatrick", "Don Bacon", "Mike Lawler",
    # Conservative R
    "Lauren Boebert", "Marjorie Taylor Greene", "Jim Jordan",
    "Matt Gaetz", "Andy Biggs", "Ted Cruz", "Josh Hawley",
    # Libertarian-leaning R
    "Thomas Massie", "Rand Paul",
    # Ex D now R
    "Jefferson Van Drew",
]

print(f"{'Name':<30s} {'Party':>5s} {'X (Econ)':>10s} {'Y (Social)':>10s} {'Chamber':>8s}")
print("-" * 70)
for name in checks:
    key = name.lower()
    found = None
    for m in members:
        if key in m['displayName'].lower() or m['displayName'].lower() in key:
            found = m
            break
    if found:
        print(f"{found['displayName']:<30s} {found['party'][:3]:>5s} {found.get('compassX', 0):>+10.3f} {found.get('compassY', 0):>+10.3f} {found.get('chamber', '?'):>8s}")
    else:
        print(f"{name:<30s}  NOT FOUND")
