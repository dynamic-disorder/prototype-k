# translations_csv projects

.NET C# libraries and console apps for CSV-based translation storage. Contains tools for managing, translating, and working with translation data.

**Core Projects:**
- **TranslationTools**: Library for CSV translation file handling
- **AddEntryApp**: Console app to add English entries to translations.csv
- **TextFileSplitterApp**: Console app to split large text files with CSV formatting option
- **OllamaTranslatorApi**: Library for offline AI translation using Ollama
- **OllamaTranslatorApp**: Console app for batch CSV translation using Ollama AI translation
- **TextToSpeechApp**: Console app using Windows TTS app for reciting source texts and their translations
- **Test Projects**: Unit tests for libraries

**Data Format:** CSV with columns: Source Language, Source Text, Target Language, Target Text, Hashtags. Example: "English","word","Finnish","translation","#category"

**Key Features:** CSV-based storage, offline AI translation via Ollama, Windows TTS, batch processing, modular architecture.

**Usage:** Build with `dotnet build`, run individual apps with `dotnet run`. Requires .NET 9.0, Windows for TTS, and local Ollama instance for AI translation.

## Building

The solution is **`CsvTranslations.sln`** (in this directory).

```bash
cd CsvTranslations
dotnet build CsvTranslations.sln            # or -c Release
dotnet test  CsvTranslations.sln            # OllamaTranslatorApi.Tests: 25 tests
```

- **Windows-targeted projects cross-compile.** `TextToSpeechApp` targets
  `net9.0-windows10.0.19041.0` with `RuntimeIdentifier=win-x64` (see
  `Directory.Build.TTS.props`). `Directory.Build.props` sets
  `EnableWindowsTargeting=true`, so the whole solution restores and builds on
  Linux/macOS — but the TTS app still only *runs* on Windows.
- **`NETSDK1100`** ("To build a project targeting Windows on this operating
  system, set the EnableWindowsTargeting property") means that property was lost
  from `Directory.Build.props`. `NETSDK1127` means the .NET 9 targeting pack is
  missing; a newer SDK alone does not guarantee `net9.0` build support.
- **Running net9.0 tests** needs the .NET 9 runtime. On a .NET 10-only install
  use `DOTNET_ROLL_FORWARD=LatestMajor` or `sudo pacman -S dotnet-runtime-9.0`.

## Project Dependencies

- **TranslationTools**: Core library for CSV handling
- **OllamaTranslatorApi**: Requires local Ollama instance (see `ai_offline/`)
- **TextToSpeechApp**: Windows-only at runtime (uses Windows.Media.SpeechSynthesis); depends on `TextToSpeechCore` (PiperSharp + NAudio)
- Test projects: xUnit-based unit tests

## Test project status (audited 2026-10-10)

Only **`OllamaTranslatorApi.Tests`** is wired into the solution and green (25 tests).
The other test projects need attention:

| Project | In `CsvTranslations.sln` | Status |
| :------ | :----------------------- | :----- |
| `OllamaTranslatorApi.Tests` | yes | 25/25 pass |
| `TranslationTools.Tests` | yes | **contains no test sources at all** — `dotnet test` reports "No test is available" |
| `OllamaTranslatorApp.Tests` | **no** | **does not compile (36 errors)** — stale against the refactored API (`TranslationRequest` has no `SourcePath`/`TargetPath`; it is now `TranslationRequest(Text, Prompt, Semantics)`), plus 14× `'Program' is inaccessible` because `OllamaTranslatorApp.csproj` lacks the `InternalsVisibleTo("OllamaTranslatorApp.Tests")` that `TextToSpeechApp.csproj` declares |
| `TextToSpeechApp.Tests` | **no** | builds (Windows-only target, cannot run on Linux) |

Because two of them are outside the solution, `dotnet build`/`dotnet test` on
`CsvTranslations.sln` never covers them — build them explicitly with their
`.csproj` paths.

## CSV Format

File: `translations.csv` (root of translations_csv directory)
Columns: `Source Language, Source Text, Target Language, Target Text, Hashtags`
Example: `"English","word","Finnish","translation","#category"`

## Ollama Integration

The OllamaTranslatorApi/App requires a running Ollama instance. See `../../ai_offline/ollama-integrations-with-claude-code.md` for setup:
- Install Ollama: https://ollama.com/download
- Pull model: `ollama pull qwen3.5:9b`
- Run translator: `dotnet run --project OllamaTranslatorApp`

## Common Tasks

- **Build all**: `dotnet build CsvTranslations.sln`
- **Test all**: `dotnet test CsvTranslations.sln`
- **Add entry**: `dotnet run --project AddEntryApp`
- **Translate batch**: `dotnet run --project OllamaTranslatorApp`
- **TTS practice**: `dotnet run --project TextToSpeechApp` (Windows only)

See `.claude/commands/build.md` for automated build/test command.

## Distribution

Use Claude Code slash commands for distribution:

- **`/publish-net9`** — Publish supported apps as self-contained `.exe` bundles
  - Creates standalone executable files with bundled .NET 9 runtime
  - Larger file sizes but no .NET 9 installation required on target machines
  - Output: `bin\Release\net9.0-windows10.0.19041.0\win-x64\publish\<app>.exe` for each project

- **`/install-net9-runtime`** — Install .NET 9 runtime on target machines
  - Semi-automatic installer for end-user deployment
  - Smaller distribution size; requires .NET 9 to be installed before running apps

These commands wrap PowerShell scripts in the repository root (`publish-net9-selfcontained.ps1` and `install-net9-runtime.ps1`).
