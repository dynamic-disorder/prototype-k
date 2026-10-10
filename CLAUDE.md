# CLAUDE.md

Mono-repo of independent .NET hobby projects. Each major project has its own `.sln` and project-specific `CLAUDE.md` / `README.md` with build/test/run commands. Every solution builds and tests on both Linux (Omarchy/Arch) and Windows.

## Projects

| Project | Path | Type | Summary | Linux build |
| :------ | :--- | :--- | :------ | :---------- |
| **CliUtils** | `CliUtils/` | Library | Shared console utilities (Spectre.Console wrappers, colored logging). See [CLAUDE.md](CliUtils/CLAUDE.md) | OK |
| **FilenameTools** | `FilenameTools/` | Solution | Filename sanitization (Unicode NFKD, pattern rules, JSON config). See [CLAUDE.md](FilenameTools/CLAUDE.md) | OK, 78/78 tests |
| **CsvTranslations** | `CsvTranslations/` | Solution | English-Finnish dictionary tools (Ollama translation, TTS, CSV mgmt). See [CLAUDE.md](CsvTranslations/CLAUDE.md) | OK; TTS cross-compiles, Windows-only at runtime |
| **MediaRenamer** | `MediaRenamer/` | WPF | Rename media files by EXIF metadata (.NET 8). See [CLAUDE.md](MediaRenamer/CLAUDE.md) | Cross-compiles; runs on Windows only |
| **ai_offline** | `ai_offline/` | Docker | Ollama + Open WebUI stack. Docker Compose, GPU setup, guides | n/a (Docker) |

## Support Folders

| Folder | Purpose |
| :----- | :------ |
| `local_dev/` | Dev artifacts, analyses, scripts, docs |
| `memory/` | Personal notes, reference configs |
| `translations_csv/` | Standalone English-Finnish CSV dictionary |
| `local_user_files/` | Ephemeral files (git-ignored) |

## Environment & Style

- **Platforms**: Omarchy Linux (Arch-based, primary since Oct 2026) and Windows 11.
- **SDK**: .NET 10.0.x SDK on Linux; projects still target `net9.0` (MediaRenamer: `net8.0-windows`).
- **Runtime**: only the .NET 10 runtime is installed on the Linux box. Building `net9.0` needs no runtime, but *running* net9.0 tests/apps needs the .NET 9 runtime or roll-forward — see below.
- **Shell**: bash on Linux; PowerShell (preferred) or Git Bash on Windows.
- **Line endings**: **LF everywhere** — in the repository *and* in the working tree — per `.gitattributes` (`* text=auto eol=lf`), with `core.autocrlf=false`. The old Windows-first CRLF-for-`.cs` policy was dropped in Oct 2026: it produced constant "LF will be replaced by CRLF" / "CRLF will be replaced by LF" warnings and left files with mixed endings.

## Cross-Platform Builds (Linux / macOS)

- **Build and test everything**: `./local_dev/scripts/build-all-linux.sh --test` (add `-c Release` for Release). It builds each `.sln` and prints a per-solution summary.
- **Windows-targeted projects cross-compile**: `EnableWindowsTargeting=true` is set in both `Directory.Build.props` files (repo root and `CsvTranslations/`), so WPF (`MediaRenamer`) and `net*-windows` (`TextToSpeechApp`) restore and compile on Linux. They still only *run* on Windows.
- **Case-sensitive paths**: a wrong-case `ProjectReference`/`Include` is silently *skipped* by restore on Linux (`Skipping project ... because it was not found`) and only fails later at compile time. Always match the on-disk case exactly — this already broke `FilenameSanitizer.Tests.csproj` once.
- **net9.0 execution**: install the runtime (`sudo pacman -S dotnet-runtime-9.0`, available in `extra/`) or set `DOTNET_ROLL_FORWARD=LatestMajor`. The build script applies the roll-forward automatically when no .NET 9 runtime is found.
- **git `core.ignorecase`**: now set to `false` in this clone. It used to be `true` on a case-sensitive filesystem, which made the `FileNameSanitizer/` → `FilenameSanitizer/` directory rename stage as a **deletion** of every tracked file. Keep it `false`; if a case-only rename ever shows up as `deleted:` entries, that setting is the cause.
- **Full findings**: `local_dev/analyses/linux-build-audit.md`.

## AI Context Map

Where to find authoritative context (read this index first, then open only the file you need):

- **Per-project context**: `<Project>/CLAUDE.md` — authoritative commands/conventions/gotchas for each project
- **Cross-platform build facts**: `local_dev/analyses/linux-build-audit.md` — per-solution results, root causes, open issues, cross-platform checklist
- **Build script**: `local_dev/scripts/build-all-linux.sh` — build/test every solution on Linux
- **Conventions (single source of truth)**: `.claude/rules/` — `csharp-conventions.md`, `test-conventions.md`, `repository-structure.md`, `csharp-build-verification.md`
- **Copilot instructions**: `.github/copilot-instructions.md` (+ subfolder files)
- **Personal memory/reference**: `memory/` (committed, stable) ; Claude Code auto-memory `~/.claude/projects/*/memory/` (git-ignored, ephemeral)
- **Analyses & plans**: `local_dev/analyses/`, `local_dev/plans/`
- **Cline rules**: root `.clinerules`
