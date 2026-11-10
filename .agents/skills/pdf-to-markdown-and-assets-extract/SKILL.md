---
name: pdf-to-markdown-and-assets-extract
description: PDF to Markdown and assets extraction — extract a project's PDFs to page-marked Markdown and sidecars with its documented extractor, inspect the output, and hand off to the project's follow-up skill or index procedure when documents are being refreshed.
---

# PDF to Markdown and assets extraction

## Executive summary

Turn a project's PDFs into page-marked Markdown and sidecars with its documented extractor, then hand off to the skill that owns the index. The work stops at the Markdown and its assets.

## Problem/Background

PDFs must become page-marked Markdown for review and indexing. Ad-hoc conversion hides page boundaries, loses the sidecars, and cannot show what changed between runs. A refresh then cannot separate a document change from toolchain drift.

## Why/Added value

- One documented extractor keeps text, page marks and sidecars consistent.
- A hash check proves unchanged documents are byte-identical, so only real changes move.
- A partial or failed run is refused before the index is touched.
- The edition decision stays with the follow-up skill, not with extraction.

## What/Change

Validate the input, run the project's extractor, inspect the output, check repeatability, and hand off. Index rebuild and citation gates are out of scope.

## Verification/Realisation

- Every document reports no error.
- Counts are plausible against the previous run.
- Unchanged `.md` files hash-match the snapshot.
- The extractor version and options are recorded.

## Top risk

Falling back to the project's full document set extracts documents the request did not name. The input guard stops it.

## When to use

Use when a PDF must become page-marked Markdown for reading or indexing: a changed regulation or design document, a new document, or a one-off conversion.

Not for reading an arbitrary PDF. If the task is "what does this PDF say", use the PDF reading tool; this is for a project document set with a documented extractor.

## Which copy to follow

If the project has its own PDF extraction skill — for example under `.agent/skills/` — read that copy first. It carries the project's exact command, paths and handoff. This global skill is the fallback and the generic contract.

If a follow-up skill owns the refresh — it snapshots, decides the document edition, calls this one, then rebuilds and re-verifies — follow its handoff contract. If you arrived from it, return after the handoff. If the project has no follow-up skill, use its documented index-and-verify procedure.

## Before running

- Read the project's `AGENTS.md`, README and extraction script. The workflow is the contract; the command is project data.
- Never open the PDF directly when the extractor can produce the text. The page-marked `.md` is the read surface.
- If this extraction replaces existing Markdown, copy the old `.md`, its sidecar and the previous index manifest to a scratch directory. Extraction overwrites them.
- A new PDF with no `.md` is expected. A changed PDF with an old `.md` is the normal refresh case.
- If the new text is a different edition, do not index it under the old id. The project's refresh procedure decides the new id and basename.
- Record the canonical command and extractor version before running.

## Validate the input source

Resolve `<source input path>` from the request and the project's documentation. It may be one PDF or a folder. Run the guard from this skill's folder:

```bash
python scripts/check_input.py "<source input path>"
```

It prints `input ok: N PDF(s)` and exits 0. A missing path, a non-PDF file, or a folder with no PDF exits 1 with `ERROR: ... names no PDF; extraction not started.` Do not fall back to the project's full document set.

## Workflow

### 1. Extract

Run the project's canonical command with its documented flags. `<extract command>` is project data; a typical run with OCR looks like:

```bash
<extract command> --ocr
```

- Where documented, an OCR flag is safe on text PDFs and only runs on scanned or rotated pages; it requires Tesseract.
- Skipping OCR changes the output for scanned or rotated pages. Treat that as a different configuration; do not mix results.
- A targeted run must preserve the rest of the summary; use the project's documented merge option.
- Never run extraction from the index, a watcher or CI unless the project's decision record says to.
- When the extractor emits images, keep them under `<name>.assets/` and reference them from the `.md`.

Write output where the project documents it. The usual layout is `<source input path>/extracted/` with `<name>.md`, `<name>.metadata.json` and a summary manifest; use `<extracted files path>` elsewhere. Do not invent a different extractor.

### 2. Inspect

Read the extractor's stdout and its summary or manifest.

- Every document must report no error. One failure means stop; do not index a partial set.
- Page count, text pages, characters and OCR/retry/fallback/column counts must be plausible against the previous run. A sudden drop is a regression.
- Compare extractor version and options with the previous run. A change is toolchain drift, not a source change; stop and explain it.
- Record the OCR engine version when OCR ran; "tesseract" alone does not pin it.

### 3. Check repeatability

On a refresh a snapshot exists: for every PDF whose source hash did not change, the new `.md` must be byte-identical to the snapshot. Compare hashes, not timestamps.

- Identical: the rerun is repeatable.
- Different: stop. Compare extractor version and options; version or flag drift changes the text.

For the document that changed, diff the snapshot and the new `.md` to see which sections and pages moved.

## Outputs

- `<name>.md` — page-marked Markdown.
- `<name>.metadata.json` — the document sidecar.
- `<name>.assets/` — extracted images, when the extractor emits them.
- `summary.json` — the run manifest.

## Failure modes

| Symptom | Likely cause | Action |
|---|---|---|
| `names no PDF` | wrong path, non-PDF, empty folder | fix the input; do not fall back to the full set |
| one document errors | extractor failure | stop; do not index a partial set |
| unchanged `.md` differs | version or flag drift | stop; explain before proceeding |
| new edition under old id | edition change | let the follow-up skill decide the new id |

## Hand off

When the checks pass, report:

- the command used and documents extracted;
- any error or unexpected count;
- the unchanged-`.md` hash result;
- the extractor version and options recorded.

Then say:

> Extraction complete. If the documents are being refreshed, continue with the project's follow-up skill.

If the project has no follow-up skill, continue with its documented index-and-verify procedure.

Do not rebuild the index or run the verification gates here. If you came from a follow-up skill, return to it; its next step is the edition decision, then the index. If you only needed the Markdown, stop.

## Files

- `SKILL.md` — the workflow the agent follows.
- `README.md` — import and test guide.
- `.gitignore` — ignores `test-results/`, `__pycache__/` and `*.pyc`.
- `scripts/check_input.py` — the input guard.
- `scripts/run_tests.py` — timestamped test runner.
- `tests/` — guard and fixture tests.

## Tests

Run `python scripts/run_tests.py` from this skill's folder. It writes a timestamped run under `test-results/` with `unit.txt`, `extraction.txt`, `run.json` and `extracted/` (page-marked Markdown, sidecar, summary and JPEG).
