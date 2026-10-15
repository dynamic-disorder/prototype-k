"""Unify the dictionary so English is always the source column.

Usage:
    python3 scripts/unify_english.py

Rewrites ``translations.csv`` at the repository root in place. Both paths are resolved from this
script's own location, so the working directory does not matter.
"""

import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "local_dev" / "scripts"))
from repo_paths import translations_csv  # noqa: E402

dictionary = translations_csv()

with open(dictionary, 'r', encoding='utf-8') as f:
    reader = csv.reader(f, delimiter=';')
    rows = list(reader)

# Process rows to unify English as source
modified_rows = [rows[0]]  # Keep header
swaps = 0

for row in rows[1:]:
    if row[0] != 'English':
        # Check if English is in the target position
        if row[2] == 'English':
            # Swap source and target
            row = [row[2], row[3], row[0], row[1]]
            swaps += 1
    modified_rows.append(row)

# Write back
with open(dictionary, 'w', encoding='utf-8', newline='') as f:
    writer = csv.writer(f, delimiter=';', quoting=csv.QUOTE_ALL)
    writer.writerows(modified_rows)

print(f'Swapped {swaps} rows to make English the source language')
print(f'CSV file updated: {dictionary}')
