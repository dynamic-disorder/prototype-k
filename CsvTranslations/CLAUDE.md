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

**Usage:** Build with `dotnet build`, run individual apps with `dotnet run`. Requires .NET 10.0, Windows for TTS, and local Ollama instance for AI translation.

## Building

The solution is **`CsvTranslations.sln`** (in this directory).

```bash
cd CsvTranslations
dotnet build CsvTranslations.sln            # or -c Release
dotnet test  CsvTranslations.sln            # 124 tests: 25 + 68 + 31
```

- **Windows-targeted projects cross-compile.** `TextToSpeechApp` targets
  `net10.0-windows10.0.19041.0` with `RuntimeIdentifier=win-x64` (see
  `Directory.Build.TTS.props`). `Directory.Build.props` sets
  `EnableWindowsTargeting=true`, so the whole solution restores and builds on
  Linux/macOS — but the TTS app still only *runs* on Windows.
- **`TextToSpeechCore` targets `net10.0-windows`** (not plain `net10.0`). Since
  NAudio 3.0 the monolithic package is split per platform and `NAudio.WinMM`
  (home of the `WaveOut` playback class) only ships a Windows TFM, so the library
  must be Windows-targeted to consume it. Its only consumers are Windows-targeted
  too, and playback was already Windows-only at runtime.
- **`NETSDK1100`** ("To build a project targeting Windows on this operating
  system, set the EnableWindowsTargeting property") means that property was lost
  from `Directory.Build.props`. `NETSDK1127` means the .NET 10 targeting pack is
  missing; the installed SDK must be new enough to support `net10.0`.
- **Running net10.0 tests** needs only the .NET 10 runtime, which is already
  installed — everything targets `net10.0`, so no roll-forward is required.

## Project Dependencies

- **TranslationTools**: Core library for CSV handling
- **OllamaTranslatorApi**: Requires local Ollama instance (see `ai_offline/`)
- **TextToSpeechApp**: Windows-only at runtime (uses Windows.Media.SpeechSynthesis); depends on `TextToSpeechCore` (PiperSharp + NAudio)
- Test projects: xUnit-based unit tests

## Test project status (updated 2026-10-10, after the .NET 10 migration fixes)

All test projects now build clean (0 warnings) and the three that can run on Linux are green:

| Project | In `CsvTranslations.sln` | Status |
| :------ | :----------------------- | :----- |
| `OllamaTranslatorApi.Tests` | yes | 25/25 pass |
| `TranslationTools.Tests` | yes | 68/68 pass (was an empty project with no test sources) |
| `OllamaTranslatorApp.Tests` | yes | 31/31 pass (was 36 compile errors; now added to the solution) |
| `TextToSpeechApp.Tests` | **no** | builds (Windows-only target, cannot run on Linux) |

`dotnet build`/`dotnet test` on `CsvTranslations.sln` therefore runs **124 tests**
(25 + 68 + 31). Only `TextToSpeechApp.Tests` stays outside the solution on purpose:
adding it would make `dotnet test` try to *execute* a `net10.0-windows…`/`win-x64`
assembly on Linux. Build it explicitly with its `.csproj` path.

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

- **`/publish-net10`** — Publish supported apps as self-contained `.exe` bundles
  - Creates standalone executable files with bundled .NET 10 runtime
  - Larger file sizes but no .NET 10 installation required on target machines
  - Output: `bin\Release\net10.0-windows10.0.19041.0\win-x64\publish\<app>.exe` for each project

- **`/install-net10-runtime`** — Install .NET 10 runtime on target machines
  - Semi-automatic installer for end-user deployment
  - Smaller distribution size; requires .NET 10 to be installed before running apps

These commands wrap PowerShell scripts in the repository root (`publish-net10-selfcontained.ps1` and `install-net10-runtime.ps1`).
