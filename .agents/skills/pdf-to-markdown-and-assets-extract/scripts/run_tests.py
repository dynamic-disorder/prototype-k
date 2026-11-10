#!/usr/bin/env python3
"""Run the PDF unit suite and fixture extraction into a timestamped run folder."""
from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def timestamp(now: datetime) -> str:
    return now.strftime("%Y-%m-%d_%H-%M.") + f"{now.microsecond // 1000:03d}"


def create_run_dir(root: Path) -> Path:
    base = root / "test-results" / timestamp(datetime.now())
    run_dir = base
    suffix = 1
    while run_dir.exists():
        run_dir = Path(f"{base}-{suffix}")
        suffix += 1
    run_dir.mkdir(parents=True)
    return run_dir


def run(command, run_dir: Path, log_name: str):
    started = datetime.now()
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
    output = result.stdout + result.stderr
    (run_dir / log_name).write_text(output, encoding="utf-8")
    print(output, end="")
    return result.returncode, started


def main() -> int:
    run_dir = create_run_dir(ROOT)

    unit_status, unit_started = run(
        [sys.executable, "-m", "unittest", "discover", "-s", "tests", "-v"],
        run_dir,
        "unit.txt",
    )
    extraction_status, _ = run(
        [
            sys.executable,
            "tests/write_fixture_extraction.py",
            str(run_dir / "extracted" / "embedded-images-tables"),
        ],
        run_dir,
        "extraction.txt",
    )

    status = unit_status or extraction_status
    unit_text = (run_dir / "unit.txt").read_text(encoding="utf-8")
    match = re.search(r"Ran (\d+) tests", unit_text)
    (run_dir / "run.json").write_text(
        json.dumps(
            {
                "kind": "pdf-unit",
                "startedAt": unit_started.isoformat(),
                "tests": int(match.group(1)) if match else None,
                "unitStatus": unit_status,
                "extractionStatus": extraction_status,
                "status": status,
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"run: {run_dir}")
    return status


if __name__ == "__main__":
    sys.exit(main())
