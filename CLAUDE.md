# CLAUDE.md — umbrella repository

**TL;DR** — This repository is an umbrella. One project lives here, `CsvTranslations/`; the other four
are separate repositories. Beyond that it holds the cross-project documentation, the tooling templates
they were created from, and the complete history.

**Verify everything:** `./local_dev/scripts/build-all-linux.sh --test` builds and tests the solution
in `CsvTranslations/` (280 tests); the `ildump` inspector under `local_dev/tools/` is the only other C#
here. The four separate projects verify in their own repositories.

## Executive summary

| | |
| :--- | :--- |
| **Problem** | Five unrelated projects shared one working tree, one `.gitignore`, one build gate and one instruction tree; one of them needed different visibility. |
| **Value** | Each project now has its own repository, history, `.gitignore` and instruction files; this repository keeps the cross-project picture and the original history. |
| **Change** | Cleanup, consolidation of the root and meta layer, then the split — one project per repository, with the AI stack private. `CsvTranslations` was merged back here on 2026-10-16. |
| **Verify** | Builds and tests run in `CsvTranslations/` here and in the four project repositories; each was verified from a fresh tree before its first push. |
| **Top risk** | Editing a file here that belongs to a project. Check the project table first. |

## Non-negotiables

- **LF line endings everywhere** — repository *and* working tree (`.gitattributes`: `* text=auto eol=lf`, `core.autocrlf=false`).
- **Never hard-code a machine path** — source `local_dev/scripts/repo-env.sh` (or the PowerShell/Python sibling) instead. The project repositories carry the same rule.
- **Commit messages are public** — never name a user folder, profile path or account, and never describe content that was removed or anonymised. Rules in `.agents/skills/git-commit/SKILL.md`.
- **No cross-repository relative paths** — reference another project by repository name or by its package, never by `../`.
- **Match on-disk path case exactly** in every `ProjectReference` / `Include` — wrong-case paths are silently skipped during restore on Linux.
- **Keep git `core.ignorecase=false`** in this clone.

## Writing & response style

Applies to responses and to any document written here. Write for fast comprehension; assume limited
reader time and mixed technical backgrounds.

- **Lead with**: Problem → Impact/value → Change → Verification.
- **Executive summary first**, then details in their own sections.
- **Descending order of importance** throughout.
- **Short sections, concise sentences, bullets.**
- **Outcomes, rationale, risks, and decisions** before implementation detail.
- **Verify claims with a command** and report the result.

## Projects

This table is the index, with the state each project was verified in. Only `CsvTranslations/` lives in this repository.

| Project | Repository | Type | Verified |
| :--- | :--- | :--- | :--- |
| **CliUtils** | [cliutils](https://github.com/dynamic-disorder/cliutils) | Library | builds and packs standalone |
| **CsvTranslations** | `CsvTranslations/` — **in this repository** | Solution | builds clean, 280/280 tests pass |
| **FilenameTools** | [filenametools](https://github.com/dynamic-disorder/filenametools) | Solution | builds clean, 78/78 tests pass |
| **MediaRenamer** | [mediarenamer](https://github.com/dynamic-disorder/mediarenamer) | WPF | builds clean; the solution has no test projects |
| **ai_offline** | [ai-offline](https://github.com/dynamic-disorder/ai-offline) (**private**) | Docker | compose setups and guides |

## What lives here

| Path | Purpose |
| :--- | :--- |
| `CsvTranslations/` | The one project that lives here: solution, twelve projects, the dictionary and its corpora |
| `local_dev/scripts/` | Template tooling: `sandbox-env.sh` (cache redirection where `$HOME` is read-only), `repo-env.sh` / `repo-env.ps1` / `repo_paths.py`, `build-all-linux.sh`, the token estimator, the VS Code cache cleaner |
| `local_dev/analyses/` | The cross-platform build audit and the TTS analysis, as recorded before the split |
| `local_dev/plans/` | The consolidation and split plan |
| `local_dev/*.md` | Harness documentation and the git-ignored-files reference |
| `.agents/skills/` | The agent skills used across the projects; each project repository carries the subset it needs |
| `global-style/` | The executive-first writing style installed into every harness's user-global config: `documentation-style.md` (rules), `managed-block.md` (injected text), `install.ps1` / `install.sh` (`-Check` reports drift) |
| `.editorconfig`, `.gitattributes`, `Directory.Build.props` | Canonical templates for a new project repository |
| `.github/`, `.clinerules`, `.claudeignore`, `.claude/`, `.githooks/` | Instruction and gate configuration, kept as templates |
| `local_user_files/` | Git-ignored scratch. Nothing durable belongs here |

Machine- and user-level notes — tools missing on this box, environment workarounds — deliberately do
not live in this repository: they belong to the machine, in user-global agent configuration.

## Where to look next

Read this index first, then open only the file you need.

- **The split and its rationale**: `local_dev/plans/2026-10-15_consolidation-and-multi-repo-plan.md` — decisions, per-repository `.gitignore` tables, progress.
- **Cross-platform build facts**: `local_dev/analyses/linux-build-audit.md`.
- **Tooling**: `local_dev/README.md`.
- **Harness details**: `local_dev/deepseek-harness.md` — what the harnesses read here, and the build-gate activation git cannot carry.
- **Git-ignored files**: `local_dev/git-ignored-local-files.md` — what stays out of version control and why.
- **Working on `CsvTranslations`**: read `CsvTranslations/CLAUDE.md`. For any other project, clone it and read that repository's own `CLAUDE.md`.

## Environment & style

- **Platforms**: Omarchy Linux (Arch-based, primary since Oct 2026) and Windows 11.
- **SDK**: .NET 10.0.x. Every project targets `net10.0` (MediaRenamer: `net10.0-windows`; TextToSpeechApp: `net10.0` on every platform — one build, no Windows target).
- **Runtime**: only the .NET 10 runtime is installed on the Linux box, and it runs every project — no roll-forward needed.
- **Shell**: bash on Linux; PowerShell (preferred) or Git Bash on Windows.
- **Read-only `$HOME`**: source `local_dev/scripts/sandbox-env.sh` before restoring, or the package caches cannot be written.
- **Line endings**: **LF everywhere** per `.gitattributes` with `core.autocrlf=false`. The old Windows-first CRLF-for-`.cs` policy was dropped in Oct 2026.
