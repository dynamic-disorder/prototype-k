"""Write the embedded-PDF fixture extraction to a directory for inspection.

Usage (from the skill folder):
    python tests/write_fixture_extraction.py <output dir>
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from test_embedded_pdf_fixture import PDF, write_extraction  # noqa: E402


def main(argv):
    if len(argv) < 2:
        print("usage: write_fixture_extraction.py <output dir>", file=sys.stderr)
        return 1
    out_dir = Path(argv[1])
    out_dir.mkdir(parents=True, exist_ok=True)
    md, meta, summary, image = write_extraction(PDF.read_bytes(), out_dir)
    print(f"wrote {md}")
    print(f"wrote {meta}")
    print(f"wrote {summary}")
    print(f"wrote {image}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
