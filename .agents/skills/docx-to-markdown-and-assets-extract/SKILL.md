---
name: docx-to-markdown-and-assets-extract
description: Convert Word documents (.docx, and legacy .doc through LibreOffice) into section-marked Markdown with a metadata sidecar, an extraction summary and extracted image assets, one folder per document. Use when a DOCX must enter a knowledge corpus, when a Word document changed and its Markdown must be refreshed, when a folder of Word files needs converting in one command, or when a request says "extract this docx", "convert these Word files to Markdown", "turn the DOCX into text for the index".
---

# docx-to-markdown-and-assets-extract

## Executive Summary

Turn Word documents into section-marked Markdown, a metadata sidecar, an extraction summary and extracted
images, one folder per document beside its source, and prove that an unchanged document converts
byte-identically. Extraction is the whole deliverable: this skill never rebuilds an index and never decides
what a document means.

## When to Use

- A DOCX must become text a knowledge index can read.
- A Word document changed and its Markdown must be refreshed.
- A folder of Word files needs converting in one run.
- A single document needs its tables, figures or footnotes carried into Markdown.

**Anti-patterns.** Do not use this to read a document for a question — open it and read it. Do not use it
to rebuild an index; hand off to whatever owns the index. Do not extract a whole folder because the request
named one file. Do not use it for PDF; `pdf-to-markdown-and-assets-extract` owns that.

## Prerequisites & Setup

| Requirement | Why | If missing |
| :--- | :--- | :--- |
| **Node.js 20 or newer** | Runs the guard, the extractor and `npm test`. No dependencies, no `npm install`. | Stop; nothing runs. |
| **Write access** beside the source, or to `--output` | The extractor writes `<name>/` and `<name>.assets/`. | Stop; do not redirect to an invented folder. |
| **LibreOffice `soffice` (optional)** | Converts a legacy `.doc` to `.docx` before extraction. | Recorded refusal, one line, naming the file; `.docx` files still convert. |

## Functional Requirements

**Accepted input.** One `.docx` or `.doc`, or a folder searched recursively; case-insensitive. A path
with no Word document is refused before anything is written.

**Required output per document** — `<name>/` beside its source, or under `--output`:

- `<name>.md` — section markers `<!-- section: N -->` in document order, headings as `#`, lists as
  `-` / `1.`, tables as pipe tables, images referenced as `<name>.assets/image-<n>.<ext>`, footnotes
  collected under `<!-- footnotes -->` instead of being inlined.
- `<name>.extraction-summary.json` — counts, source hash, extractor version, converter when one ran.
- `<name>.metadata.json` — the document id and the structure counts.
- `<name>.assets/` — one file per embedded image, each referenced from the Markdown.

**A DOCX has no pages.** Pagination belongs to a renderer, so the Markdown carries section markers, never
page numbers. A page break in the source starts a new block and is counted in the summary.

| Requirement | Check | Failure looks like |
| :--- | :--- | :--- |
| Body order | Paragraphs, tables and images appear where the document puts them | A table lifted above the paragraph that introduces it |
| Headings | `Heading 1..6` styles become `#`..`######` with a section marker | All text flat, one section marker |
| Lists | Bullet and numbered paragraph styles keep their marker | Numbered steps merged into a paragraph |
| Tables | One pipe row per printed row, pipes escaped | Columns fused into prose |
| Images | Every embedded image is a file plus a reference | A reference with no file, or silent omission |
| Footnotes | Collected by id under `<!-- footnotes -->` | Footnote text spliced into the sentence |
| Line breaks | A break inside a paragraph starts a new block | Two names run together on one line |
| Repeatability | An unchanged source converts byte-identically | Two runs differ |

**Escape hatch.** `--output <dir>` writes one document into a folder of your choosing; `--name <id>`
overrides the portable folder name. Use `--output` for one document only.

**Tolerated losses.** Tracked changes are reported, not applied. Comments are counted, not extracted. Text
boxes, shapes and SmartArt are not read. A merged table cell repeats its text in each column it spans.
Images are extracted, never described or OCR'd. Legacy `.doc` relies on LibreOffice's conversion, so a
document with features LibreOffice drops loses them at that step.

## Execution Workflow

1. **Guard the input.** `node scripts/check-input.mjs "<path>"` — the same output and exit codes as the PDF
   skill's guard.
2. **Record the previous output** when refreshing, outside the project tree, so hashes can be compared.
3. **Extract.** `node scripts/extract-docx.mjs "<path>"` — add `--output` or `--name` only as the
   request needs.
4. **Inspect the run.** Read the summary: sections, headings, tables and images must be plausible against
   the document. A zero where the document plainly has a table is a defect, not a formatting choice.
5. **Check repeatability.** Re-run an unchanged document and compare SHA256 of the `.md`. Different hashes
   mean the extractor changed, not the document.
6. **Report and hand off.** Give the command, the documents, the counts, the hash result and the version.
   Continue with whatever owns the index.

## Error-Handling Playbook

| Error or exit code | Cause | Correction |
| :--- | :--- | :--- |
| Guard exits `1`, "names no .docx or .doc" | Wrong path, or a folder with no Word file | Re-resolve the path; never substitute a whole folder |
| Guard exits `1`, `usage:` | No path, or more than one | Pass exactly one quoted path |
| `zip: no end-of-central-directory record` | The file is not a DOCX, or is a renamed ZIP of something else | Open it as what it is; do not force the extractor |
| "legacy .doc and no LibreOffice" | `soffice` is not installed | Install LibreOffice or save the file as `.docx` |
| "both map to <name>" | Two documents share a portable name | Rename one, or extract them one at a time with `--name` |
| An unchanged document converts differently | Extractor or fixture drift | Stop and report the drift; do not re-baseline silently |

## Verification & Outputs

From the skill folder:

```bash
npm test
```

It exits 0 with the fixtures green: headings and section order, list markers, a table, an embedded image
with its asset reference, a page break, a refused non-DOCX, and the guard's three answers. It also proves an
unchanged document converts byte-identically, which is the only accepted result for a repeat run.
