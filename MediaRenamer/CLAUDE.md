# MediaRenamer — AI Context

## What this project is

Timestamp-based media renaming tool (WPF) that preserves/restores original
creation time from image EXIF metadata. Solution with three projects: Models,
Services, and WpfApp.

| Project | Path | Type | Notes |
| :------ | :--- | :--- | :---- |
| **Models** | `Models/` | Library | Data models (MediaFileInfo, RenamePlanItem) |
| **Services** | `Services/` | Library | Metadata extraction (EXIF via MetadataExtractor 2.9.0), file renaming |
| **WpfApp** | `WpfApp/` | WPF app | Main UI (MainWindow.xaml), references Models + Services |

## Commands

- **Build**: `dotnet build MediaRenamer.sln` (from `MediaRenamer/`)
- **Run**: `dotnet run --project WpfApp` (from `MediaRenamer/`)
- **Test**: no test project yet — see TODOS.md

## Conventions

Targets **net8.0-windows** (this project is intentionally on .NET 8, NOT .NET 9 —
the rest of the repo uses .NET 9). Requires Windows; WPF + Windows Forms enabled.

## Gotchas

- `Services.csproj` and `Models.csproj` have `UseWPF>true` even though they are
  libraries — this is required for certain WPF-dependent types.
- Video metadata falls back to filesystem creation time; video providers
  (ffmpeg/ffprobe) are planned but not implemented (see TODOS.md).

## Related docs

- `TODOS.md` — planned features (video support, batch processing, tests)
- `README.md` — structure, NuGet deps, video provider extension guide