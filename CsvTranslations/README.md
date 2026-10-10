# CsvTranslations

Tools for CSV-based English-to-Finnish dictionary management, including translation via offline AI (Ollama), text-to-speech playback, and text file processing.

## Structure

The solution (`CsvTranslations.sln`) contains the following projects:

### Apps (Console/Executable)

- **AddEntryApp** — Interactive console app for adding English words and their Finnish translations to `translations.csv`. Uses Ollama for suggestions and Windows console for input.
- **OllamaTranslatorApp** — Translates entries in `translations.csv` from English to Finnish using a local Ollama AI model.
- **TextFileSplitterApp** — Splits large text files into smaller chunks. Useful for preparing text for batch translation.
- **TextToSpeechApp** — Reads entries from `translations.csv` aloud using Windows SAPI speech synthesis. Configurable voice and speed.

### Libraries

- **OllamaTranslatorApi** — Core library for interacting with Ollama API. Handles CSV file translation, free-text translation, and Ollama request/response models.
- **TextToSpeechCore** — Core library for Windows SAPI text-to-speech functionality.
- **TranslationTools** — Shared utilities for CSV parsing (using CsvHelper), file handling, and common translation tooling.

### Test Projects

- **OllamaTranslatorApi.Tests** — Unit tests for the Ollama translation API (CsvFileTranslator, OllamaTranslator) — in the solution, 27 tests pass
- **OllamaTranslatorApp.Tests** — Unit tests for the Ollama translator console app (real `TranslateCommand` helpers, `TextFileTranslator`, and `Program.TranslateFileAsync` routing) — in the solution, 31 tests pass
- **TextToSpeechApp.Tests** — Unit tests for the TTS app — not in the solution; Windows-only target, builds but cannot run on Linux
- **TranslationTools.Tests** — Unit tests for the shared CSV parsing/tooling library — in the solution, 81 tests pass

## Data File

`translations.csv` is the central dictionary file with English-Finnish word/phrase pairs, used by all apps in this solution.

## Requirements

- .NET 10.0 SDK
- .NET 10.0 runtime to run/test the projects (the .NET 10 runtime is installed, so no roll-forward is needed)
- Windows to *run* `TextToSpeechApp` (uses SAPI/WinRT). It and the whole solution still cross-compile on Linux/macOS thanks to `EnableWindowsTargeting=true` in `Directory.Build.props`.
- Ollama server running locally (for OllamaTranslatorApp and OllamaTranslatorApi)

## Build & Test

```bash
# Build everything
dotnet build CsvTranslations.sln

# Run all tests (covers only the projects referenced by the solution)
dotnet test CsvTranslations.sln

# Projects outside the solution must be built explicitly:
dotnet build TextToSpeechApp.Tests/TextToSpeechApp.Tests.csproj

# Run a specific app
dotnet run --project OllamaTranslatorApp
dotnet run --project AddEntryApp
dotnet run --project TextToSpeechApp
dotnet run --project TextFileSplitterApp -- <input-file> <chunk-size>
```

From the repository root, `./local_dev/scripts/build-all-linux.sh --test` builds and tests
every solution at once.

## Distribution

Published as self-contained Windows executables. See `.github/` for deployment configuration.