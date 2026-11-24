---
name: pdf-to-markdown-and-assets-extract
description: Convert PDFs into page-marked Markdown, a metadata sidecar and extracted images (figures, equations, tables) with the bundled dependency-free Node extractor, then prove an unchanged document converts byte-identically. Use when "extract this PDF", "convert these PDFs to Markdown", "refresh the extracted docs", "extract the images from this PDF". Not for answering what a PDF says (read it instead) and not for rebuilding an index.
---

# pdf-to-markdown-and-assets-extract

Extraction is the whole deliverable. Never rebuild an index, decide an edition or run a citation gate here. Full contract, flags, error playbook and tolerated losses: `references/full-contract.md` (read the section you need, not the whole file). Deep detail: `README.md`.

New machine: the user follows `required_install-pdf-to-markdown-and-assets-extract.txt`.

## Rules

- Never invent an extractor. If the project documents one (`AGENTS.md`, README), use it. Otherwise use the bundled one and say so in the report.
- Never extract a whole folder because the request named one PDF.
- OCR text stays beside the page image and is never merged into the `.md`.
- Ask before `--move-source` or `--move` (they move the user's files). Never claim a figure, equation or table that no image file backs.
- Node 20+ only. No `npm install`. Raster engine (`pdftoppm`, `mutool`, `magick` or Windows built-in) and OCR (Tesseract) are optional: a missing one is a recorded skip, not a failure.

## Steps

Set `SK` to the folder that holds this file (default `~/.agents/skills/pdf-to-markdown-and-assets-extract`).

1. **Guard the input:** `node $SK/scripts/check_input.mjs "<pdf or folder>"`. Exit 0 prints `input ok: N PDF(s)` (N is the expected document count). Exit 1: fix the path, never widen it.
2. **Refresh only:** copy the old `<name>.md` and sidecar to a scratch folder outside the project.
3. **Extract:** `node $SK/scripts/extract-pdf.mjs "<pdf or folder>" [--name <id>] [--dpi 150]`
   - Output: one `<name>/` folder per PDF beside the source with `<name>.md` (one `<!-- page: N -->` per page), `<name>.metadata.json`, `<name>.extraction-summary.json`, `<name>.assets/`.
   - Flags: `--no-raster`, `--no-reuse-raster`, `--no-accessibility-assets`, `--drop-relative-urls`, `--move-source` (ask first).
   - Source already Markdown: `node $SK/scripts/bundle-markdown.mjs "<file.md or folder>" --name <id>`.
4. **Inspect:** read the summary. Zero errors; counts plausible against the previous run; read `quality.warnings` (fused words) and report them.
5. **Repeatability (refresh):** `sha256sum` old vs new `.md` for each unchanged source. A difference means extractor or flag drift: stop and report, never re-baseline.
6. **Report:** command, documents, counts, hash result, `extractorVersion`, raster and OCR tool.

## Common failures

- Guard `names no PDF`: wrong path. Re-resolve it.
- `ocr: skipped` or `raster: skipped`: engine missing. Install it or set `PDF_OCR_CMD` / `PDF_RASTER_CMD`; text extraction is unaffected.
- `refusing to overwrite`: move the old file aside. Never delete the user's file.
- Two names map to one folder: rename one or pass `--name`.

## Verify the skill

`cd $SK && npm test` (expect `fail 0`). `npm run e2e` writes artifacts under `test-results/`.
