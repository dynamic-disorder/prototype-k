# CsvTranslations

Tools for CSV-based English-to-Finnish dictionary management, including translation via offline AI (Ollama), text-to-speech playback, and text file processing.

## Structure

The solution (`CsvTranslations.sln`) contains the following projects:

### Apps (Console/Executable)

- **AddEntryApp** — Interactive console app for adding English words and their Finnish translations to `translations.csv`. Uses Ollama for suggestions; input is plain console input, so it runs on any platform.
- **OllamaTranslatorApp** — Translates entries in `translations.csv` from English to Finnish using a local Ollama AI model.
- **TextFileSplitterApp** — Splits large text files into smaller chunks. Useful for preparing text for batch translation.
- **TextToSpeechApp** — Reads entries from `translations.csv` aloud using Piper, a local neural TTS engine, on Windows, Linux and macOS. One `net10.0` build; voices and playback are configured in `settings.json`.

### Libraries

- **OllamaTranslatorApi** — Core library for interacting with Ollama API. Handles CSV file translation, free-text translation, and Ollama request/response models.
- **TextToSpeechCore** — Platform-neutral Piper text-to-speech core: the Piper engine and voice assets, and the `IAudioPlayback` seam that keeps playback out of the library.
- **TranslationTools** — Shared utilities for CSV parsing (using CsvHelper), file handling, and common translation tooling.

### Test Projects

- **TextToSpeechCore.Tests** — Unit tests for the platform-neutral Piper TTS core (speak guards, voice listing, config) — in the solution, 82 tests pass; target `net10.0` and fake `IAudioPlayback`, so they need no audio device
- **OllamaTranslatorApi.Tests** — Unit tests for the Ollama translation API (CsvFileTranslator, OllamaTranslator) — in the solution, 27 tests pass
- **OllamaTranslatorApp.Tests** — Unit tests for the Ollama translator console app (real `TranslateCommand` helpers, `TextFileTranslator`, and `Program.TranslateFileAsync` routing) — in the solution, 41 tests pass
- **TextToSpeechApp.Tests** — Unit tests for the TTS app — in the solution, 49 tests pass; covers provider resolution and the per-platform playback choices
- **TranslationTools.Tests** — Unit tests for the shared CSV parsing/tooling library — in the solution, 81 tests pass

## Data File

`translations.csv` is the central dictionary file with English-Finnish word/phrase pairs, used by all apps in this solution.

## Requirements

- .NET 10.0 SDK
- .NET 10.0 runtime to run/test the projects (the .NET 10 runtime is installed, so no roll-forward is needed)
- A command-line audio player on `PATH` to *hear* `TextToSpeechApp`: `pw-play`, `paplay`, `aplay` or `ffplay` on Linux, `afplay` on macOS, PowerShell on Windows. The app is a single `net10.0` build that runs on all three.
- Ollama server running locally (for OllamaTranslatorApp and OllamaTranslatorApi)

## Build & Test

```bash
# Build everything
dotnet build CsvTranslations.sln

# Run all tests (every project is in the solution)
dotnet test CsvTranslations.sln

# Run a specific app
dotnet run --project OllamaTranslatorApp
dotnet run --project AddEntryApp
dotnet run --project TextToSpeechApp
dotnet run --project TextFileSplitterApp -- <input-file> <chunk-size>
```

From the umbrella repository root - one level above this folder -
`./local_dev/scripts/build-all-linux.sh --test` builds and tests every solution at once.

## Distribution

Published as self-contained Windows executables by
`local_dev/scripts/publish-selfcontained.mjs`, which writes to `publish/<App>/<runtime>/<configuration>/`
(git-ignored). Run it from the repository root:

```bash
node local_dev/scripts/publish-selfcontained.mjs                # every supported app
node local_dev/scripts/publish-selfcontained.mjs AddEntryApp    # one app
```