# prototype-k

This repository contains hobby projects and small experiments: utilities, translation helpers, filename sanitizers, media file rename tools, and offline LLM AI infrastructure.

This is a personal hobby project maintained in spare time and is not production-grade.

## Projects

| Project | Description | Tech | Status |
| :------ | :---------- | :--- | :----- |
| [CliUtils](CliUtils/README.md) | Shared console output utilities (colored output, logging, Spectre.Console wrappers) | .NET 9 | Active |
| [FileNameTools](FileNameTools/README.md) | Filename sanitization — removes/replaces illegal characters, Unicode normalization | .NET 9, xUnit | Active |
| [CsvTranslations](CsvTranslations/README.md) | English-Finnish dictionary tools: translation via Ollama, TTS playback, CSV management | .NET 9, Ollama, SAPI | Active |
| [MediaRenamer](MediaRenamer/README.md) | WPF app for renaming media files based on EXIF metadata | .NET 9, WPF | Active |
| [ai_offline](ai_offline/README.md) | Docker configs & guides for local AI stack (Ollama + Open WebUI) | Docker, Ollama | Active |
| [translations_csv](translations_csv/README.md) | Central English-Finnish dictionary CSV file | CSV | Active |

## Support Folders

| Folder | Description |
| :----- | :---------- |
| [local_dev](local_dev/README.md) | Development artifacts, analyses, tooling, scripts, documentation |
| [local_user_files](local_user_files/README.md) | Ephemeral/user-specific files (git-ignored) |
| [memory](memory/README.md) | Personal notes, reference configs, environment setup snippets |

## Requirements

- .NET 9.0 SDK (for C# projects)
- Docker (for ai_offline)
- Windows 10/11 (for WPF and SAPI-based projects)

## Quick Start

```bash
# List all .NET solutions
Get-ChildItem -Recurse -Filter *.sln

# Build all projects
dotnet build CsvTranslations/CsvTranslations.sln
dotnet build FileNameTools/FileNameTools.sln
dotnet build MediaRenamer/MediaRenamer.sln

# Start AI offline stack
cd ai_offline/ollama_with_open_webui
docker compose -f docker-compose-ollama-with-open-webui.yml up -d
```

## License & Disclaimer

Use the code at your own risk. The author accepts no responsibility or liability for damages, data loss, or other consequences arising from use or misuse of this repository.

Licensed under the MIT License. See the LICENSE file for full terms.

Contact: open an issue on GitHub.