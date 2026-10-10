# MediaRenamer — AI Context

## What this project is

Timestamp-based media renaming tool (WPF) that preserves/restores original
creation time from image EXIF metadata. Solution with three projects: Models,
Services, and WpfApp.

| Project | Path | Type | Notes |
| :------ | :--- | :--- | :---- |
| **Models** | `Models/` | Library | Data models (MediaFileInfo, RenamePlanItem) |
| **Services** | `Services/` | Library | Metadata extraction (EXIF via MetadataExtractor 2.9.3), file renaming |
| **WpfApp** | `WpfApp/` | WPF app | Main UI (MainWindow.xaml), references Models + Services |

## Commands

- **Build**: `dotnet build MediaRenamer.sln` (from `MediaRenamer/`)
- **Run**: `dotnet run --project WpfApp` (from `MediaRenamer/`) — Windows only
- **Test**: no test project yet — see TODOS.md

## Conventions

Targets **net10.0-windows** (this project is on .NET 10, aligned with the rest of the
repo). WPF + Windows Forms are enabled.

**Cross-platform build (verified 2026-10-10):** all three projects build in Debug and
Release on Linux. The `net10.0-windows` targeting pack comes from NuGet and WPF's XAML
compiler runs cross-platform because `EnableWindowsTargeting=true` is set in the
repository-root `Directory.Build.props`. Running the app still requires Windows — on
Linux `dotnet run --project WpfApp` will fail at launch, not at build.

## Gotchas

- `Services.csproj` and `Models.csproj` have `UseWPF>true` even though they are
  libraries — this is required for certain WPF-dependent types.
- Removing `EnableWindowsTargeting` from the root `Directory.Build.props` breaks the
  build on Linux/macOS with `NETSDK1100`.
- Video metadata falls back to filesystem creation time; video providers
  (ffmpeg/ffprobe) are planned but not implemented (see TODOS.md).

## Related docs

- `TODOS.md` — planned features (video support, batch processing, tests)
- `README.md` — structure, NuGet deps, video provider extension guide