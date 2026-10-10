# Media Renaming Tool [WPF][EXIF]

Timestamp-based renaming utility that preserves or restores original creation time from media files (images with EXIF data) while keeping metadata intact.

## Project Structure

```
MediaRenamer.sln
├── MediaRenamer.Core/           # .NET shared class library (logic layer)
│   ├── Models/                  # Data models for file metadata, renaming rules
│   └── Services/                # Metadata extraction services (EXIF, timestamps)
│
└── MediaRenamer.Wpf/            # WPF client application (.NET 8.0 Windows App SDK or .NET WinForms-style hybrid if needed)
    ├── App.xaml                 # Application startup and window navigation logic
    └── MainWindow.xaml          # Main user interface layout with renaming controls, file list view


## NuGet Dependencies (Core Library)

- **MetadataExtractor** — EXIF image metadata extraction from JPG/PNG/TIFF files. Add reference `MediaRenamer.Wpf → MediaRenamer.Core` and optionally add `System.Windows.Forms` for the built-in `FolderBrowserDialog` (or substitute with custom WPF file picker).


## Extending Video Metadata Support

Out-of-the-box, video metadata extraction falls back to filesystem creation time. To enhance support:

1. **Create a video provider** — Implement `IMetadataProvider`. Use ffmpeg (`ffprobe`) to read `creation_time` from MP4/MOV/AVI files (see [CompositeMetadataProvider](#composite-provider-pattern) for reference).
2. **Combine providers** — Add a `[Inject] public CompositeMetadataProvider(IMetadataProvider image, IMetadataProvider video);` aggregator that tries EXIF first then falls through to the video provider or filesystem fallback; wire it into your `FileRenamer`.
