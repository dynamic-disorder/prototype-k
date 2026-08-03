# CLAUDE.md

Mono-repo of independent .NET 9 hobby projects. Each major project has its own `.sln` and project-specific `CLAUDE.md` / `README.md` with build/test/run commands.

## Projects

| Project | Path | Type | Summary |
| :------ | :--- | :--- | :------ |
| **CliUtils** | `CliUtils/` | Library | Shared console utilities (Spectre.Console wrappers, colored logging). See [CLAUDE.md](CliUtils/CLAUDE.md) |
| **FileNameTools** | `FileNameTools/` | Solution | Filename sanitization (Unicode NFKD, pattern rules, JSON config). See [CLAUDE.md](FileNameTools/CLAUDE.md) |
| **CsvTranslations** | `CsvTranslations/` | Solution | English-Finnish dictionary tools (Ollama translation, TTS, CSV mgmt). See [CLAUDE.md](CsvTranslations/CLAUDE.md) |
| **MediaRenamer** | `MediaRenamer/` | WPF | Rename media files by EXIF metadata (.NET 8). See [CLAUDE.md](MediaRenamer/CLAUDE.md) |
| **ai_offline** | `ai_offline/` | Docker | Ollama + Open WebUI stack. Docker Compose, GPU setup, guides |

## Support Folders

| Folder | Purpose |
| :----- | :------ |
| `local_dev/` | Dev artifacts, analyses, scripts, docs |
| `memory/` | Personal notes, reference configs |
| `translations_csv/` | Standalone English-Finnish CSV dictionary |
| `local_user_files/` | Ephemeral files (git-ignored) |

## Environment & Style

- **Platform**: Windows 11, .NET 9.0 SDK
- **Shell**: PowerShell (preferred), Git Bash available
- **Line endings**: CRLF for `.cs`/`.md`/`.json`, LF for `.sh`/Dockerfiles

## AI Context Map

Where to find authoritative context (read this index first, then open only the file you need):

- **Per-project context**: `<Project>/CLAUDE.md` — authoritative commands/conventions/gotchas for each project
- **Conventions (single source of truth)**: `.claude/rules/` — `csharp-conventions.md`, `test-conventions.md`, `repository-structure.md`
- **Copilot instructions**: `.github/copilot-instructions.md` (+ subfolder files)
- **Personal memory/reference**: `memory/` (committed, stable) ; Claude Code auto-memory `~/.claude/projects/*/memory/` (git-ignored, ephemeral)
- **Analyses & plans**: `local_dev/analyses/`, `local_dev/plans/`
- **Cline rules**: root `.clinerules`
