# CsvTranslations projects

.NET C# libraries and console apps for CSV-based translation storage. Contains tools for managing, translating, and working with translation data.

**Core Projects:**
- **TranslationTools**: Library for CSV translation file handling
- **AddEntryApp**: Console app to add English entries to translations.csv
- **TextFileSplitterApp**: Console app to split large text files with CSV formatting option
- **OllamaTranslatorApi**: Library for offline AI translation using Ollama
- **OllamaTranslatorApp**: Console app for batch CSV translation using Ollama AI translation
- **TextToSpeechApp**: Console app reciting source texts and their translations through Piper, on Windows, Linux and macOS from one build
- **Test Projects**: Unit tests for libraries

**Data Format:** CSV with columns: Source Language, Source Text, Target Language, Target Text, Hashtags. Example: "English","word","Finnish","translation","#category"

**Key Features:** CSV-based storage, offline AI translation via Ollama, platform-independent Piper TTS, batch processing, modular architecture.

**Usage:** Build with `dotnet build`, run individual apps with `dotnet run`. Requires .NET 10.0, a local Ollama instance for AI translation, and a command-line audio player on `PATH` for TTS (see the Building section).

## Building

The solution is **`CsvTranslations.sln`** (in this directory).

```bash
cd CsvTranslations
dotnet build CsvTranslations.sln            # or -c Release
dotnet test  CsvTranslations.sln            # 280 tests: 82 + 27 + 81 + 41 + 49
```

- **`TextToSpeechApp` is one `net10.0` build for every platform.** No Windows target
  framework, no `win-x64` RID, no conditional compilation. The Windows-only pieces it used to
  carry — the SAPI provider (WinRT) and the NAudio `WaveOut` playback — were removed in Oct 2026
  because they required a second build. Do not reintroduce a `net*-windows` target here.
- **Piper is the only provider.** `--tts:windows` (or `"TtsProvider": "Windows"`) is reported
  once and ignored. `TtsProviderSelection` owns that decision and is pure, so it is tested
  without settings files.
- **Only playback is OS-specific, and it is a child process.** The WAV is written to a temporary
  file and handed to the first player on `PATH`: `pw-play`/`paplay`/`aplay`/`ffplay` on Linux,
  `afplay` on macOS, `powershell.exe`/`pwsh.exe` (via `System.Media.SoundPlayer.PlaySync`) on
  Windows. Adding a platform is one `WavPlayer` entry and one test, not a new build — which is
  the point: an in-process audio API drags in a Windows-only TFM and is what split the app before.
- **PiperSharp needs `NAudio.Wasapi`, and the `NAudio` version must stay pinned.** PiperSharp's
  WAV conversion calls into `NAudio.Wasapi`, which the NAudio metapackage only pulls in for
  Windows targets, so the app references it directly (its `lib/net9.0` build is platform-neutral).
  Without it the first utterance throws `FileNotFoundException` — after the models have already
  downloaded. Dropping the `NAudio` `PackageVersion` instead makes `NAudio.Core` resolve down to
  2.2.1 and fails the build with `NU1605`.
- **`NETSDK1100`** ("To build a project targeting Windows on this operating
  system, set the EnableWindowsTargeting property") means that property was lost
  from `Directory.Build.props`. `NETSDK1127` means the .NET 10 targeting pack is
  missing; the installed SDK must be new enough to support `net10.0`.
- **Running net10.0 tests** needs only the .NET 10 runtime, which is already
  installed — everything targets `net10.0`, so no roll-forward is required.

## Project Dependencies

- **TranslationTools**: Core library for CSV handling
- **OllamaTranslatorApi**: Requires local Ollama instance (see `ai_offline/`)
- **TextToSpeechApp**: One platform-independent `net10.0` app for Windows, Linux and macOS. Piper is the only provider (PiperSharp); playback hands the synthesized WAV to a command-line player the machine has. The only NAudio package referenced is `NAudio.Wasapi`, which PiperSharp's own WAV conversion requires.
- Test projects: xUnit-based unit tests

## Test project status (updated 2026-10-18, after the Linux Piper work)

All test projects build clean (0 warnings) and all five run green on Linux:

| Project | In `CsvTranslations.sln` | Status |
| :------ | :----------------------- | :----- |
| `TextToSpeechCore.Tests` | yes | 82/82 pass (platform-neutral: fakes `IAudioPlayback`, stubs the Piper downloads) |
| `OllamaTranslatorApi.Tests` | yes | 27/27 pass |
| `TranslationTools.Tests` | yes | 81/81 pass (was an empty project with no test sources) |
| `OllamaTranslatorApp.Tests` | yes | 41/41 pass |
| `TextToSpeechApp.Tests` | yes | 49/49 pass (plain `net10.0`; covers provider resolution and per-platform playback) |

`dotnet build`/`dotnet test` on `CsvTranslations.sln` therefore runs **280 tests**
(82 + 27 + 81 + 41 + 49). `TextToSpeechApp.Tests` used to target `net10.0-windows…`/`win-x64`,
which made `dotnet test` try to *execute* a Windows assembly on Linux; that is gone with the
Windows-only build.

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

The OllamaTranslatorApi/App requires a running Ollama instance. See the separate `ai-offline` repository for the local Ollama setup:
- Install Ollama: https://ollama.com/download
- Pull model: `ollama pull qwen3.5:9b`
- Run translator: `dotnet run --project OllamaTranslatorApp`

## Common Tasks

- **Build all**: `dotnet build CsvTranslations.sln`
- **Test all**: `dotnet test CsvTranslations.sln`
- **Add entry**: `dotnet run --project AddEntryApp`
- **Translate batch**: `dotnet run --project OllamaTranslatorApp`
- **TTS practice**: `dotnet run --project TextToSpeechApp` — identical on every OS; `--tts:piper` is accepted but redundant, and `--tts:windows` is reported as removed

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

Wrappers, both under `local_dev/scripts/`:

| Wrapper | Language | Why |
| :------ | :------- | :-- |
| `local_dev/scripts/publish-selfcontained.mjs` | Node (dependency-free) | Developer tool. Node needs no install step on either platform; `pwsh` is absent from `PATH` here by default (it is installable as a local .NET tool) |
| `local_dev/scripts/install-net10-runtime.ps1` | PowerShell | Runs on **end-user** machines, where PowerShell 5.1 is guaranteed and Node is not |
