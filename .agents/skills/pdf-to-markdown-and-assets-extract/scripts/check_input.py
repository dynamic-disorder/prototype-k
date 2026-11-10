#!/usr/bin/env python3
"""Fail fast when an input path names no PDF.

Usage:
    python scripts/check_input.py "<source input path>"

Exit 0 when the path is a PDF or a folder containing PDFs; exit 1 otherwise.
"""
from __future__ import annotations

import sys
from pathlib import Path


def find_pdfs(path: str | Path) -> list[Path]:
    """Return the PDFs named by path: the file itself, or every PDF under a folder."""
    root = Path(path)
    if root.is_file() and root.suffix.lower() == ".pdf":
        return [root]
    if root.is_dir():
        return sorted(
            candidate
            for candidate in root.rglob("*")
            if candidate.is_file() and candidate.suffix.lower() == ".pdf"
        )
    return []


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("usage: check_input.py <source input path>", file=sys.stderr)
        return 1

    source = Path(argv[1])
    pdfs = find_pdfs(source)
    if not pdfs:
        print(f"ERROR: {source.as_posix()} names no PDF; extraction not started.", file=sys.stderr)
        return 1

    print(f"input ok: {len(pdfs)} PDF(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
