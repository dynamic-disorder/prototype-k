---
paths:
  - "**/*.cs"
  - "**/*.csproj"
  - "**/*.sln"
---

# Windows Development Rules for translations_csv

## Operating System
- Windows is required to **run** Windows-specific components
- The whole solution **builds** on Linux/macOS as well: `Directory.Build.props` sets
  `EnableWindowsTargeting=true`, which lets `net10.0-windows10.0.19041.0` projects restore
  and compile cross-platform. Without it the build fails with `NETSDK1100`.
- Some components (TextToSpeechApp) require Windows-specific APIs at runtime
- Use Windows-compatible paths (backslashes, drive letters) only where Windows actually
  runs the code — prefer `Path.Combine` so the same source works on Linux

## .NET Development
- Target framework: .NET 10.0
- Windows-specific projects use `net10.0-windows10.0.19041.0`
- Use `win-x64` runtime identifier for Windows-specific builds
- Build commands: `dotnet build`, `dotnet run`, `dotnet test`
- Running net10.0 tests uses the installed .NET 10 runtime — no roll-forward needed

## Windows-Specific Components
- TextToSpeechApp uses Windows Media APIs (Windows.Media.SpeechSynthesis)
- Windows SAPI TTS service is Windows-only
- Some projects have `#if WINDOWS` preprocessor directives

## File Paths
- Use Windows-style paths: `C:\Users\...` or relative paths with backslashes
- Be aware of case-insensitive file system on Windows
- CSV files use comma separation with quoted strings

## Shell Commands
- Prefer PowerShell over CMD when possible
- Use `powershell` or `pwsh` for PowerShell commands
- For file operations, use Windows-compatible commands: `dir`, `copy`, `move`, `del`

## Testing
- Unit tests use xUnit
- Run tests with `dotnet test`
- Some tests may require Windows-specific environment