# prototype-k

This repository contains hobby projects and small experiments: utilities, translation helpers, filename sanitizers, media file rename tools, and offline LLM AI infrastructure.

This is a personal hobby project maintained in spare time and is not production-grade.

## Projects

| Project | Description | Tech | Status |
| :------ | :---------- | :--- | :----- |
| [CliUtils](CliUtils/README.md) | Shared console output utilities (colored output, logging, Spectre.Console wrappers) | .NET 10 | Active |
| [FilenameTools](FilenameTools/README.md) | Filename sanitization — removes/replaces illegal characters, Unicode normalization | .NET 10, xUnit | Active |
| [CsvTranslations](CsvTranslations/README.md) | English-Finnish dictionary tools: translation via Ollama, TTS playback, CSV management | .NET 10, Ollama, SAPI | Active |
| [MediaRenamer](MediaRenamer/README.md) | WPF app for renaming media files based on EXIF metadata | .NET 10, WPF | Active |
| [ai_offline](ai_offline/README.md) | Docker configs & guides for local AI stack (Ollama + Open WebUI) | Docker, Ollama | Active |

## Support Folders

| Folder | Description |
| :----- | :---------- |
| [local_dev](local_dev/README.md) | Development artifacts, analyses, tooling, scripts, documentation |
| [local_user_files](local_user_files/README.md) | Ephemeral/user-specific files (git-ignored) |
| [memory](memory/README.md) | Personal notes, reference configs, environment setup snippets |

## Requirements

- .NET 10.0 SDK (all C# projects, including `MediaRenamer`)
- .NET 10.0 **runtime** to run/test the projects (builds alone do not need it); everything targets `net10.0`, so no roll-forward is required
- Docker (for ai_offline)
- Windows 10/11 to *run* the WPF app and the SAPI/WinRT TTS app. Both cross-compile on Linux/macOS.

## Quick Start

```bash
# Build and test every solution (Linux/macOS) — add -c Release for Release builds
./local_dev/scripts/build-all-linux.sh --test

# Or build individual solutions (any platform)
dotnet build CsvTranslations/CsvTranslations.sln
dotnet build FilenameTools/FilenameTools.sln
dotnet build MediaRenamer/MediaRenamer.sln

# Start AI offline stack
cd ai_offline
docker compose -f ai_offline/Ollama/docker-compose.yml up -d
docker compose -f ai_offline/OpenWebUI/docker-compose.yml up -d
```

Windows-targeted projects (WPF, `net10.0-windows10.0.19041.0`) compile on Linux because
`EnableWindowsTargeting=true` is set in `Directory.Build.props`. See
[local_dev/analyses/linux-build-audit.md](local_dev/analyses/linux-build-audit.md) for the
cross-platform build details and known open issues.

## License & Disclaimer

Use the code at your own risk. The author accepts no responsibility or liability for damages, data loss, or other consequences arising from use or misuse of this repository.

Licensed under the MIT License. See the LICENSE file for full terms.

Contact: open an issue on GitHub.