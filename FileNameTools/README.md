# FileNameTools

A cross-platform .NET 9 utility for sanitizing filenames — removes or replaces problematic characters, trims whitespace, normalizes casing, and replaces special Unicode characters with ASCII equivalents.

## Structure

The solution (`FileNameTools.sln`) contains three projects:

### FileNameSanitizer (Class Library)

Core library providing filename sanitization logic:

- `Sanitizer` — Main sanitizer engine that processes filenames through configurable rules
- `FileNameNormalizer` — Handles Unicode normalization (NFKD) and ASCII fallback
- `PatternLoader` — Loads sanitization patterns and rules from JSON configuration
- `SanitizerSettingsLoader` — Loads and manages sanitizer settings
- `FileSystem` — Abstraction over file I/O operations

### FilenameSanitizer.Tests (xUnit)

Unit tests covering normalizer, pattern loader, settings loader, and the main sanitizer logic.

### FilenameSanitizerCli (Console App)

Command-line entry point that accepts file/directory paths and applies sanitization rules.

## Usage

```bash
# Build
dotnet build FileNameTools.sln

# Test
dotnet test FileNameTools.sln

# Run CLI
dotnet run --project FilenameSanitizerCli -- <path>
```

## Configuration

Sanitization rules are loaded from JSON configuration files. The sanitizer can:
- Replace or remove illegal filename characters
- Trim leading/trailing whitespace and dots
- Normalize Unicode characters to ASCII equivalents
- Collapse multiple consecutive spaces