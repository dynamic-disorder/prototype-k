from pathlib import Path
p = Path(r"c:\code\translations_csv\translations.csv")
text = p.read_text(encoding="utf-8")
lines = text.splitlines()
if not lines:
    raise SystemExit("file empty")
header = lines[0]
rows = lines[1:]

def key_for(line):
    # split on the CSV field separator pattern used: "," (quoted fields)
    parts = line.split('","')
    if len(parts) >= 2:
        k = parts[1]
        # strip any leading/trailing quotes
        return k.strip('"').strip().lower()
    return ""

rows_sorted = sorted(rows, key=key_for)
# Write back preserving original header and line endings
p.write_text("\n".join([header] + rows_sorted) + "\n", encoding="utf-8")
print(f"Wrote sorted file with {len(rows_sorted)} rows (header preserved).")
