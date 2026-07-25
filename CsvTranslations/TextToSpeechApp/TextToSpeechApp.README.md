TextToSpeechApp

A Windows console application that reads translation entries from CSV files aloud using either the **Windows Speech API (SAPI)** or **Piper** (local neural TTS engine via PiperSharp). The application randomly selects entries and reads them in their respective languages, helping with language learning through audio repetition.

## Prerequisites

### **Required Software**
- **.NET 9 SDK** - The application targets `net9.0-windows10.0.19041.0`
- **Windows 10 or newer** (build 19041+) - Required for Windows SAPI/WinRT integration
- **64-bit Windows** - Application is compiled for `win-x64` runtime

### **System Requirements**
- Windows 10 version 19041 (May 2020 Update) or later
- **Windows provider**: Windows Speech Platform voices installed (check Windows Settings → Time & Language → Speech)
- **Piper provider**: Voice models and Piper engine are downloaded automatically on first run
- Sufficient disk space for .NET 9 runtime and Piper voice models

## Why Windows 10+ and .NET 9?

This application can use either:
- **Windows.Media.SpeechSynthesis** from the **Windows Runtime (WinRT)** API, which is only available on Windows 10 build 19041 and newer
- **Piper** via **PiperSharp**, a fast local neural TTS engine that works entirely offline and supports many languages

## Building and Running

### **Build the application**
```powershell
cd translations_csv\TextToSpeechApp
dotnet build
```

### **Run the application**
```powershell
# Using default CSV file and the TTS provider from settings.json
dotnet run

# Specify a CSV file
dotnet run "csv_files/finnish_english_corporate_phrases.csv"

# Specify CSV file and starting line number
dotnet run "csv_files/finnish_english_technical_vocabulary.csv" 50

# Use Piper TTS provider (overrides settings.json)
dotnet run --tts:piper

# Use Windows TTS provider (overrides settings.json)
dotnet run --tts:windows

# Short form with other arguments
dotnet run -tts:Piper "csv_files/misc_words_en_vi_fi.csv" 100
```

### **Publish for distribution**
```powershell
dotnet publish -c Release -r win-x64 --self-contained
```

## Command-line Arguments

```
TextToSpeechApp [path] [line number] [--tts:{provider}]
```

- **path**: Optional path to a CSV file. Defaults to `translations_csv/translations.csv`
- **line number**: Optional line number to start reading from (1-based index)
- **--tts:{provider}** or **-tts:{provider}**: Override the TTS provider (Windows or Piper). Case-insensitive (`--tts:Piper` = `--tts:piper`). Overrides the `TtsProvider` setting in `settings.json`.

### **Examples**
```powershell
# Use default CSV file with Windows TTS
dotnet run --tts:windows

# Use Piper with a specific CSV file
dotnet run --tts:piper "csv_files/finnish_english_corporate_vocab.csv"

# Start from line 100 using Piper
dotnet run "csv_files/misc_words_en_vi_fi.csv" 100 --tts:piper

# Use absolute path with Windows TTS
dotnet run -tts:Windows "C:\path\to\your\translations.csv"
```

## TTS Provider Configuration

The application supports two TTS providers via a profile system in `settings.json`:

### settings.json structure

```json
{
  "translation_filepath": "..\\translations.csv",
  "TtsProvider": "Windows",
  "TtsProviders": {
    "Windows": {
      "PiperVoices": {
        "English": "en_US-lessac-medium",
        "Finnish": "fi_FI-harri-low"
      }
    },
    "Piper": {
      "PiperVoices": {
        "English": "en_GB-northern_english_male-medium",
        "Finnish": "fi_FI-harri-medium",
        "Vietnamese": "vi_VN-vivos-x_low"
      }
    }
  }
}
```

- **TtsProvider**: The active provider selector — set to `"Windows"` or `"Piper"`
- **TtsProviders**: A dictionary of named provider configurations
  - The dictionary **key** is the provider name (no duplicate `TtsProvider` field inside)
  - **PiperVoices**: Maps a language name to a Piper voice model key (only used by Piper)

To switch providers, change `"TtsProvider"` from `"Windows"` to `"Piper"` (or use `--tts:piper` at the command line).

### Provider Comparison

| Feature | Windows | Piper |
|---------|---------|-------|
| Voice quality | Windows SAPI voices | Neural TTS (high quality) |
| Offline | Yes (with installed voices) | Yes (models downloaded once) |
| Languages | Depends on installed Windows voices | Broad language support |
| First-run setup | Install Windows language packs | Auto-downloads Piper engine + models |
| Performance | Uses system resources | Uses local CPU (ONNX runtime) |

## CSV File Format

The application expects CSV files with the following format:
- First row contains language headers (e.g., "English", "Finnish", "Vietnamese")
- Each subsequent row contains translations in corresponding languages
- Empty cells are allowed (will be skipped during speech)

Example:
```csv
English,Finnish,Vietnamese
hello,hei,xin chào
goodbye,näkemiin,tạm biệt
```

## Features

### **Multi-language Support**
- Automatically detects languages from CSV headers
- Uses configured TTS provider voices for each language
- Falls back to system default voice if language-specific voice not available

### **Interactive Controls**
While the application is running:
- **ESC key**: Stop speech and exit application
- **ENTER key**: Pause speech for 10 seconds
- **SPACEBAR**: Pause speech (press SPACEBAR again to resume)
- **Ctrl+C**: Emergency stop (console interrupt)

### **Randomized Playback**
- Selects translation entries randomly for varied practice
- Speaks each language in a row sequentially
- Displays progress counter (e.g., "001 / 150")

## Available CSV Files

The `csv_files/` directory contains several pre-populated translation files:
- `finnish_english_corporate_phrases.csv` - Business and corporate phrases
- `finnish_english_corporate_vocab.csv` - Corporate vocabulary
- `finnish_english_technical_vocabulary.csv` - Technical terms
- `misc_words_en_vi_fi.csv` - Miscellaneous words in English, Vietnamese, Finnish
- `finnish_english_corporate_phrases_vietnamese.csv` - Trilingual corporate phrases

## Technical Details

### **Project Configuration**
```xml
<TargetFramework>net9.0-windows10.0.19041.0</TargetFramework>
<UseWinRT>true</UseWinRT>
<RuntimeIdentifier>win-x64</RuntimeIdentifier>
```

### **Dependencies**
- `TranslationTools` project (shared library for CSV parsing)
- `TextToSpeechCore` project (shared TTS interfaces and Piper implementation)
- `CliUtils` project (console utilities)
- `Microsoft.Extensions.DependencyInjection` (v10.0.3)
- Windows WinRT APIs (provided by Windows)
- PiperSharp (v1.0.6) — local neural TTS engine

### **Voice Selection**
The application matches CSV language headers to configured voices:

**Windows provider:**
1. Tries to find exact language match (e.g., "fi-FI" for Finnish)
2. Falls back to generic language match (e.g., any "fi-*" voice)
3. Uses system default voice if no match found

**Piper provider:**
1. Uses the configured Piper voice model key from settings.json (e.g., "en_GB-northern_english_male-medium")
2. Downloads the model on first use if not cached locally

## Troubleshooting

### **"No translation entries found"**
- Ensure CSV file exists and is accessible
- Check CSV format (headers in first row)
- Verify file path is correct

### **"Using default voice" messages**
- **Windows provider**: Windows may not have voices installed for certain languages — install additional voices via Windows Settings → Time & Language → Speech
- **Piper provider**: The language may not have a configured voice in settings.json — add a PiperVoices entry

### **Build errors about WinRT**
- Ensure you have .NET 9 SDK installed
- Verify Windows 10 version 19041 or newer
- Check that `UseWinRT` property is enabled in csproj

### **Application crashes on startup**
- Run as Administrator if experiencing permission issues
- Check Windows Speech services are running
- Verify .NET 9 runtime is installed

### **Piper provider not working**
- Check that `TtsProvider` is set to `"Piper"` in settings.json
- Verify the PiperVoices entry exists for your language
- Check internet connection on first run (Piper engine and models are downloaded automatically)
- Ensure the `models/` and `piper/` directories are not blocked by antivirus

## Example Session

```
Loading CSV entries from 'csv_files/finnish_english_corporate_phrases.csv' ...
Available voices:
- Microsoft David Desktop (en)
- Microsoft Zira Desktop (en)
- Microsoft Heera Desktop (en)
Using voice: Microsoft David Desktop for language: en
Loaded entries: 150
Starting text-to-speech for translation entries. Press Ctrl+C or ESC to stop.
Press Enter to pause for 10 seconds. Press space bar to pause and again to resume.
Reciting 150 entries, randomly.
001 / 150 :: "Good morning","Hyvää huomenta"
002 / 150 :: "Thank you for your email","Kiitos sähköpostistasi"
[ESC pressed]
Esc pressed — stopping speech. Exiting.
```

## Development Notes

- The application uses asynchronous speech synthesis to prevent blocking
- Each language has its own synthesizer and player instance
- Memory is properly disposed via `IDisposable` pattern
- Console input is non-blocking (uses `Console.KeyAvailable`)
- The TTS provider can be switched at runtime via `--tts:piper` or `-tts:windows` without editing settings.json

## Related Projects

- **TranslationTools** - Core library for CSV parsing and translation entry management
- **TextToSpeechCore** - Shared TTS interfaces and PiperTextToSpeechService implementation
- **AddEntryApp** - Application for adding new entries to translation CSV files
- **OllamaTranslatorApp** - AI-powered translation using Ollama API

## License

See the parent directory `LICENSE` file for licensing information.