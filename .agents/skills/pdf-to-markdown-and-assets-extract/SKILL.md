---
name: pdf-to-markdown-and-assets-extract
description: Convert a project's PDFs into page-marked Markdown, a metadata sidecar and extracted image assets by running that project's own documented extractor, then prove the run repeatable with a hash check before any index rebuild. Use when a PDF must become page-marked Markdown for reading, review or indexing — a changed regulation, spec or design document, a new document, a refreshed edition, a one-off conversion, or a request phrased as "extract this PDF", "convert these PDFs to Markdown", "refresh the extracted docs", "re-extract the document set" or "extract the images from this PDF". Not for answering what an arbitrary PDF says.
---

# pdf-to-markdown-and-assets-extract

## Executive Summary

Turn a project's PDFs into page-marked Markdown, a `.metadata.json` sidecar and extracted images with that project's documented extractor, then prove unchanged documents still hash-match before handing off to the skill that owns the index. Extraction is the whole deliverable: this skill never rebuilds the index, decides an edition or runs a citation gate.

## When to Use

**Trigger scenarios**

- A PDF in a project document set changed and its page-marked Markdown must be refreshed.
- A new document arrives and no `.md` exists for it yet.
- A document set is being refreshed and the caller needs text, page marks and sidecars regenerated.
- A one-off conversion is requested for a PDF the project already has an extractor for.

**Anti-patterns and out-of-scope**

- **Do not use to read a PDF.** If the task is "what does this PDF say", use the PDF reading tool. This skill is for a project document set with a documented extractor.
- **Do not use to rebuild an index, retag citations or re-verify an index.** Hand off; those belong to the follow-up skill.
- **Never invent an extractor.** When the project documents none, say so in the report and use the bundled one (`scripts/extract-pdf.mjs`), described in step 4; never present it as the project's own.
- **Do not extract the whole document set** because the request named one document.

## Prerequisites & Setup

| Requirement | Why it is needed | If it is missing |
| :--- | :--- | :--- |
| **Node.js 20 or newer** | Runs the guard, the fixture extractor, the raster and OCR steps, and `npm test`. No dependencies, no `npm install`. | Stop: nothing runs. Verified on Node 25.8.2 on 2026-11-10. |
| **Project input** | The project's `AGENTS.md`, README and extraction script carry the command, paths and flags. The workflow is this skill; those details are project data. | Stop and ask which command is canonical; never invent an extractor. |
| **Write access** | To `<source input path>/extracted/` or the documented output folder, its `<name>.assets/` folder for `page-<n>.png`, `figure-<n>.png` and `equation-<n>.png`, and to a scratch directory for the previous output. | Stop: extraction cannot write; do not redirect to an invented folder. |
| **Raster engine (optional)** | Renders pages and feeds figure, equation and table cropping: `pdftoppm`, `mutool` or `magick`, on `PATH` or in a standard install folder (`%ProgramFiles%\poppler*\Library\bin`, `%ProgramFiles%\ImageMagick*`, the Chocolatey, Scoop and WinGet links on Windows; `/opt/homebrew/bin`, `/usr/local/bin` on macOS; `/usr/bin`, `/usr/local/bin` on Linux — the full list is in `README.md` under **Raster path**), or the Windows built-in `Windows.Data.Pdf` engine, which needs no install. Verified on 2026-11-10 with the Windows engine, with `pdftoppm` 24.02 found in `/usr/bin` while `PATH` was empty, and with `pdftoppm` 24.02 on Ubuntu 24.04. | Recorded skip: `raster: skipped`, no `page-<n>.png`, no figure or equation crops. Override `PDF_RASTER_CMD`; disable the Windows fallback with `PDF_NO_WINDOWS_RASTER=1`; disable the install-folder scan with `PDF_NO_RASTER_INSTALL=1`. Renderers pad page numbers differently (`page-5.png` vs `page-05.png`), so cropping matches by page number, not file name. |
| **OCR engine and language data (optional)** | Reads rendered pages and cropped figures: Tesseract 5 with `eng.traineddata` for `-l eng`, or the Windows OCR engine with an installed language pack (BCP-47 tag such as `en-US` — the engines do not share language codes). Found in this order: `PDF_OCR_CMD`, `tesseract` on `PATH`, then the standard install folders — `%ProgramFiles%\Tesseract-OCR` and the other installer locations on Windows, `/opt/homebrew/bin` and `/usr/local/bin` on macOS, `/usr/bin` and `/usr/local/bin` on Linux; the full list is in `README.md` under **OCR path** — so a shell that started before the install still finds an engine that is on disk. Verified on 2026-11-10 with Tesseract 5.4.0.20240606 found in `%ProgramFiles%\Tesseract-OCR` while `PATH` did not carry it (14 images), with the Windows engine, and with Tesseract 5.3.4 on Ubuntu 24.04. | Recorded skip: `ocr: skipped`; text extraction is unaffected. Override with `PDF_OCR_CMD`; disable the Windows fallback with `PDF_NO_WINDOWS_OCR=1`; disable the install-folder scan with `PDF_NO_OCR_INSTALL=1`. |
| **Python 3.9 or newer (optional)** | Backs the identical guard fallback `scripts/check_input.py` and the parity suite; standard library only. | No effect on the Node path; `npm run test:python` is unavailable. |
| **Tesseract for the project's extractor (optional)** | Some project extractors document an OCR flag; that extractor's own OCR runs fail without it. | Its OCR pages fail; this is a different requirement from the skill's OCR path above. |

Display equations need no engine of their own: the LaTeX is rebuilt from the text layer, and a missing raster engine costs the `equation-<n>.png` crop, not the formula. Equation crops are deliberately not handed to the OCR engine — the LaTeX is already the text, and a recognised formula would be a guess the Markdown must not inherit.

There is nothing to install — `npm test` needs no dependencies, so do not run `npm install`. Copy the folder so `SKILL.md` sits at its root:

Linux or macOS:

```bash
cp -R "<path-to-this-folder>" ~/.dsh/skills/pdf-to-markdown-and-assets-extract
```

Windows PowerShell:

```powershell
Copy-Item -Recurse "<path-to-this-folder>" "$env:USERPROFILE\.dsh\skills\pdf-to-markdown-and-assets-extract"
```

Windows CMD:

```cmd
xcopy /E /I "<path-to-this-folder>" "%USERPROFILE%\.dsh\skills\pdf-to-markdown-and-assets-extract"
```

**Which copy to follow.** A project copy under `.agent/skills/` wins over the global copy: read it first, because it carries the project's exact command, paths and handoff. This global copy is the fallback and the generic contract. If you arrived from a follow-up skill that snapshots, decides the edition, calls this one and then re-verifies, follow its handoff contract and return to it afterwards. With no follow-up skill, continue with the project's documented index-and-verify procedure.

## Functional Requirements

Judge the extracted Markdown against the page, never against itself. A PDF stores text as positioned runs, not as lines: line breaks come from text matrices (`Tm`) and relative moves (`Td`, `TD`, `T*`); word gaps are `TJ` adjustments; rotation lives in the matrix (`0 1 -1 0` is a 90° run); `Do` places an XObject and `BI … ID … EI` embeds an image inline. A formula adds two more: a stroked horizontal path (`m`/`l`/`S` or `re`) is a fraction bar, and a run set a few points off the baseline in a smaller size is a script.

**Accepted input.** One PDF, or a folder searched recursively; `.PDF` in any case. A path that names no PDF is refused by the guard with exit `1`.

**Required per document.** `<name>.md` carrying one `<!-- page: N -->` marker per page in page order, a sidecar, one `<name>.extraction-summary.json`, and `<name>.assets/` only when the extractor emits images. When page images were rendered, the Markdown references each one in a `<!-- page images -->` block, so no asset sits on disk unlinked. Every display formula is a `$$ … $$` block with its printed number as `\tag{n}`, every table is a fenced `text` block, and each is followed by its `equation-<n>.png` or `table-<n>.png` crop when pages were rendered. A crop exists only for a block the Markdown emits: a detected formula swallowed by a wider table is cropped by nobody, and `equation-<n>` numbers the emitted blocks, not the detected ones.

| Requirement | Check | Failure looks like |
| :--- | :--- | :--- |
| **Line and paragraph structure** | One Markdown line per visual line, blank line between paragraphs, line count stable across runs | One run-on paragraph per page |
| **Word segmentation** | Real words intact; a small `TJ` adjustment is kerning, a large negative one is a word gap | `suf fers`, `cov erag e`, `Retrie v al` |
| **Rotated runs** | Text drawn at 90° or 270° appears once, outside the body flow | The arXiv sidebar or a figure axis spliced into a sentence |
| **Lists and headings** | List numbers and bullets keep their line and stay attached to their item text | Numbered headings missing their number, items merged into the previous paragraph |
| **Escapes** | `\050` reads `(`, octal and backslash escapes resolve | Literal `\050QA\051` in the output |
| **Glyph-drawn letters** | Missing letters are explained as vector glyphs, never silently dropped | `efcient`, `conguration`, `nd` for `efficient`, `configuration`, `find` |
| **OCR evidence** | Any OCR text sits beside the page image with engine and language recorded, never merged into the Markdown | Recognised text pasted into the document as if the author wrote it |
| **Images and figures** | Every raster image is a file plus a reference; a page with no raster image says so | A figure reference with no file, or silent omission |
| **Vector figures and glyphs** | Transform each figure's Form `/BBox` through the graphics state, crop it from the page render, and record the box | A figure nobody can open, or a raster claimed with no recorded tool |
| **Tables** | One fenced `text` block per table: a monospace facsimile of the printed rows, where every cell keeps the column its x position names, a numeric column stays flush right, and a group label stays between the rows it labels. A table with no rules is found from its caption and its lines in the table's own face. `PDF_TABLE_FORMAT=pipe` writes a Markdown pipe table, and `PDF_TABLE_FORMAT=csv` writes comma-separated records | Columns fused into prose, one run-on line per row, or a formula rendered as a table |
| **Formulas and symbols** | Decode the font's own encoding: `/Differences` glyph names, the CMSY, CMMI, CMEX and MSAM slots, text ligatures | `efcient` for `efficient`, `f q … g` for `{ q … }`, `;` for a comma in a parameter list |
| **Display equations** | One `$$ … $$` block per printed formula, built from glyph positions: a stroked rule gives `\frac`, a smaller raised or lowered run gives `^` or `_`, an isolated `(n)` gives `\tag{n}` | The formula as nine lines of `p` / `+` / `i`, or three rows of a fraction in stream order |
| **Inline math** | A run of TeX faces inside a paragraph is `$…$`, with its scripts attached | `encoderE P (·)which` |
| **Equation images** | Every display equation is cropped to `equation-<n>.png` and referenced directly below its block when pages were rendered | A `$$ … $$` block with no image beside it while renders exist |
| **Table images** | Every table is cropped to `table-<n>.png`, labelled with the number its caption prints and snapped to the table's own rules and borders so its frame is kept, then referenced directly below its block when pages were rendered | A fenced table with no image beside it while renders exist |
| **Page tree** | Page count follows the `/Pages` tree, and `/Contents` arrays are read in order | 6 pages extracted from a 13-page document |
| **Control characters** | No glyph codes leak into the Markdown | Stray control bytes or box glyphs between words |

Structural cases confirmed in the bundled fixtures on 2026-11-10: four `/Pages` nodes with nested `/Kids`, a page whose `/Contents` is an array, `/ObjStm` compressed objects, 8 ligature glyphs drawn as `/Subtype /Form` vector paths, zero raster images, exactly one rotated run per document.

**Escape hatch — raster path.** When text cannot carry what the page shows, render the pages instead of guessing:

```bash
node scripts/rasterise.mjs <fixture> <output dir> --dpi 150
```

It writes `page-<n>.png` into the assets directory and a `raster.json` recording tool, dpi and page files, then crops each vector figure through its Form `/BBox` into `figure-<n>.png` with a `figures.json`, each display equation into `equation-<n>.png` with an `equations.json` holding its LaTeX and its box, and each table into `table-<n>.png` with a `tables.json` recording its box. The Markdown gains a `<!-- page images -->` block, a `<!-- figures -->` block when figures were cropped, each equation's image directly below its `$$ … $$` block, and each table's image directly below its fenced block, so no asset sits on disk unlinked. The renderer is `pdftoppm`, `mutool` or `magick`, on `PATH` or in a standard install folder; on Windows it falls back to the built-in `Windows.Data.Pdf` renderer, which needs no install. Set `PDF_RASTER_CMD` for another command, with `{input}`, `{prefix}`, `{assets}` and `{dpi}` placeholders, `PDF_NO_RASTER_INSTALL=1` to disable the install-folder scan, or `PDF_NO_WINDOWS_RASTER=1` to disable the Windows fallback. `raster.json` records `tool`, `source` (`override`, `path`, `install` or `builtin`), `version`, `executable`, `dpi` and the page files. A missing renderer is a recorded skip, not a failure; a renderer that exits non-zero, or that returns a page count other than the expected one, fails the run. Record tool and dpi in the hand-off report, and never claim a figure, an equation or a table that no image file backs.

**OCR path.** When a page image must become text — ligature letters lost to vector glyphs — read the rendered pages and the cropped figures:

```bash
node scripts/ocr.mjs <image dir> <output dir> --lang eng
```

It uses `tesseract` with the matching language data (`-l eng` needs `eng.traineddata`), found on `PATH` or in a standard install folder, or `PDF_OCR_CMD` with `{image}`, `{out}` and `{lang}` placeholders. On Windows, with no Tesseract, it falls back to the built-in OCR engine, whose language is a BCP-47 tag (`--lang en-US`), not a Tesseract code; disable that fallback with `PDF_NO_WINDOWS_OCR=1`, and the install-folder scan with `PDF_NO_OCR_INSTALL=1`. It writes `<image>.txt` plus an `ocr.json` recording the engine, its `source` (`override`, `path`, `install` or `builtin`), the executable path — resolved with `where` or `which` when the engine came from `PATH` — and its `--version` banner, the language and the character counts. A missing engine is a recorded skip whose reason names both search locations; an engine that exits non-zero, writes no text, or returns an empty page fails the run. OCR text stays beside the page image and is never merged into the `.md`, because a recognition error must not become document text.

**Tolerated losses.** LaTeX is rebuilt from position, not from the author's source, so it is a reconstruction and it fails in named ways. A formula that stacks without a rule — a matrix, a `cases` block — keeps its rows in reading order instead of becoming an array. A script drawn one level deeper than its sibling is flattened into the same slot. A glyph in a font slot that is not mapped keeps the byte the font drew, and a delimiter drawn as a vector path is absent from the text and shows only on the page image. A `\text{…}` word inside a formula is only kept when it is a single short word. A table's column boundaries are not proved — the block is a facsimile, not a claimed grid — so a cell wider in monospace than on the page can push its neighbour one character out, and a table whose columns are ruled by no line and padded by no wide gap is reproduced as the page spaced it rather than as a parsed grid. `PDF_TABLE_FORMAT=pipe` writes a Markdown pipe table for a reader whose viewer renders one, and `PDF_TABLE_FORMAT=csv` writes one comma-separated record per printed row for a consumer that must parse the table. Both place cells by x position, and that inference is visible: a label printed `None BM25` can split into two cells, a header centred over a numeric group lands beside the numbers, and a merged cell opens an empty column rather than a span, because Markdown has no column spans either. Letters drawn as vector glyphs (`efcient`) are unrecoverable by text extraction — the page image is evidence, and OCR reads it separately. The raster path needs a renderer and the OCR path needs an engine plus language data; with either missing the run records the skip instead of failing, and an equation without a render keeps its LaTeX and loses only its image. A figure is cropped from its page render through its Form `/BBox`, so figures drawn outside a Form (or inside a nested form) are not isolated. An equation crop stops at the baseline of the formula above it, so a delimiter taller than that gap is trimmed at the top rather than pulling in a sliver of the previous line.

## Execution Workflow

Run every command from this skill's folder unless a step says otherwise.

### 1. Read the project contract

Read `AGENTS.md`, the README and the extraction script. Record three things before touching a file: the canonical extract command, the documented output folder, and the extractor version. Never guess any of the three.

### 2. Preserve the previous output

When the run overwrites existing Markdown, copy the old `<name>.md`, its sidecar and the previous index manifest to a scratch directory outside the project tree. Extraction overwrites them in place.

A new PDF with no `.md` is expected. A changed PDF with an old `.md` is the normal refresh case. If the new text is a different edition, do not index it under the old id — the project's refresh procedure decides the new id and basename.

### 3. Guard the input

Resolve `<source input path>` from the request and the project documentation: one PDF or a folder. Run the guard — this is the low-freedom step, exact command, no substitution.

Linux, macOS or Windows PowerShell/CMD:

```bash
node scripts/check_input.mjs "<source input path>"
```

The escape hatch is the identical Python guard, whose stdout, stderr and exit codes match the Node one: `python scripts/check_input.py "<source input path>"`. Use it only where Node 20 or newer is unavailable.

| Exit | Output | Meaning |
| :--- | :--- | :--- |
| `0` | `input ok: N PDF(s)` on stdout | Proceed. `N` is your expected document count for step 5. |
| `1` | `ERROR: ... names no PDF; extraction not started.` on stderr | Fix the path. Never fall back to the project's full document set. |
| `1` | `usage: check_input.mjs <source input path>` on stderr | Call the guard with exactly one path argument. |

The guard accepts a PDF file, a folder searched recursively, and a `.PDF` uppercase suffix.

### 4. Extract

Run the project's canonical command with its documented flags. Where the project documents OCR, OCR is the default and the project's own skip flag is the escape hatch. A typical run:

```bash
<extract command> --ocr
```

- OCR is safe on text PDFs: it only applies to scanned or rotated pages. Running without it changes the output for those pages — that is a different configuration, so never mix OCR and non-OCR results in one set.
- A targeted run must preserve the rest of the manifest. Use the project's documented merge option rather than overwriting the summary.
- Never run extraction from an index build, a watcher or CI unless the project's decision record says to.

**When the project documents no extractor, this skill's own is the fallback** — not an invented command. Say in the report that the project carries none, and name the run:

```bash
node scripts/extract-pdf.mjs "<pdf or folder>" "<output dir>" --name <name> --dpi 150
```

It renders the pages, crops every figure, emitted equation and table, and writes `<name>.md`, the sidecar and `<name>.extraction-summary.json`; `--no-raster` skips the renders and their crops. The library behind it is `lib/pdf-extract.mjs`, which the tests exercise; the CLI exists so a project PDF needs no bespoke runner.

Write to the project's documented folder — normally `<source input path>/extracted/`, otherwise `<extracted files path>`. Keep extracted images under `<name>.assets/` and reference each from the `.md`.

### 5. Inspect the run

Read the extractor's stdout plus `<name>.extraction-summary.json` or the manifest.

- **Errors:** every document must report no error. One failure stops the run; never index a partial set.
- **Counts:** pages, text pages, characters and the OCR, retry, fallback and column counts must be plausible against the previous run. A sudden drop is a regression, not a formatting quirk.
- **Toolchain:** compare the extractor version and the flags with the previous run. A change is toolchain drift, not a source change — stop and report it.
- **OCR provenance:** `ocr.json` carries `tool`, `version` and `executable`, so the engine is pinned rather than named. `source: "builtin"` means the run fell back to the Windows engine, not that Tesseract ran.

### 6. Check repeatability

On a refresh a snapshot exists. For every PDF whose source hash did not change, the new `.md` must be byte-identical to the snapshot. Compare hashes, never timestamps.

Linux or macOS:

```bash
sha256sum "<snapshot>/<name>.md" "extracted/<name>.md"
```

Windows PowerShell:

```powershell
Get-FileHash -Algorithm SHA256 "<snapshot>\<name>.md", "extracted\<name>.md"
```

- **Identical hashes:** the rerun is repeatable; continue.
- **Different hashes:** stop. Compare extractor version and flags first — version or flag drift changes the text.

For the document that actually changed, diff the snapshot against the new `.md` and report which sections and pages moved:

```bash
git diff --no-index -- "<snapshot>/<name>.md" "extracted/<name>.md"
```

### 7. Report and hand off

Report the command used, the documents extracted, any error or unexpected count, the unchanged-`.md` hash result, and the extractor version and flags. Then state:

> Extraction complete. If the documents are being refreshed, continue with the project's follow-up skill.

If you came from a follow-up skill, return to it: its next step is the edition decision, then the index. If you only needed the Markdown, stop. Do not rebuild the index or run verification gates here.

## Error-Handling Playbook

| Error or exit code | Likely cause | Correction you take alone |
| :--- | :--- | :--- |
| Guard exits `1`, `names no PDF` | Wrong path, a non-PDF file, or a folder holding no PDF | Re-resolve the path from the request and the project docs, then rerun the guard. Never substitute the full document set. |
| Guard exits `1`, `usage:` | No path argument, or more than one | Pass exactly one quoted path. |
| Guard exits `1` on a folder that looks right | Empty folder or only non-PDF files, searched recursively | Treat as a bad path: re-resolve it, and widen the search only within the folder the request named. |
| One document errors in the manifest | Extractor failure on that file | Stop. Fix or exclude that document with the project's documented exclusion, then rerun the whole set. Do not index a partial set. |
| OCR fails with a Tesseract error, or `ocr.json` names `windows-ocr` | Tesseract is absent, or only the Windows fallback was found | Install it — `winget install UB-Mannheim.TesseractOCR`, `apt-get install tesseract-ocr tesseract-ocr-eng`, `brew install tesseract` — and rerun in the same shell: the install-folder scan finds it without a `PATH` change. Point `PDF_OCR_CMD` at an engine outside those folders. Only rerun without OCR when the project documents non-OCR output as acceptable — and record it as a different configuration. |
| `ocr: skipped` reading `no OCR engine` | No Tesseract on `PATH`, none in a standard install folder, and the Windows fallback is disabled | Install Tesseract or set `PDF_OCR_CMD`. The skip is recorded, not a failure; text extraction is unaffected. |
| Unchanged `.md` differs | Extractor version or flag drift | Stop, diff versions and flags, report the drift. Do not re-baseline the hash without the owner's decision. |
| A document the guard counted has no `<name>.extraction-summary.json` | Partial run or a dropped file | Stop and re-run; report which document is missing. |
| Text is a different edition under the old id | Edition change, not extraction | Leave the id alone and hand the edition decision to the follow-up skill. |
| `npm run e2e` or `npm run test:python` exits non-zero | Unit, extraction or marker-verification failure | Read `test-results/<timestamp>/unit.txt` and the per-fixture `extraction-<fixture>.txt` logs; fix the cause before using the guard in a project. |
| Output is one run-on paragraph per page | Extractor concatenated content-stream literals and ignored text matrices | Re-extract with a layout walker that keeps `Tm`/`Td` line breaks; do not ship the flattened text. |
| Words split (`suf fers`) or merged (`Figure1illustrates`) | Kerning joined with spaces, or runs joined without a gap test | Join `TJ` strings with a space only on large negative adjustments; join runs only across a measured gap. |
| Rotated sidebar or axis text inside a sentence | Rotation read but ignored | Split runs by rotation, keep 90°/270° text out of the body flow, and note where it came from. |
| Letters missing (`efcient`, `nd`) | Ligature drawn as a vector `/Subtype /Form` glyph, not text | Confirm the missing glyphs are form paths, record it as an extraction limit, and never invent the letters. |
| Figure absent although the page shows artwork | Figure is vector art, not a raster image | Run the raster path, record tool and dpi beside the text. With no rasteriser installed, record the skip and report the missing figure. |
| A formula keeps a stray symbol or loses a script | A font slot outside the mapped range, or a script outside the reconstruction band | Check the slot table and the run positions against the `equation-<n>.png` crop. If the slot is unknown, leave the byte and record the loss — never widen a symbol guess to make the output look right. |
| A `$$ … $$` block has no image beside it | The raster step was skipped, or the block's box found no page render | Check `equationsStatus` and `raster` in `run.json`; a skip is recorded, not a failure, and the LaTeX must still be right. |
| Raster path exits non-zero | Rasteriser broken, or `PDF_RASTER_CMD` wrong | Fix or unset the override and rerun. Never report a rendered page you do not have. |
| `raster: skipped` reading `no rasteriser` | None of `pdftoppm`, `mutool` and `magick` is on `PATH` or in a standard install folder, and the Windows fallback is disabled | Install poppler (`apt-get install poppler-utils`, `brew install poppler`, or a Windows build), MuPDF or ImageMagick, or set `PDF_RASTER_CMD`. The skip is recorded, not a failure; text extraction is unaffected. |
| `npm test` fails on the guard parity case | The Node and Python guards drifted apart | Fix both guards to the same messages and exit codes; never change one alone. |
| `node: command not found` | Node 20+ is not installed | Install Node 20 or newer, or run the Python fallback guard for this session and record which one ran. |
| Output folder missing | No `mkdir`, or the wrong documented path | Create the documented folder, never a new one you invented. |

## Verification & Outputs

**Expected outputs** in the documented folder:

| File | Holds |
| :--- | :--- |
| `<name>.md` | Page-marked Markdown: one `<!-- page: N -->` marker per page, opening with page 1; each display formula as a `$$ … $$` block. |
| `<name>.metadata.json` | The document sidecar: id, faces counted, page and text-page counts, image and equation counts. |
| `<name>.assets/` | Extracted images, when the extractor emits them; referenced from the `.md`. |
| `<name>.extraction-summary.json` | One per document: its page, image, equation and table counts. |
| `<name>.assets/equation-<n>.png` | One crop per emitted display formula, numbered in emission order, referenced below its block; `equations.json` records each LaTeX, tag and box. |
| `<name>.assets/table-<n>.png` | One crop per table, in document order, referenced below its fenced block; `tables.json` records each box. |

**Exit criteria — all must hold before hand-off:**

- Guard exited `0`, and each of its `N PDF(s)` has a `<name>.extraction-summary.json`.
- `0` documents report an error.
- `0` unchanged `.md` files differ from the snapshot by hash.
- Every `<name>.md` starts with a page marker, and every referenced asset path exists on disk.
- The extractor version, flags and OCR engine version are written into the report.

**Verify the skill itself** — from this skill's folder:

```bash
npm test
```

It exits `0` and reports `fail 0`. The suite covers the guard's return values, its three output shapes and its command-line run, plus the output contract on four fixtures: two generated PDFs (one page and three pages, proving one marker per page with no writer change) and two real PDFs — one page with an embedded 1001×673 JPEG, and a 13-page two-column paper with no image. Expected page, equation, table and line counts live in `tests/fixture-expectations.json`; `markdownLines` pins the laid-out output, so a layout change updates that file. `tests/math.test.mjs` holds one named case per math defect — a slot read as ASCII, a script on its own line, a justified run losing its trailing space, a word gap decoded as an arrow, a fraction and its trailing full stop, an accent drawn as a separate glyph. When a Python interpreter is on `PATH`, it also runs the Python guard over the same inputs and requires identical output.

The end-to-end run writes the timestamped artifacts and verifies them:

```bash
npm run e2e
```

It exits `0`, prints `run: <folder>`, one `verify: <fixture> — N page marker(s) ok` line per fixture, and one `raster:`, `figures:`, `equations:`, `tables:` and `ocr:` line per fixture. Under `test-results/<YYYY-MM-DD_HH-mm.sss>/` it writes `unit.txt`, `extraction-<fixture>.txt` per fixture, `run.json` and `extracted/<fixture>/` (page-marked `.md` with page-image, figure, equation and table references, sidecar, `<fixture>.extraction-summary.json`, and `<fixture>.assets/` holding extracted images, `page-<n>.png` with `raster.json`, `figure-<n>.png` with `figures.json`, `equation-<n>.png` with `equations.json`, `table-<n>.png` with `tables.json`, and `ocr/<image>.txt` with `ocr.json`). `run.json` must show `status: 0` and `verifyStatus: 0`; `rasterStatus`, `figuresStatus`, `equationsStatus`, `tablesStatus` and `ocrStatus` stay `0` for both a completed step and a recorded skip, while `raster`, `figures`, `equations`, `tables` and `ocr` name each fixture's outcome. A marker count, figure count, equation count, table count, rendered page count or empty OCR page that disagrees with the expectations fails the run.

The Python suite is optional and kept for parity:

```bash
npm run test:python
```

It exits `0` and prints `OK`. Its writer covers the embedded fixture in a simplified form without layout reconstruction, so its Markdown is a reference rather than a byte-for-byte copy of the Node writer's.

**Tolerance.** Byte-identical is the only accepted result for an unchanged document; counts must not fall without an explained cause. When either check fails, stop and report rather than re-baselining.
