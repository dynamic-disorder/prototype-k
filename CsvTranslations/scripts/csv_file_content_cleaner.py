import csv
import re
from pathlib import Path

def consolidate_csv_files(input_folder, output_file):
    input_folder = Path(input_folder)
    rows = []

    for file in input_folder.glob("*.csv"):
        with file.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()

                # Skip empty lines
                if not line:
                    continue

                # Skip header lines like "từ,định nghĩa"
                if re.match(r'^\s*từ\s*,\s*định nghĩa', line, flags=re.IGNORECASE):
                    continue

                # --- STEP 1: Try normal CSV split ---
                parts = list(csv.reader([line]))[0]

                if len(parts) == 2:
                    word = parts[0].strip()
                    definition = parts[1].strip()
                else:
                    # --- STEP 2: Try to detect first token as the word ---
                    # Word is usually the first token before a space or comma
                    m = re.match(r'^([^, ]+)[ ,](.+)$', line)
                    if m:
                        word = m.group(1).strip()
                        definition = m.group(2).strip()
                    else:
                        # --- STEP 3: Give up → wrap whole line for manual fixing ---
                        rows.append([f'"{line}"'])
                        continue

                # Replace double quotes inside definition
                definition = definition.replace('"', "'")

                # Wrap both columns in double quotes
                word = f'"{word}"'
                definition = f'"{definition}"'

                rows.append([word, definition])

    # Write consolidated CSV
    with open(output_file, "w", encoding="utf-8", newline="") as out:
        writer = csv.writer(out)
        for r in rows:
            writer.writerow(r)


# Example usage:
# consolidate_csv_files("input_csv_folder", "output.csv")
