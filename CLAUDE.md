# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This repository contains several independent hobby projects and experiments:
- **FileNameTools**: A cross-platform utility for sanitizing filenames.
- **CsvTranslations**: Tools for CSV data processing, including integration with local LLMs via Ollama.
- **MediaRenamer**: A WPF application that renames media files based on EXIF metadata.
- **ai_offline**: Docker containers and configurations for running a local AI stack (Ollama + Open WebUI).

## Architecture & Structure
The project is organized as a mono-repo where each subdirectory functions as an independent unit:
- Each major project (**FileNameTools**, **CsvTranslations**, **MediaRenamer**) maintains its own `.sln` file and resides in its own directory.
- Specific local configurations (e.g., specific .NET versions or license keys) are often kept within the respective project folders.
- The `local_dev/` folder contains internal documentation for tools, technical analysis, and Claude Code integration guidance.

## Development Commands
To maintain context, it is recommended to navigate into the specific project directory before running commands.

### Project Directory Summary
| Project | Path | Build / Run |
| :--- | :--- | :--- |
| **FileNameTools** | `FileNameTools/` | `dotnet build`, `dotnet test` |
| **CsvTranslations** | `CsvTranslations/` | `dotnet build`, `dotnet test` |
| **MediaRenamer** | `MediaRenamer/` | `dotnet build` (WPF UI) |
| **ai_offline** | `ai_offline/ollama_with_open_webui/` | `docker compose -f docker-compose-ollama-with-open-webui.legacy.yml up -d` |

### General Commands (Root)
```bash
# List all available solutions in the repo
find . -name "*.sln"

# Check status of all projects
git status
```

## Development Environment
- **Platform**: Primary development is done on Windows 11.
- **Runtime**: Targets .NET 9.0. Ensure the appropriate .NET SDK and hosting bundles are available for targeted project types (e.g., `win-x64` for WPF).
- **Shell**: Git Bash provides standard Unix shells; PowerShell is used for local automation scripts.

## Style & Guidelines
- **Line Endings**: CRLF is preferred for `.cs`, `.md`, and `.json`. LF is required for `.sh` and Docker files.
- **Naming**: Follow existing naming conventions within each module (see `local_dev/` for details on specific logic requirements).
- **Documentation**: Refer to the nested `CLAUDE.md` files within subdirectories for project-specific rules when working in those folders.
