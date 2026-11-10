# pdf-to-markdown-and-assets-extract

## Executive Summary

Turn a project's PDFs into page-marked Markdown, a metadata sidecar and extracted images by running that project's own documented extractor. A bundled Node guard — with a behaviour-identical Python fallback — refuses an input path that names no PDF, and a hash check proves unchanged documents still match the snapshot. The skill stops at the Markdown and its assets, then hands off to the skill that owns the index.

## Problem / Why / What / Verification

| | |
| :--- | :--- |
| **Problem** | PDFs must become page-marked Markdown for review and indexing. Ad-hoc conversion hides page boundaries, loses the sidecars, and cannot show what changed between runs, so toolchain drift is indistinguishable from a real document change. |
| **Why** | One documented extractor keeps text, page marks and sidecars consistent; a hash comparison separates a document change from extractor drift; a failed or partial run is refused before the index is touched. |
| **What** | Validate the input, run the project's extractor, inspect the output, check repeatability, hand off. Deliberately out of scope: index rebuild, edition decision, citation gates, and reading an arbitrary PDF. |
| **Verification** | The guard exits `0` with `input ok: N PDF(s)`; `0` documents report an error; `0` unchanged `.md` files differ by SHA-256; the extractor version, flags and OCR engine version are recorded; `npm test` reports `fail 0` and `npm run e2e` writes `status: 0`. |

## Import for AI

Copy the whole folder, not only `SKILL.md`. Keep `SKILL.md` at the folder root.

### Global skill

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

### Project skill

Linux or macOS:

```bash
mkdir -p "<project>/.agent/skills"
cp -R "<path-to-this-folder>" "<project>/.agent/skills/pdf-to-markdown-and-assets-extract"
```

Windows PowerShell:

```powershell
Copy-Item -Recurse "<path-to-this-folder>" "<project>\.agent\skills\pdf-to-markdown-and-assets-extract"
```

Windows CMD:

```cmd
xcopy /E /I "<path-to-this-folder>" "<project>\.agent\skills\pdf-to-markdown-and-assets-extract"
```

**Requirements:** Node.js 20 or newer for the guard, the output-contract tests and `npm test` — no dependencies, so never run `npm install`. Python 3.9 or newer is optional and only backs the identical guard fallback (`scripts/check_input.py`) and the parity suite.

Two capabilities are optional and declared explicitly, because each has its own engine and language data:

| Capability | Engine | Fallback / override | Disabled by |
| :--- | :--- | :--- | :--- |
| Page rendering, figure, equation and table cropping | `pdftoppm`, `mutool` or `magick`, on `PATH` or in a standard install folder | Windows built-in `Windows.Data.Pdf`, no install | `PDF_NO_WINDOWS_RASTER=1` (fallback), `PDF_NO_RASTER_INSTALL=1` (install-folder scan) |
| Reading rendered pages and figures | Tesseract 5 with `eng.traineddata`, on `PATH` or in a standard install folder | Windows built-in OCR with a language pack (`en-US`) | `PDF_NO_WINDOWS_OCR=1` (fallback), `PDF_NO_OCR_INSTALL=1` (install-folder scan) |

Display equations need no engine: the LaTeX is rebuilt from the text layer, so a missing renderer costs the `equation-<n>.png` crop and not the formula. Equation crops are not handed to the OCR engine — the LaTeX is already the text, and a recognised formula would be a guess the Markdown must not inherit.

`PDF_RASTER_CMD` and `PDF_OCR_CMD` replace either engine with your own command. Tesseract is looked for on `PATH` first, then in the folders its installers write to — `%ProgramFiles%\Tesseract-OCR` and the other Windows locations, `/opt/homebrew/bin` and `/usr/local/bin` on macOS, `/usr/bin` and `/usr/local/bin` on Linux — so a terminal started before the install still finds it; `ocr.json` records which one ran (`source`, `executable`, `version`). The two OCR engines take different language codes — Tesseract `eng`, Windows `en-US`. Without an engine the step records a skip; text extraction never depends on either.

OCR in a project's own extractor is a separate requirement: Tesseract on `PATH` only when that project documents an OCR flag. A project copy takes precedence over the global copy; start a new session after copying so the skill is discovered.

## Agent Execution Rules

- **Copy the folder, not individual files.** `SKILL.md` must stay at the folder root beside `scripts/` and `tests/`.
- **Read the project first.** Its `AGENTS.md`, README and extraction script define the command, the paths and the flags. This skill supplies the workflow and the guard only.
- **Never fall back to the project's full document set** when the input path names no PDF. Fix the path or stop.
- **Never run extraction from an index build, a watcher or CI** unless the project's decision record says to.
- **Keep task data outside the skill folder.** Scratch copies of previous output belong beside the project documents, not inside the installed skill.
- **Never commit `node_modules/`, `test-results/`, `__pycache__/` or `*.pyc`.** Test runs are regenerable output and the skill has no dependencies to vendor.
- **Never change one guard without the other.** `scripts/check_input.mjs` and `scripts/check_input.py` must keep identical stdout, stderr and exit codes; `npm test` fails when they drift.
- **Never rebuild the index here.** Extraction ends at the Markdown, sidecars and assets, then hands off.

## Git

The folder ships a `.gitignore` with:

```gitignore
__pycache__/
*.pyc
test-results/
node_modules/
```

If the skill is merged into a larger repository, add those lines to the repository root `.gitignore` as well.

## Tests

The unit suite is the default and needs no dependencies:

```bash
npm test
```

It exits `0` and reports `fail 0`. It covers the guard's return values, its three output shapes and its command-line run, then the output contract on four fixtures: a generated one-page PDF, a generated three-page PDF that proves one marker per page with no writer change, and two real PDFs in `tests/resources/` — `embedded-images-tables.pdf` (one page, embedded 1001×673 JPEG) and `multi-column.pdf` (13 pages of two-column paper text, one vector figure, five display equations). Every fixture's expected page count, figure, equation and table counts and Markdown line count come from `tests/fixture-expectations.json`, not from the tests. The math suite names one case per defect: a slot read as ASCII, a script on its own line, a justified run losing its trailing space, a word gap decoded as an arrow, a fraction with its trailing full stop, an accent drawn as a separate glyph. The raster suite covers command splitting, page ordering, the no-tool skip, a stubbed render, a failing renderer, the install-folder discovery that a stale `PATH` needs, the per-platform folder lists and the versioned-folder rule; the OCR suite covers the same skip, stub and failure cases plus the install-folder discovery a stale `PATH` needs, the per-platform folder lists and the Windows engine fallback; the figure suite covers PNG round-trip and crop, box-to-pixel mapping, the fixture's actual figure box, and the equation and table crops beside their blocks.

The Node extractor lays text out from each page's text matrices: lines keep their breaks, kerning no longer splits words, paragraphs stay separate, and rotated sidebar text is quoted at the end of its page instead of being mixed into the body. When a Python interpreter is on `PATH`, a parity case also runs `scripts/check_input.py` and requires identical output; it is skipped, not failed, when Python is absent.

Run one case directly with:

```bash
node --test --test-name-pattern="uppercase" tests/check_input.test.mjs
```

The flag must come before the file path; after it, Node runs the whole suite.

The end-to-end run writes the timestamped artifacts and verifies them:

```bash
npm run e2e
```

It exits `0` and prints `run: <folder>`, one `verify: <fixture> — N page marker(s) ok` line per fixture, and one `raster:`, `figures:`, `equations:`, `tables:` and `ocr:` line per fixture. Each run writes under `test-results/`:

- `unit.txt` — the unit suite output.
- `extraction-<fixture>.txt` — one log per fixture named in `tests/fixture-expectations.json`.
- `run.json` — `kind`, `startedAt`, `tests`, `unitStatus`, `extractionStatus`, `rasterStatus`, `figuresStatus`, `equationsStatus`, `tablesStatus`, `ocrStatus`, `verifyStatus`, `raster`, `figures`, `equations`, `tables` and `ocr` (each fixture's outcome) and the combined `status`; `status` must be `0`.
- `extracted/<fixture>/` — the page-marked `.md` referencing its page images, figures, equations and tables, metadata sidecar, `summary.json`, and `<name>.assets/` holding extracted images, `page-<n>.png` with `raster.json`, `figure-<n>.png` with `figures.json`, `equation-<n>.png` with `equations.json`, `table-<n>.png` with `tables.json`, and `ocr/<image>.txt` with `ocr.json` when an engine ran.

The verification step fails the run when the Markdown's `<!-- page: N -->` markers disagree with the expected page count, or when the cropped figure, equation or table count disagrees with `figures`, `equations` and `tables` in the expectations — the end-to-end proof of the multi-page, figure and equation paths on `multi-column.pdf`.

The Python suite is optional and kept as a reference:

```bash
npm run test:python
```

It exits `0` and prints `OK`. Its writer covers the embedded fixture in a simplified form without layout reconstruction, so its Markdown differs from the Node writer's and is not compared byte for byte; the guard parity case is the cross-language invariant that remains.

Timestamp format: `YYYY-MM-DD_HH-mm.sss` in local time. The hour-to-minute separator is `-` because Windows forbids `:` in file names; a collision appends `-1`, `-2`.

Replacing a fixture PDF takes two edits: drop the new PDF in `tests/resources/`, then add or update its entry in `tests/fixture-expectations.json` with the page count, the equation count and the resulting Markdown line count. The writer walks the PDF's own page tree — nested `/Pages` nodes and compressed object streams included — and emits one marker per page, so a multi-page fixture needs no code change, only the expectations entry.

### Fidelity limits

- **A table is a monospace facsimile of the printed rows, not a Markdown table.** Cells are placed at the columns their x positions name, so a header stays over its numbers and a group label stays between the rows it labels; a table with no rules at all — a header, then one passage per column, each wrapping down its own side — is found from its printed caption, and without rules the page gives no way to prove column boundaries, so nothing is claimed. A ruled table's crop snaps to its own rules and borders, so the frame is part of the image. A cell that is wider in monospace than on the page can push its neighbour one character out. `PDF_TABLE_FORMAT=pipe` writes a Markdown pipe table that a viewer renders, and `PDF_TABLE_FORMAT=csv` writes comma-separated records; both place cells by x position, so `None BM25` can split into two cells, a centred header can land beside its numbers, and a merged cell opens an empty column rather than a span.
- **Formulas are rebuilt as LaTeX from glyph positions, not from the author's source.** A display formula is one `$$ … $$` block: a stroked rule inside it is the fraction bar, a smaller run above or below the line is a script (and its own baseline is the frame for anything nested), a lone raised `^` accents the atom before it, and the printed `(n)` becomes `\tag{n}`. Inline math becomes `$…$`, so `encoderE P (·)which` reads `encoder $E_{P}(\cdot)$ which`. Every display formula is also cropped to `equation-<n>.png` and referenced below its block, so the page, not the reconstruction, is the last word.
- **The TeX fonts are read through their own slot tables.** Text fonts declare `/Differences`, so `fi` and `fl` decode and `efficient` reads correctly. The math fonts declare nothing, so CMSY, CMMI, CMEX and MSAM slots are mapped explicitly; read as ASCII they turn `{` into `f`, `}` into `g`, `,` into `;`, `|` into `j`, `⟨` into `h` and `→` into `!`. A slot outside the mapped range keeps its byte rather than being guessed.
- **Some letters are drawn as vector glyphs, not text.** Any remaining `efcient` is a filled path (a tiny `/Subtype /Form` XObject) rather than text; the raster path renders the page and the OCR path reads it, but OCR output stays beside the image and is never merged into the Markdown.
- **Rotated text is quoted, not placed.** Vertical text appears once per page as `> Vertical text: …`, because a Markdown file has no coordinate system.
- **A formula that stacks without a rule is not rebuilt as an array.** A matrix or a `cases` block keeps its rows in reading order, a script drawn one level deeper than its sibling is flattened into the same slot, and a `\text{…}` word inside a formula survives only when it is a single short word. An equation crop stops at the baseline of the formula above it, so a delimiter taller than that gap is trimmed at the top. These are reconstruction limits, so the equation crop beside the block is the check.
- **`multi-column.pdf` contains no raster images.** It has zero `/Subtype /Image` objects and no inline images; its `/Image` strings are `/ProcSet` names. Its figures — including the plot labelled `k: # of retrieved passages` — are vector drawings inside the Form XObject `/Fm1`, so the asset is cropped from the page render through the form's `/BBox` and written as `figure-1.png`; a vector figure that is not drawn inside a Form is not isolated.

### Raster path

Render pages when text cannot carry what the page shows — vector figures, glyph-drawn ligatures:

```bash
npm run raster -- multi-column "multi-column.assets"
```

`npm run raster` is `node scripts/rasterise.mjs <fixture> <output dir> [--dpi 150]`. It writes `page-<n>.png` plus `raster.json` with the tool, `source`, `version`, `executable`, dpi and page files, then crops each vector figure through its Form `/BBox` into `figure-<n>.png` with `figures.json`. `npm run e2e` renders into each fixture's `<name>.assets/` before extraction, so the Markdown gains a `<!-- page images -->` block and a `<!-- figures -->` block, and a document with only vector figures still ends up with linked assets.

Renderers, in order: `pdftoppm`, `mutool`, `magick` on `PATH`; the same three in a standard install folder; then the Windows built-in `Windows.Data.Pdf` renderer through `scripts/rasterise-win.ps1`, which needs no install. Override with `PDF_RASTER_CMD`, using `{input}`, `{prefix}`, `{assets}` and `{dpi}` placeholders:

```powershell
$env:PDF_RASTER_CMD = '"C:\Program Files\poppler\Library\bin\pdftoppm.exe" -png -r {dpi} {input} {prefix}'
```

Install-folder scan, in this order after `PATH`:

| OS | Folders searched |
| :--- | :--- |
| Windows | `%ProgramFiles%\poppler*\Library\bin`, `%ProgramFiles%\poppler*\bin`, `%ProgramFiles%\ImageMagick*`, `%ProgramFiles%\MuPDF*`, `%ProgramData%\chocolatey\bin`, `%USERPROFILE%\scoop\shims`, `%USERPROFILE%\scoop\apps\poppler\current\bin`, `%LOCALAPPDATA%\Microsoft\WinGet\Links` |
| macOS | `/opt/homebrew/bin`, `/usr/local/bin`, `/opt/local/bin` |
| Linux | `/usr/bin`, `/usr/local/bin`, `/snap/bin`, `/var/lib/flatpak/exports/bin` |

The `*` matches a versioned folder such as `ImageMagick-7.1.1`. Disable the Windows fallback with `PDF_NO_WINDOWS_RASTER=1`, and the install-folder scan with `PDF_NO_RASTER_INSTALL=1`. A missing renderer is a recorded skip (`status: "skipped"`, `source` absent), never a silent success; a renderer that exits non-zero, or returns a page count other than the expected one, fails the run.

Measured on 2026-11-10: the Windows engine rendered 13 pages of `multi-column.pdf` (1654×2339 PNGs of the page), and `pdftoppm` 24.02 on Ubuntu 24.04 under WSL2 rendered the same 13 pages with the same figure cropped — including a run with `PATH` emptied, which found `/usr/bin/pdftoppm` through the install-folder scan and wrote `source: "install"`. Renderers pad page numbers differently — `pdftoppm` writes `page-05.png` where the Windows engine writes `page-5.png` — so the figure crop matches a page by its number, not by its file name.

### OCR path

Read rendered pages and cropped figures when text extraction lost letters to vector glyphs:

```bash
npm run ocr -- "multi-column.assets" "multi-column.assets/ocr"
```

`npm run ocr` is `node scripts/ocr.mjs <image dir> <output dir> [--lang eng]`. `PDF_OCR_CMD` with `{image}`, `{out}` and `{lang}` placeholders replaces everything below it. Otherwise the engine is found in this order: `tesseract` on `PATH` with the matching language data (`-l eng` needs `eng.traineddata`); `tesseract` in a standard install folder; on Windows, the built-in OCR engine, whose language is a BCP-47 tag (`--lang en-US`) rather than a Tesseract code. The install-folder scan is why a `PATH` that predates the install no longer hides an engine; disable it with `PDF_NO_OCR_INSTALL=1`, and the Windows fallback with `PDF_NO_WINDOWS_OCR=1`. It writes `<image>.txt` plus `ocr.json` with engine, `source`, `version`, `executable`, language and character counts, so a run that fell back to the Windows engine says `source: "builtin"`, and a `PATH` engine carries the path `where`/`which` resolved. A missing engine is a recorded skip; a non-zero exit, a missing text file or an empty page fails the run.

OCR text is evidence beside the image, never merged into the Markdown — a recognition error must not become document text. Three engines were measured on 2026-11-10 against the same 14 images of `multi-column.pdf` (13 pages plus `figure-1.png`), and each read all 14: Tesseract 5.4.0.20240606 with `eng.traineddata` on Windows, the Windows built-in engine, and Tesseract 5.3.4 on Ubuntu 24.04 under WSL2. Tesseract's `figure-1.txt` carries the axis label `k: # of retrieved passages` and the `Top-k accuracy (%)` title; its `page-1.txt` carries the paper title, authors and the rotated `arXiv` line; `page-5.txt` carries the table header and its caption.

Install-folder scan, in this order after `PATH`:

| OS | Folders searched |
| :--- | :--- |
| Windows | `%ProgramFiles%\Tesseract-OCR`, `%ProgramFiles(x86)%\Tesseract-OCR`, `%LOCALAPPDATA%\Programs\Tesseract-OCR`, `%LOCALAPPDATA%\Tesseract-OCR`, `%ProgramData%\chocolatey\bin`, `%USERPROFILE%\scoop\shims`, `%USERPROFILE%\scoop\apps\tesseract\current` |
| macOS | `/opt/homebrew/bin`, `/usr/local/bin`, `/opt/local/bin` |
| Linux | `/usr/bin`, `/usr/local/bin`, `/snap/bin`, `/var/lib/flatpak/exports/bin` |

Install Tesseract on Windows with `winget install UB-Mannheim.TesseractOCR`, on Ubuntu with `apt-get install tesseract-ocr tesseract-ocr-eng`, on macOS with `brew install tesseract`. No `PATH` edit is needed: on 2026-11-10 the shell's `PATH` did not carry Tesseract, the end-to-end run found 5.4.0.20240606 in `%ProgramFiles%\Tesseract-OCR`, read all 14 images, and wrote `source: "install"` with the executable path into `ocr.json`.

## Files Index

| Path | Responsibility |
| :--- | :--- |
| `SKILL.md` | The agent workflow: triggers, prerequisites, functional requirements (fidelity table, raster escape hatch, tolerated losses), numbered protocol, error playbook, verification. |
| `README.md` | This import, rules and test guide. |
| `package.json` | `npm test` (unit suite), `npm run e2e` (artifacts, marker, figure and equation verification, raster, crop and OCR steps), `npm run raster` (page rendering), `npm run ocr` (page and figure reading), `npm run test:python` (optional reference); no dependencies. |
| `scripts/check_input.mjs` | The input guard, primary runtime — exits `0` with `input ok: N PDF(s)`, exits `1` with `ERROR: ... names no PDF; extraction not started.` |
| `scripts/check_input.py` | The same guard in Python, for hosts without Node 20+; identical output and exit codes. |
| `scripts/run_tests.mjs` | Thin end-to-end CLI: runs the steps, writes `unit.txt`, `extraction-<fixture>.txt` and `run.json`, prints the run folder, exits with the combined status. |
| `scripts/run-steps.mjs` | The steps as testable functions: run-folder creation, stamp and count parsing, page-render lookup, figure, equation and table cropping, raster, OCR and marker verification. |
| `scripts/rasterise.mjs` | Optional raster path: renders pages with `pdftoppm`, `mutool`, `magick` found on `PATH` or in a standard install folder, a `PDF_RASTER_CMD` override, or the Windows built-in renderer; records tool, source, version, executable, dpi and page files. |
| `scripts/rasterise-win.ps1` | Windows fallback renderer: `Windows.Data.Pdf` through Windows PowerShell, writing one PNG per page with no install. |
| `scripts/ocr.mjs` | Optional OCR path: finds `tesseract` on `PATH` or in a standard install folder, falls back to the Windows OCR engine or `PDF_OCR_CMD`, writes `<image>.txt` and `ocr.json` with the engine, source, version and executable; skips cleanly without an engine. |
| `scripts/ocr-win.ps1` | Windows fallback OCR: `Windows.Media.Ocr` through Windows PowerShell, one text file per image with no install. |
| `scripts/run_tests.py` | The Python equivalent, kept for parity. |
| `tests/check_input.test.mjs` | Node guard tests: single PDF, uppercase `.PDF`, recursive folder, non-PDF, missing path, empty folder, usage, CLI run, Python parity. |
| `tests/extraction.test.mjs` | Output-contract tests for every fixture: page counts, page order, one marker per page, line counts, sidecar and manifest, page-image references; layout assertions (kerning, paragraph breaks, isolated vertical text); the generated multi-page case and the no-image case. |
| `tests/embedded-pdf.mjs` | Fixture-only extractor shared by the contract tests and the fixture writer: page tree, text layout, font-encoding decode, script and word-gap handling, display-equation detection, fenced tables, image and figure boxes, Markdown writer. |
| `tests/math.mjs` | The TeX math-font slot tables (CMSY, CMMI, CMEX, MSAM), the Unicode-to-LaTeX mapping, and the reconstruction of scripts, accents and fractions from run positions. |
| `tests/png.mjs` | Minimal PNG decode/encode/crop used by the figure step; 8-bit RGB and RGBA, no external library. |
| `tests/figures.mjs` | Maps a PDF-point box onto a page render and crops it — the same call writes `figure-<n>.png` and `equation-<n>.png`. |
| `tests/write_fixture_extraction.mjs` | Writes one named fixture's extraction to a directory. |
| `tests/fixture-expectations.json` | The expected page, figure, equation and table counts and the Markdown line count for each fixture — the only place those numbers live; `markdownLines` pins the layout, so a layout change updates this file. |
| `tests/resources/embedded-images-tables.pdf` | Real one-page PDF with an embedded JPEG. |
| `tests/resources/multi-column.pdf` | Real 13-page, two-column paper: exercises multi-page splitting and a document with no image. |
| `tests/raster.test.mjs` | Raster-path tests: command splitting and substitution, natural page order, skip without a tool, install-folder discovery with a stale `PATH`, the per-platform folder lists, the versioned-folder rule, a stubbed render through `PDF_RASTER_CMD`, non-zero exit failure, a real Windows-rendered page, CLI `raster.json`. |
| `tests/ocr.test.mjs` | OCR-path tests: placeholder substitution, skip without images or engine, install-folder discovery with a stale `PATH`, a runnable and a broken install candidate, the per-platform folder lists, version parsing, a stubbed read that writes text, non-zero exit, a missing text file, the Windows engine fallback, CLI `ocr.json`. |
| `tests/figures.test.mjs` | PNG round-trip and crop, PDF-box-to-pixel mapping, figure cropping to disk, the fixture's figure box, and the no-figure fixture. |
| `tests/run-steps.test.mjs` | Step tests: raster/OCR/figure/equation skips and a stubbed OCR run, marker verification, count parsing, crop, and regressions for the two defects a fresh Linux clone exposed — `test-results/` created when absent, and page renders found by number rather than file name (`page-05.png`). |
| `tests/png.test.mjs` | PNG codec: round-trip under every filter type, crop clamping at and beyond the edges, and rejection of non-PNG or unsupported input. |
| `tests/layout.test.mjs` | Table layout: cell splitting from word positions (column gap, word space, padded run), the monospace facsimile, and the CSV and pipe writers with their quoting, alignment rule and header anchoring. |
| `tests/math.test.mjs` | Regression cases for the math path, one per defect: slot tables, roman and bold words, script nesting, accents, fraction splitting, the trailing full stop, equation numbers, line assembly, word spaces, `TJ` gaps, inline `$…$` spans and font-family recognition. |
| `tests/test_check_input.py` | The guard cases against the Python guard. |
| `tests/test_pdf_extraction_fixture.py` | Python contract test for the generated PDF. |
| `tests/test_embedded_pdf_fixture.py` | Python contract test and writer for the embedded-JPEG fixture. |
| `tests/write_fixture_extraction.py` | The Python fixture writer. |
| `.gitignore` | Ignores `__pycache__/`, `*.pyc`, `test-results/` and `node_modules/`. |
| `test-results/` | Ignored per-run output. |

There is no `lib/` folder: each guard is a single file in `scripts/`, and the shared fixture extractor is one file in `tests/`, so the tests import them directly.
