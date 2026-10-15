"""Sort the English-Finnish dictionary by its English column, preserving the header.

Usage:
    python3 scripts/sort_translations.py [csv]

With no argument it sorts the repository dictionary. The path is resolved from the script's own
location, so it works from any working directory on any machine.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "local_dev" / "scripts"))
from repo_paths import translations_csv  # noqa: E402


def key_for(line):
    # split on the CSV field separator pattern used: "," (quoted fields)
    parts = line.split('","')
    if len(parts) >= 2:
        k = parts[1]
        # strip any leading/trailing quotes
        return k.strip('"').strip().lower()
    return ""


def main() -> int:
    p = Path(sys.argv[1]) if len(sys.argv) > 1 else translations_csv()
    if not p.is_file():
        print(f"Not found: {p}", file=sys.stderr)
        return 1

    text = p.read_text(encoding="utf-8")
    lines = text.splitlines()
    if not lines:
        raise SystemExit("file empty")
    header = lines[0]
    rows = lines[1:]

    rows_sorted = sorted(rows, key=key_for)
    # Write back preserving original header and line endings
    p.write_text("\n".join([header] + rows_sorted) + "\n", encoding="utf-8")
    print(f"Wrote sorted file with {len(rows_sorted)} rows (header preserved): {p}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
