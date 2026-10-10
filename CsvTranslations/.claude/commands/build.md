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
- Test projects: `OllamaTranslatorApi.Tests` (25 tests, part of the solution),
  `TranslationTools.Tests` (no test sources).

Not in the solution — build from their `.csproj` paths:
`TextToSpeechApp.Tests` (Windows-only) and `OllamaTranslatorApp.Tests` (currently does not compile).

## Next Steps
After building, you can run individual apps with `dotnet run --project <project-path>`