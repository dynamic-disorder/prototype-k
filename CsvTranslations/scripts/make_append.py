"""Convert a two/three-column source list into quoted English/Finnish CSV rows.

Usage:
    python3 scripts/make_append.py [source] [output]

Defaults to reading the repository dictionary and writing into the git-ignored scratch directory.
Both paths are resolved from the script's own location, so nothing is machine-specific.
"""

import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "local_dev" / "scripts"))
from repo_paths import local_user_files, translations_csv  # noqa: E402


def main() -> int:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else translations_csv()
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else local_user_files() / "to_append.csv"

    if not src.is_file():
        print(f"Not found: {src}", file=sys.stderr)
        return 1

    out.parent.mkdir(parents=True, exist_ok=True)

    rows = []
    with open(src, newline='', encoding='utf-8') as f:
        reader = csv.reader(f)
        for r in reader:
            if not r:
                continue
            # join extra columns into second field if more than 2
            if len(r) == 1:
                eng = r[0].strip()
                fin = ""
            else:
                eng = r[0].strip()
                fin = ",".join([c.strip() for c in r[1:]])
            rows.append(("English", eng, "Finnish", fin))

    with open(out, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f, quoting=csv.QUOTE_ALL)
        for r in rows:
            writer.writerow(r)

    print(f"Wrote {len(rows)} rows to {out}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
