# docx-to-markdown-and-assets-extract

Converts Word documents into section-marked Markdown with a sidecar, an extraction summary and extracted
images — one folder per document, no dependencies, Node 20 or newer.

## Problem, Why, What, Verification

| | |
| :--- | :--- |
| **Problem** | A DOCX is a ZIP of XML that no index can read, and the PDF skill covers only PDF. |
| **Why** | One command puts a Word document into a corpus with its tables, images and footnotes intact, and an unchanged document converts byte-identically. |
| **What** | Headings, paragraphs, lists, tables, images, footnotes and section markers; `.doc` through LibreOffice; a guard; a test suite with fixtures. |
| **Verification** | `npm test` is green, and a real document converts twice with identical SHA256. |

## Import for AI

Copy the whole folder, not only `SKILL.md`. Keep `SKILL.md` at the folder root.

### Global skill

Linux or macOS:

```bash
cp -R "<path-to-this-folder>" ~/.agents/skills/docx-to-markdown-and-assets-extract
```

Windows PowerShell:

```powershell
Copy-Item -Recurse "<path-to-this-folder>" "$env:USERPROFILE\.agents\skills\docx-to-markdown-and-assets-extract"
```

Windows CMD:

```cmd
xcopy /E /I "<path-to-this-folder>" "%USERPROFILE%\.agents\skills\docx-to-markdown-and-assets-extract"
```

### Project skill

A project that must carry the skill in its own tree copies it under `<project>/.agents/skills/`; a project
copy takes precedence over the user copy. Linux or macOS:

```bash
mkdir -p "<project>/.agents/skills"
cp -R "<path-to-this-folder>" "<project>/.agents/skills/docx-to-markdown-and-assets-extract"
```

Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force "<project>\.agents\skills" | Out-Null
Copy-Item -Recurse "<path-to-this-folder>" "<project>\.agents\skills\docx-to-markdown-and-assets-extract"
```

Windows CMD:

```cmd
mkdir "<project>\.agents\skills" 2>nul
xcopy /E /I "<path-to-this-folder>" "<project>\.agents\skills\docx-to-markdown-and-assets-extract"
```

The skill is self-contained: there is nothing to install, so never run `npm install`. Start a new session
after copying, so the harness lists the skill.

## Agent Execution Rules

- **Guard first.** `node scripts/check-input.mjs "<path>"` refuses a path with no Word document.
- **One document, one folder.** Never merge two documents into one output folder.
- **Never invent an index step.** Extraction ends with Markdown on disk.
- **Never claim an asset you do not have.** An image reference must have its file.
- **Report the counts and the hash result**, not "it worked".
- **No secrets, no credentials.** A converted document stays in the corpus it belongs to.

## Tests

From this folder:

```bash
npm test
```

Fixtures live in `tests/fixtures/` as checked-in `.docx` files, and the suite reads them directly: no
generator runs and nothing is installed. Replacing one means replacing the `.docx` and keeping the
assertions in `tests/extraction.test.mjs` and `tests/guard.test.mjs` true.

## Files Index

| Path | Holds |
| :--- | :--- |
| `SKILL.md` | The agent contract: inputs, outputs, workflow, failures |
| `package.json` | `npm test` (`node --test`); no dependencies |
| `lib/zip.mjs` | The dependency-free ZIP reader |
| `lib/xml.mjs` | The WordprocessingML reader |
| `lib/docx-extract.mjs` | Document to Markdown |
| `scripts/check-input.mjs` | The guard |
| `scripts/extract-docx.mjs` | The command-line extractor |
| `tests/` | The suite |
| `tests/fixtures/` | Checked-in `.docx` inputs for the headings, image and page-break cases |
