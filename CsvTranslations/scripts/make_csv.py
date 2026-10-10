"""Convert an OCR'd English/Finnish text dump into CSV rows.

Usage:
    python3 CsvTranslations/scripts/make_csv.py <input.txt> [output.csv]

The input is an external text file, so it is required. The output defaults to the git-ignored
scratch directory rather than the repository dictionary, so a mistake cannot overwrite it.
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "local_dev" / "scripts"))
from repo_paths import local_user_files  # noqa: E402


def clean(s):
    return s.strip().strip('"').strip()


def split_by_sep(line):
    for sep in [',', ';']:
        if sep in line:
            before, after = line.split(sep, 1)
            return before.strip(), after.strip(), sep
    return None


def quote_if_needed(s):
    if ',' in s or '"' in s or '\n' in s:
        return '"' + s.replace('"', '""') + '"'
    return s


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__.strip(), file=sys.stderr)
        return 2

    infile = Path(sys.argv[1])
    outfile = Path(sys.argv[2]) if len(sys.argv) > 2 else local_user_files() / "translations_from_ocr.csv"

    if not infile.is_file():
        print(f"Not found: {infile}", file=sys.stderr)
        return 1

    outfile.parent.mkdir(parents=True, exist_ok=True)

    with open(infile, 'r', encoding='utf-8') as f:
        raw = [ln.rstrip() for ln in f]

    items = [ln.strip() for ln in raw if ln and ln.strip()]

    pairs = []
    i = 0
    while i < len(items):
        line = items[i]
        sep_split = split_by_sep(line)
        if sep_split:
            before, after, sep = sep_split
            if after:
                eng = clean(before)
                fin = clean(after)
                pairs.append((eng, fin))
                i += 1
            else:
                eng = clean(before)
                if i + 1 < len(items):
                    fin = clean(items[i + 1])
                    pairs.append((eng, fin))
                    i += 2
                else:
                    pairs.append((eng, ''))
                    i += 1
            continue

        tokens = line.split()
        if len(tokens) == 1:
            eng = clean(line)
            if i + 1 < len(items):
                fin = clean(items[i + 1])
                pairs.append((eng, fin))
                i += 2
            else:
                pairs.append((eng, ''))
                i += 1
        else:
            # split multiword into two halves (heuristic)
            n = len(tokens)
            mid = n // 2
            eng = ' '.join(tokens[:mid])
            fin = ' '.join(tokens[mid:])
            pairs.append((clean(eng), clean(fin)))
            i += 1

    # simple postprocessing: drop completely empty pairs and dedupe while preserving order
    seen = set()
    cleaned = []
    for a, b in pairs:
        if not a and not b:
            continue
        key = (a.lower(), b.lower())
        if key in seen:
            continue
        seen.add(key)
        cleaned.append((a, b))

    with open(outfile, 'w', encoding='utf-8', newline='') as out:
        for a, b in cleaned:
            out.write(f"{quote_if_needed(a)},{quote_if_needed(b)}\n")

    print(f"Wrote {len(cleaned)} pairs to {outfile}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
