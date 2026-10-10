import re

INFILE = r"c:\code\temp\OCR translations.txt"
OUTFILE = r"c:\code\translations_csv\translations.csv"

def clean(s):
    return s.strip().strip('"').strip()

def split_by_sep(line):
    for sep in [',',';']:
        if sep in line:
            before, after = line.split(sep,1)
            return before.strip(), after.strip(), sep
    return None

def quote_if_needed(s):
    if ',' in s or '"' in s or '\n' in s:
        return '"' + s.replace('"','""') + '"'
    return s

def main():
    with open(INFILE, 'r', encoding='utf-8') as f:
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
                pairs.append((eng,fin))
                i += 1
            else:
                eng = clean(before)
                if i+1 < len(items):
                    fin = clean(items[i+1])
                    pairs.append((eng,fin))
                    i += 2
                else:
                    pairs.append((eng,''))
                    i += 1
            continue

        tokens = line.split()
        if len(tokens) == 1:
            eng = clean(line)
            if i+1 < len(items):
                fin = clean(items[i+1])
                pairs.append((eng,fin))
                i += 2
            else:
                pairs.append((eng,''))
                i += 1
        else:
            # split multiword into two halves (heuristic)
            n = len(tokens)
            mid = n//2
            eng = ' '.join(tokens[:mid])
            fin = ' '.join(tokens[mid:])
            pairs.append((clean(eng), clean(fin)))
            i += 1

    # simple postprocessing: drop completely empty pairs and dedupe while preserving order
    seen = set()
    cleaned = []
    for a,b in pairs:
        if not a and not b:
            continue
        key = (a.lower(), b.lower())
        if key in seen:
            continue
        seen.add(key)
        cleaned.append((a,b))

    with open(OUTFILE, 'w', encoding='utf-8', newline='') as out:
        for a,b in cleaned:
            out.write(f"{quote_if_needed(a)},{quote_if_needed(b)}\n")

    print(f"Wrote {len(cleaned)} pairs to {OUTFILE}")

if __name__ == '__main__':
    main()
