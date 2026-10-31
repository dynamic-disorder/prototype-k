TextToSpeechApp

A console application that reads translation entries from CSV files aloud using **Piper**, a local neural TTS engine (PiperSharp). The application randomly selects entries and reads them in their respective languages, helping with language learning through audio repetition.

There is **one build and one artifact for Windows, Linux and macOS**: the app targets `net10.0` and contains no platform-specific code. Only audio output differs, and that is handled by handing the synthesized WAV to a command-line player the machine already has.

## Prerequisites

### **Required Software**
- **.NET 10 SDK** - The application targets `net10.0`
- **A command-line audio player on `PATH`**:
  - **Linux**: the first of `pw-play` (PipeWire), `paplay` (PulseAudio), `aplay` (ALSA) or `ffplay` (ffmpeg)
  - **macOS**: `afplay`, which ships with the system
  - **Windows**: PowerShell (`powershell.exe` or `pwsh.exe`), which plays through `System.Media.SoundPlayer`

### **System Requirements**
- The Piper engine and voice models are downloaded automatically on first run (roughly 60 MB per language, once) and then cached
- Sufficient disk space for the .NET 10 runtime and the Piper voice models

## Why Piper?

**Piper** via **PiperSharp** is a fast local neural TTS engine that works entirely offline and supports many languages, identically on every OS.

The Windows Speech API provider (`Windows.Media.SpeechSynthesis`) has been removed. It requires WinRT and a Windows-only target framework, so keeping it would have meant a second, Windows-only build — the opposite of platform independence. Piper replaced it.

## Building and Running

### **Build the application**
```bash
cd CsvTranslations/TextToSpeechApp
dotnet build
```

### **Run the application**
```bash
# Using the default CSV file
dotnet run

# Specify a CSV file
dotnet run "csv_files/finnish_english_corporate_phrases.csv"

# Specify CSV file and starting line number
dotnet run "csv_files/finnish_english_technical_vocabulary.csv" 50

# Name the provider explicitly (Piper is the only one)
dotnet run --tts:piper

# Short form with other arguments
dotnet run -tts:Piper "csv_files/misc_words_en_vi_fi.csv" 100
```

### **Publish for distribution**
```bash
# Self-contained, for the machine you are on
dotnet publish -c Release --self-contained

# Or cross-publish for a specific platform, keeping the same single build
dotnet publish -c Release -r linux-x64 --self-contained
dotnet publish -c Release -r win-x64 --self-contained
```

## Command-line Arguments

```
TextToSpeechApp [path] [line number] [--tts:{provider}]
```

- **path**: Optional path to a CSV file. Defaults to `translations.csv`, located by searching the working directory and its parents
- **line number**: Optional line number to start reading from (1-based index)
- **--tts:{provider}** or **-tts:{provider}**: Select the TTS provider. Piper is the only one, so the option is accepted for compatibility and validated: anything else is reported and the app continues with Piper. Case-insensitive (`--tts:Piper` = `--tts:piper`). Overrides the `TtsProvider` setting in `settings.json`.

### **Examples**
```bash
# Use the default CSV file
dotnet run

# Use a specific CSV file
dotnet run "csv_files/finnish_english_corporate_vocab.csv"

# Start from line 100
dotnet run "csv_files/misc_words_en_vi_fi.csv" 100

# Use a path outside the working directory (~ is the home directory on Linux and macOS)
dotnet run -tts:"~/translations.csv"
```

## TTS Provider Configuration

The application configures its TTS provider through `settings.json`. Piper is the only provider, so the dictionary exists to carry its voice configuration:

### settings.json structure

```json
{
  "translation_filepath": "../translations.csv",
  "TtsProvider": "Piper",
  "TtsProviders": {
    "Piper": {
      "PiperVoices": {
        "English": {
          "LanguageCode": "en_GB",
          "ModelCard": "northern_english_male",
          "ModelQuality": "medium",
          "SpeakerName": "default",
          "SpeakerId": "1"
        },
        "Finnish": {
          "LanguageCode": "fi_FI",
          "ModelCard": "harri",
          "ModelQuality": "medium",
          "SpeakerName": "default",
          "SpeakerId": "1"
        },
        "Vietnamese": {
          "LanguageCode": "vi_VN",
          "ModelCard": "vivos",
          "ModelQuality": "x_low",
          "SpeakerName": "VIVOSDEV09",
          "SpeakerId": "54"
        }
      }
    }
  }
}
```

- **TtsProvider**: The active provider selector. Set it to `"Piper"`. A settings file that still says `"Windows"` is read as `"Piper"`, and the app says so once at startup, because that provider was removed.
- **TtsProviders**: A dictionary of named provider configurations
  - The dictionary **key** is the provider name (no duplicate `TtsProvider` field inside)
  - **PiperVoices**: Maps a language name to a detailed Piper voice configuration (only used by Piper):
    - **LanguageCode**: Piper language code (e.g. `"vi_VN"`, `"fi_FI"`, `"en_GB"`)
    - **ModelCard**: Model card / dataset name (e.g. `"vivos"`, `"harri"`)
    - **ModelQuality**: Voice model quality (e.g. `"x_low"`, `"medium"`, `"high"`)
    - **SpeakerName**: Optional speaker name (e.g. `"VIVOSDEV09"`) resolved via the model's `speaker_id_map`
    - **SpeakerId**: Optional numeric speaker id (e.g. `"54"` → `--speaker 54`); preferred over `SpeakerName` when valid
  - The Piper model key is composed as `LanguageCode-ModelCard-ModelQuality` (e.g. `"vi_VN-vivos-x_low"`)

Piper is the only provider, so `--tts:piper` changes nothing — it exists so scripts written for the old two-provider setup keep working. `--tts:windows` is reported and ignored.

### Playback Per Platform

Audio output is the only part that differs between operating systems. The synthesized WAV is
written to a temporary file and handed to the first player found on `PATH`:

| OS | Players, in order of preference |
| :--- | :--- |
| Linux | `pw-play`, `paplay`, `aplay`, `ffplay` |
| macOS | `afplay` |
| Windows | `powershell.exe`, then `pwsh.exe` (through `System.Media.SoundPlayer`) |

The file is deleted once playback finishes. If no player is found the app stops with a message
naming the players it tried.

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
- Detects the languages from the CSV headers
- Speaks each row in the languages it contains, using the Piper voice configured for each
- Reports, rather than guesses, a language that has no `PiperVoices` entry in `settings.json`

### **Interactive Controls**
While the application is running:
- **ESC key**: Stop speech and exit application
- **ENTER key**: Pause speech for 10 seconds
- **SPACEBAR**: Pause speech (press SPACEBAR again to resume)
- **Ctrl+C**: Emergency stop (console interrupt)

### **Randomized Playback**
- Selects translation entries randomly for varied practice
- Speaks each language in a row sequentially
- Displays a progress counter (e.g., `001 / 150`)

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
<!-- From Directory.Build.props; the project itself sets only OutputType -->
<TargetFramework>net10.0</TargetFramework>
```

No `RuntimeIdentifier` and no `UseWinRT`: the same assembly runs on every platform.

### **Dependencies**
- `TranslationTools` project (shared library for CSV parsing)
- `TextToSpeechCore` project (shared TTS interfaces and Piper implementation)
- `CliUtils` project (console utilities)
- `Microsoft.Extensions.DependencyInjection` (v10.0.12)
- PiperSharp (v1.0.7) — local neural TTS engine
- NAudio.Wasapi (v3.1.0) — called by PiperSharp's WAV conversion, not used for playback
- The OS's own command-line audio player — see *Playback Per Platform*

### **Voice Selection**
Each language in the CSV is matched to its configured Piper voice:
1. The `PiperVoices` entry for the language supplies the model key (e.g. `en_GB-northern_english_male-medium`)
2. The model is downloaded on first use, then reused from the cache
3. A language with no entry is reported and not spoken

## Troubleshooting

### **"No translation entries found"**
- Check that the CSV exists, that its first row holds the language headers, and that the path resolves

### **Text appears but nothing is heard**
- No audio player was found. Install one: `pw-play`, `paplay`, `aplay` or `ffplay` on Linux, `afplay` on macOS, PowerShell on Windows. The app names the players it tried.

### **A language is not spoken**
- Add a `PiperVoices` entry for it in `settings.json`; the startup output lists what was configured

### **Piper fails to initialise**
- The first run needs network access for the engine and voice models. Later runs reuse `piper/` and `models/`, so no download is needed.

## Example Session

```
Loading CSV entries from 'translations.csv' ...
Loaded 3077 lines from translations CSV file - one is expected to be a header line.

LANGUAGES CONTAINED IN THE .CSV FILE
  • Detected source language: English
  • Detected target language: Finnish

  • Piper TTS engine is cached (69.2 MB).
  • Voice model 'en_GB-northern_english_male-medium' is cached (60.3 MB).
  • Using Piper voice: en_GB-northern_english_male-medium for language: English (speaker id: 1)
  • Voice model 'fi_FI-harri-medium' is cached (60.3 MB).
  • Using Piper voice: fi_FI-harri-medium for language: Finnish (speaker id: 1)

Ctrl+C / ESC: stop   ·   Enter: pause 10 seconds   ·   Space: pause / resume

Reciting 3077 entries, randomly.
0001 / 3077 ::
  en: penance
  fi: rangaistus
[ESC pressed]
Esc pressed — stopping speech. Exiting.
```

## Development Notes

- Speech synthesis is asynchronous, so display and key handling keep running while audio plays
- Only audio output is platform-specific: each utterance is played by a child process (see *Playback Per Platform*)
- Console input is non-blocking (`Console.KeyAvailable`)
- `--tts:piper` is accepted for compatibility; `--tts:windows` reports that the provider was removed

## Related Projects

- **TranslationTools** - Core library for CSV parsing and translation entry management
- **TextToSpeechCore** - Shared TTS interfaces and PiperTextToSpeechService implementation
- **AddEntryApp** - Application for adding new entries to translation CSV files
- **OllamaTranslatorApp** - AI-powered translation using Ollama API

## License

See the parent directory `LICENSE` file for licensing information.
