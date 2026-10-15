# CsvTranslations projects

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
dotnet test  CsvTranslations.sln            # 231 tests: 82 + 27 + 81 + 41
```

- **Windows-targeted projects cross-compile.** `TextToSpeechApp` targets
  `net10.0-windows10.0.19041.0` with `RuntimeIdentifier=win-x64` (see
  `Directory.Build.TTS.props`). `Directory.Build.props` sets
  `EnableWindowsTargeting=true`, so the whole solution restores and builds on
  Linux/macOS — but the TTS app still only *runs* on Windows.
- **`TextToSpeechCore` stays `net10.0` (platform-neutral).** PiperSharp synthesis works
  anywhere Piper runs, so only *playback* is OS-specific. It is injected as
  `IAudioPlayback`; `TextToSpeechApp` supplies the NAudio `WaveOut` implementation
  (`NaudioWavPlayback`).
  - This is deliberate: NAudio 3.0 split the monolithic package per platform and
    `NAudio.WinMM` (home of `WaveOut`) only ships a Windows TFM. Rather than widen
    this library's target framework to match the package, the Windows-only
    dependency lives in the app. **Prefer refactoring like this over widening the
    TFM** — and keep `NAudio` off `TextToSpeechCore`.
- **`NETSDK1100`** ("To build a project targeting Windows on this operating
  system, set the EnableWindowsTargeting property") means that property was lost
  from `Directory.Build.props`. `NETSDK1127` means the .NET 10 targeting pack is
  missing; the installed SDK must be new enough to support `net10.0`.
- **Running net10.0 tests** needs only the .NET 10 runtime, which is already
  installed — everything targets `net10.0`, so no roll-forward is required.

## Project Dependencies

- **TranslationTools**: Core library for CSV handling
- **OllamaTranslatorApi**: Requires local Ollama instance (see `ai_offline/`)
- **TextToSpeechApp**: Windows-only at runtime (uses Windows.Media.SpeechSynthesis). Depends on `TextToSpeechCore` (PiperSharp, platform-neutral) and, directly, on `NAudio` for the WinMM playback implementation it injects.
- Test projects: xUnit-based unit tests

## Test project status (updated 2026-10-11, after the Piper asset cache work)

All test projects now build clean (0 warnings) and the four that can run on Linux are green:

| Project | In `CsvTranslations.sln` | Status |
| :------ | :----------------------- | :----- |
| `TextToSpeechCore.Tests` | yes | 82/82 pass (platform-neutral: fakes `IAudioPlayback`, stubs the Piper downloads) |
| `OllamaTranslatorApi.Tests` | yes | 27/27 pass |
| `TranslationTools.Tests` | yes | 81/81 pass (was an empty project with no test sources) |
| `OllamaTranslatorApp.Tests` | yes | 41/41 pass |
| `TextToSpeechApp.Tests` | **no** | builds (Windows-only target, cannot run on Linux) |

`dotnet build`/`dotnet test` on `CsvTranslations.sln` therefore runs **231 tests**
(82 + 27 + 81 + 41). Only `TextToSpeechApp.Tests` stays outside the solution on purpose:
adding it would make `dotnet test` try to *execute* a `net10.0-windows…`/`win-x64`
assembly on Linux. Build it explicitly with its `.csproj` path.

Some `TranslationTools.Tests` parser tests render a console separator via
`Console.WindowWidth`, so they need a console handle: under a headless test host they fail
with `IOException: The handle is invalid` while the counts above still hold.

`TextToSpeechCore.Tests` targets `net10.0` and substitutes `IAudioPlayback`, so it needs no
audio device and runs in the normal Linux gate. Note what it can and cannot reach: the
positive playback path (synthesized WAV reaching playback) still requires a provider, which
`InitializeAsync` only creates once the Piper engine and voice models are on disk — so these
tests cover the service's guards, voice listing, disposal and the asset cache, not synthesis.
The cache and download paths are covered with stubbed HTTP and injected asset providers
(`PiperAssetCacheTests`, `PiperAssetInstallerTests`), so they never touch the network.

## CSV Format

File: `translations.csv` (root of the CsvTranslations directory)
Columns: `Source Language, Source Text, Target Language, Target Text, Hashtags`
Example: `"English","word","Finnish","translation","#category"`

## Ollama Integration

The OllamaTranslatorApi/App requires a running Ollama instance. See `../ai_offline/ollama-integrations-with-claude-code.md` for setup:
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

- **`/publish`** — Publish supported apps as self-contained `.exe` bundles
  (renamed from `/publish-net10`; the command is version-agnostic, see below)
  - Creates standalone executable files with bundled .NET runtime
  - Larger file sizes but no .NET installation required on target machines
  - Output: `publish/<App>/<runtime>/<configuration>/<app>.exe` (git-ignored)
  - Runs on Linux and Windows, since it only drives `dotnet publish`

- **`/install-net10-runtime`** — Install the .NET 10 runtime on target machines
  - Semi-automatic installer for end-user deployment
  - Smaller distribution size; requires .NET 10 to be installed before running apps
  - Stays version-specific: installing a runtime genuinely is about one version

`/publish` is deliberately not named after a .NET version — `/publish-net9` → `/publish-net10` →
… was pure churn, since the wrapper takes the target framework from the projects.

Wrappers, both in the repository root:

| Wrapper | Language | Why |
| :------ | :------- | :-- |
| `publish-selfcontained.mjs` | Node (dependency-free) | Developer tool. Node needs no install step on either platform; `pwsh` is absent from `PATH` here by default (it is installable as a local .NET tool) |
| `install-net10-runtime.ps1` | PowerShell | Runs on **end-user** machines, where PowerShell 5.1 is guaranteed and Node is not |
