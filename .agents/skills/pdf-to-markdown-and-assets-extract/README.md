# PDF to Markdown and assets

## Executive summary

Turn a project's PDFs into page-marked Markdown and sidecars with its documented extractor. Inspect the output, prove unchanged documents hash-match, and hand off to the skill that owns the index.

## Problem / Why / What / Verification

| | |
|---|---|
| **Problem** | PDFs must become page-marked Markdown for review and indexing. Ad-hoc conversion hides page boundaries, loses sidecars, and cannot show what changed. |
| **Why** | One documented extractor keeps text, page marks and sidecars consistent; a hash check separates real document changes from toolchain drift. |
| **What** | Validate the input, run the project's extractor, inspect, check repeatability, hand off. Index rebuild and citation gates are out of scope. |
| **Verification** | Every document reports no error; counts are plausible; unchanged `.md` files hash-match the snapshot; extractor version and options are recorded. |

## Import for AI

Copy the whole folder, not only `SKILL.md`. Keep `SKILL.md` at the folder root.

### Global skill

Windows PowerShell:

```powershell
Copy-Item -Recurse "<path-to-this-folder>" "$env:USERPROFILE\.dsh\skills\pdf-to-markdown-and-assets-extract"
```

Linux or macOS:

```bash
cp -R "<path-to-this-folder>" ~/.dsh/skills/pdf-to-markdown-and-assets-extract
```

The skill uses the Python standard library only; there is nothing to install.

### Project skill

```powershell
Copy-Item -Recurse "<path-to-this-folder>" "<project>\.agent\skills\pdf-to-markdown-and-assets-extract"
```

A project copy takes precedence over the global copy. Start a new session after copying so the skill is discovered.

### Rules for the AI

- Copy the folder, not individual files.
- Read the project's `AGENTS.md`, README and extraction script before running anything.
- The project's extractor is project data; this skill supplies the workflow and guard.
- Never fall back to the project's full document set when the input path names no PDF.

## Git

This folder ships a `.gitignore` with:

```gitignore
__pycache__/
*.pyc
test-results/
```

If the skill is merged into a larger repository, add those lines to the repository root `.gitignore` as well. Test runs must not be committed.

## Tests

Each run writes a timestamped folder under `test-results/`.

- `python scripts/run_tests.py` — runs the unit suite and writes the fixture extraction.
- Run folder holds `unit.txt`, `extraction.txt`, `run.json`, and `extracted/`.
- `extracted/` holds the page-marked `.md`, metadata sidecar, summary, and the extracted JPEG.

Timestamp format: `YYYY-MM-DD_HH-mm.sss` (local time). The requested `hh:MM.sss` uses `:` between hours and minutes; it is replaced with `-` because Windows forbids `:` in file names.

## Files

- `SKILL.md` — the workflow the agent follows.
- `README.md` — this import and test guide.
- `scripts/check_input.py` — the input guard.
- `scripts/run_tests.py` — timestamped test runner.
- `tests/` — guard and fixture tests, plus the embedded-PDF fixture.
- `test-results/` — ignored per-run output.
