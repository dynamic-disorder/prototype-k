import csv

with open('translations.csv', 'r', encoding='utf-8') as f:
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
with open('translations.csv', 'w', encoding='utf-8', newline='') as f:
    writer = csv.writer(f, delimiter=';', quoting=csv.QUOTE_ALL)
    writer.writerows(modified_rows)

print(f'Swapped {swaps} rows to make English the source language')
print('CSV file updated successfully')
