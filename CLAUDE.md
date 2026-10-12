# CLAUDE.md — Repository Context

**TL;DR** — Mono-repo of independent .NET 10 hobby projects: five majors plus support folders. Every solution builds and tests on both Linux (Omarchy/Arch) and Windows.

**Verify everything:** `./local_dev/scripts/build-all-linux.sh --test`

## Executive summary

| | |
| :--- | :--- |
| **Problem** | Five unrelated projects share one working tree, two operating systems, and one build gate — a change in one can silently break another. |
| **Value** | Each project keeps its own `.sln` and `CLAUDE.md`, so scope stays isolated and every command is local to its project. |
| **Change** | LF-everywhere line endings, `core.ignorecase=false`, and `EnableWindowsTargeting=true` are settled; Windows-only projects cross-compile on Linux. |
| **Verify** | `./local_dev/scripts/build-all-linux.sh --test` builds each `.sln` and prints a per-solution summary. |
| **Top risk** | Wrong-case project paths fail *silently* during restore on Linux and surface only later, at compile time. |

## Non-negotiables

- **LF line endings everywhere** — repository *and* working tree (`.gitattributes`: `* text=auto eol=lf`, `core.autocrlf=false`).
- **Never hard-code a machine path** — source `local_dev/scripts/repo-env.sh` (or the PowerShell/Python sibling) instead.
- **Match on-disk path case exactly** in every `ProjectReference` / `Include`.
- **Keep git `core.ignorecase=false`** in this clone.

## Writing & response style

Applies to responses and to any document written in this repo. Write for fast comprehension; assume limited reader time and mixed technical backgrounds.

- **Lead with**: Problem → Impact/value → Change → Verification.
- **Executive summary first**, then details in their own sections.
- **Descending order of importance** throughout.
- **Short sections, concise sentences, bullets.**
- **Outcomes, rationale, risks, and decisions** before implementation detail.
- **Verify claims with a command** and report the result.

## Projects

Each major project owns its `.sln`, `CLAUDE.md`, and `README.md` with build/test/run commands.

| Project | Path | Type | Summary | Linux build |
| :------ | :--- | :--- | :------ | :---------- |
| **CliUtils** | `CliUtils/` | Library | Shared console utilities (Spectre.Console wrappers, colored logging). See [CLAUDE.md](CliUtils/CLAUDE.md) | OK |
| **FilenameTools** | `FilenameTools/` | Solution | Filename sanitization (Unicode NFKD, pattern rules, JSON config). See [CLAUDE.md](FilenameTools/CLAUDE.md) | OK, 78/78 tests |
| **CsvTranslations** | `CsvTranslations/` | Solution | English-Finnish dictionary tools (Ollama translation, TTS, CSV mgmt). See [CLAUDE.md](CsvTranslations/CLAUDE.md) | OK; TTS cross-compiles, Windows-only at runtime |
| **MediaRenamer** | `MediaRenamer/` | WPF | Rename media files by EXIF metadata (.NET 10). See [CLAUDE.md](MediaRenamer/CLAUDE.md) | Cross-compiles; runs on Windows only |
| **ai_offline** | `ai_offline/` | Docker | Ollama + Open WebUI stack. Docker Compose, GPU setup, guides | n/a (Docker) |

## Support folders

| Folder | Purpose |
| :----- | :------ |
| `local_dev/` | Dev artifacts, analyses, scripts, docs |
| `memory/` | Personal notes, reference configs |
| `translations_csv/` | Standalone English-Finnish CSV dictionary |
| `local_user_files/` | Ephemeral files (git-ignored) |

## Where to look next

Read this index first, then open only the file you need.

**Authoritative project and build facts**

- **Per-project context**: `<Project>/CLAUDE.md` — commands, conventions, and gotchas for that project.
- **Cross-platform build facts**: `local_dev/analyses/linux-build-audit.md` — per-solution results, root causes, open issues, cross-platform checklist.
- **Build script**: `local_dev/scripts/build-all-linux.sh` — build/test every solution on Linux.
- **Paths & environment**: `local_dev/scripts/repo-env.sh` (bash), `repo-env.ps1` (PowerShell), `repo_paths.py` (Python) — resolve the repository root and probe the environment. Details in `local_dev/README.md`.
- **Build gate**: `.claude/settings.json` wires a `PreToolUse` hook (`.claude/hooks/pre-commit-build-check.sh`) that blocks a `git commit` with staged C# until the affected solution builds. Both are tracked, despite `.claude/` being ignored.

**Conventions and guidance**

- **Conventions**: `.editorconfig` is the source of truth for formatting and style, alongside each `<Project>/CLAUDE.md`. Repo-specific C# and test guidance lives in the tracked skills under `.agents/skills/`.
- **Copilot instructions**: `.github/copilot-instructions.md` (+ subfolder files).
- **Cline rules**: root `.clinerules`.
- **Personal memory/reference**: `memory/` (committed, stable) — includes `omarchy-tool-substitutions.md` (tools missing on this Linux box and their working alternatives); Claude Code auto-memory lives in `~/.claude/projects/*/memory/` (git-ignored, ephemeral).
- **Analyses & plans**: `local_dev/analyses/`, `local_dev/plans/`.

**Tooling that must be set up outside git**

- **Harness compatibility**: skills are tracked once at `.agents/skills/` — DeepSeek Harness's project skill root — and Claude Code reaches the same files through the local `.claude/skills` symlink, so neither harness keeps its own copy. Instructions are shared the same way: DSH reads `AGENTS.md` **and** `CLAUDE.md` (plus the `.local.md` overlays), so the existing `CLAUDE.md` files serve both and no duplicate file is needed. Details in `local_dev/git-ignored-local-files.md`.
- **DeepSeek Harness setup**: `local_dev/deepseek-harness.md` — what DSH reads from here, and the part git cannot carry: the build gate only fires once the hook bridge is mounted in the machine's DSH profile and DSH has been restarted.
- **Git-ignored local files**: `local_dev/git-ignored-local-files.md` — why `.claude/` is excluded (personal, unsanitised config), what else lives outside version control, and how to persist it once reviewed.

## Environment & style

- **Platforms**: Omarchy Linux (Arch-based, primary since Oct 2026) and Windows 11.
- **SDK**: .NET 10.0.x on Linux. Every project targets `net10.0` (MediaRenamer: `net10.0-windows`, TextToSpeechApp: `net10.0-windows10.0.19041.0`).
- **Runtime**: only the .NET 10 runtime is installed on the Linux box, and it runs everything in the repo — no roll-forward needed.
- **Shell**: bash on Linux; PowerShell (preferred) or Git Bash on Windows.
- **Line endings**: **LF everywhere** per `.gitattributes` (`* text=auto eol=lf`) with `core.autocrlf=false`. The old Windows-first CRLF-for-`.cs` policy was dropped in Oct 2026: it produced constant "LF will be replaced by CRLF" / "CRLF will be replaced by LF" warnings and left files with mixed endings.

## Cross-platform builds (Linux / macOS) — details

- **Build and test everything**: `./local_dev/scripts/build-all-linux.sh --test` (add `-c Release` for Release). It builds each `.sln` and prints a per-solution summary.
- **Windows-targeted projects cross-compile**: `EnableWindowsTargeting=true` is set in both `Directory.Build.props` files (repo root and `CsvTranslations/`), so WPF (`MediaRenamer`) and `net*-windows` (`TextToSpeechApp`) restore and compile on Linux. They still only *run* on Windows.
- **Case-sensitive paths**: a wrong-case `ProjectReference`/`Include` is silently *skipped* by restore on Linux (`Skipping project ... because it was not found`) and only fails later at compile time. Always match the on-disk case exactly — this already broke `FilenameSanitizer.Tests.csproj` once.
- **net10.0 execution**: every project targets `net10.0` and the .NET 10 runtime is installed, so tests and apps run directly — no roll-forward or extra runtime install required.
- **git `core.ignorecase`**: now `false` in this clone. It used to be `true` on a case-sensitive filesystem, which made the `FileNameSanitizer/` → `FilenameSanitizer/` directory rename stage as a **deletion** of every tracked file. Keep it `false`; if a case-only rename ever shows up as `deleted:` entries, that setting is the cause.
- **Full findings**: `local_dev/analyses/linux-build-audit.md`.
