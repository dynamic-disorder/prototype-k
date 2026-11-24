---
name: docx-to-markdown-and-assets-extract
description: Convert Word documents (.docx, legacy .doc via LibreOffice) into section-marked Markdown with a metadata sidecar, extraction summary and extracted images, one folder per document, using a dependency-free Node extractor. Use when "extract this docx", "convert these Word files to Markdown", "turn the DOCX into text for the index". Not for reading a document to answer a question, not for PDF, not for rebuilding an index.
---

# docx-to-markdown-and-assets-extract

Extraction is the whole deliverable. Full contract, requirement table, error playbook and tolerated losses: `references/full-contract.md`. Deep detail: `README.md`.

New machine: the user follows `required_install-docx-to-markdown-and-assets-extract.txt`.

## Rules

- Never extract a whole folder because the request named one file.
- A DOCX has no pages: the Markdown carries `<!-- section: N -->` markers, never page numbers.
- Node 20+ only, no `npm install`. LibreOffice `soffice` is optional and only needed for legacy `.doc` (without it, `.doc` is refused with one line; `.docx` still works).
- Use `--output <dir>` for one document only.

## Steps

Set `SK` to the folder that holds this file (default `~/.agents/skills/docx-to-markdown-and-assets-extract`).

1. **Guard:** `node $SK/scripts/check-input.mjs "<path>"`. Exit 1 means no Word file or bad usage: re-resolve the path.
2. **Refresh only:** keep the old `.md` outside the project for hash comparison.
3. **Extract:** `node $SK/scripts/extract-docx.mjs "<path>" [--output <dir>] [--name <id>]`
   - Output per document, beside the source: `<name>.md`, `<name>.metadata.json`, `<name>.extraction-summary.json`, `<name>.assets/`.
4. **Inspect:** a zero count where the document plainly has a table, heading or image is a defect. Footnotes sit under `<!-- footnotes -->`.
5. **Repeatability:** re-run an unchanged document and compare SHA256 of the `.md`. A difference means extractor drift: stop and report.
6. **Report:** command, documents, counts, hash result, extractor version.

## Tolerated losses

Tracked changes reported, not applied. Comments counted, not extracted. Text boxes, shapes, SmartArt not read. Merged cells repeat their text. Images are extracted, never OCR'd.

## Verify the skill

`cd $SK && npm test` (exit 0).
