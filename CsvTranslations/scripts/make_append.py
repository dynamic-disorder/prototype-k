import csv

SRC = r"c:\code\translations_csv\translations.csv"
OUT = r"c:\code\temp\to_append.csv"

def main():
    rows = []
    with open(SRC, newline='', encoding='utf-8') as f:
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

    with open(OUT, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f, quoting=csv.QUOTE_ALL)
        for r in rows:
            writer.writerow(r)

    print(f"Wrote {len(rows)} rows to {OUT}")

if __name__ == '__main__':
    main()
