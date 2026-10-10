---
description: Build the CsvTranslations solution and all projects
---

## Build Status

!`dotnet build CsvTranslations.sln`

## Test Status

!`dotnet test CsvTranslations.sln`

## Project Structure

The solution contains these projects:
- TranslationTools (library)
- AddEntryApp (console app)
- TextFileSplitterApp (console app)
- OllamaTranslatorApi (library)
- OllamaTranslatorApp (console app)
- TextToSpeechApp (Windows TTS app, cross-compiles on Linux via `EnableWindowsTargeting`)
- TextToSpeechCore (library)
- Test projects: `TextToSpeechCore.Tests` (25 tests, part of the solution),
  `OllamaTranslatorApi.Tests` (27 tests, part of the solution),
  `TranslationTools.Tests` (81 tests, part of the solution),
  `OllamaTranslatorApp.Tests` (31 tests, part of the solution).

Not in the solution — build from their `.csproj` paths:
`TextToSpeechApp.Tests` (Windows-only target, builds but cannot run on Linux).

## Next Steps
After building, you can run individual apps with `dotnet run --project <project-path>`