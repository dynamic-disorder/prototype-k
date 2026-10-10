OllamaTranslatorApp

A Windows console application that translates CSV files using offline AI via Ollama API. The application translates English text to Finnish (or other languages as configured) and adds relevant hashtags for categorization.

## Overview

The OllamaTranslatorApp processes CSV files containing translation entries, sends the source text to a local Ollama instance for AI-powered translation, and saves the results to output CSV files. It supports both single-file and batch folder processing.

## Prerequisites

### **Required Software**
- **.NET 9 SDK** - The application targets `net9.0`
- **Ollama** - Local AI inference server (https://ollama.com)
- **Windows, macOS, or Linux** (cross-platform .NET console app)

### **Ollama Setup**
1. Install Ollama from https://ollama.com
2. Pull a translation-capable model (example models below)
3. Start Ollama service (usually runs on http://localhost:11434)

### **Recommended Ollama Models**
- `translategemma:12b` - Made for translator tasks. Running the translategemma:12b model (which is based on the Google Gemma 3 12B architecture) via Ollama requires substantial hardware to achieve good performance, with 12B models typically requiring 8–16 GB of VRAM or 16-32 GB of system RAM for stable operation.
- `gemma2:2b` or `gemma2:9b` - Good for translation tasks
- `qwen2.5-coder:7b` - Multilingual coding/translation
- `llama3.2:3b` - General purpose translation
- `mixtral:8x7b` - High quality but resource intensive

## Building and Running

### **Build the application**
```powershell
cd translations_csv\OllamaTranslatorApp
dotnet build
```

### **Run the application**
```powershell
# Show help
dotnet run --help

# Translate single CSV file
dotnet run input.csv output.csv

# Process all CSV files in a folder
dotnet run --folder my_csv_files

# Run built executable
.\bin\Debug\net9.0\OllamaTranslatorApp.exe input.csv output.csv
```

### **Publish for distribution**
```powershell
dotnet publish -c Release -r win-x64 --self-contained
```

## Command-line Syntax

```
Usage:
  OllamaTranslatorApp <source_file> <target_file>
  OllamaTranslatorApp --folder <folder_path>

Arguments:
  <source_file>   Path to input file (CSV, TXT, MD, TEXT)
  <target_file>   Path where translated file will be saved

Options:
  --help, -h     Show this help message
  --folder       Process all supported files in the folder

Supported File Types:
  • CSV files (.csv) - For translation databases
  • Text files (.txt, .md, .text) - For stories and documents

Example:
  OllamaTranslatorApp --help
  OllamaTranslatorApp --folder my_documents
  OllamaTranslatorApp input.csv output.csv
  OllamaTranslatorApp story.txt story.translated.txt
```

## CSV File Format

The input CSV file must contain the header row with the following columns: "SourceText" and "TargetText". Optional columns "Hashtags" and "Semantics" can be included to provide additional context for translation.

- **SourceText**: The original text to be translated (required)
- **TargetText**: The translated text (can be empty initially, will be populated by translation)
- **Hashtags**: Optional categorization tags (e.g., "#noun #greeting")
- **Semantics**: Optional semantic context to improve translation accuracy

### **Example input.csv with semantics:**
```csv
SourceText,TargetText,Semantics
Hello world,,general greeting
Good morning,,morning greeting
Thank you for your email,,business communication
The mouse ate the cheese,,animal behavior context
```

### **Example output.csv after translation:**
```csv
SourceText,TargetText
Hello world,Hei maailma | #greeting #noun
Good morning,Hyvää huomenta | #greeting #time
Thank you for your email,Kiitos sähköpostistasi | #business #communication
The mouse ate the cheese,Hirvi söi juuston | #animal #action
```

## Configuration

The application uses `ollama-settings.json` for configuration. This file should be placed in the same directory as the executable.

### **Default ollama-settings.json:**
```json
{
  "ApiUrl": "http://localhost:11434/api/generate",
  "ModelName": "translategemma:12b",
  "Prompt": "Translate: `{text}`. Source language: English. Target language: Finnish. Use semantic context `{semantics}` when provided to improve accuracy. Return response as a one-liner plain text. If there isn't a direct/accurate enough translation, return `{text}`.",
  "KeepAlive": "10m",
  "ModelAliases": {
    "default": "translategemma:12b",
    "fast": "tinyllama",
    "accurate": "llama2:13b"
  },
  "PromptExamples": {
    "Basic": "Translate: `{text}`. Source language: English. Target language: Finnish. Return response as a one-liner plain text. If there isn't a direct/accurate enough translation, return `[?]{text}`.",
    "WithSemantics_Explicit": "Translate: `{text}`. Source language: English. Target language: Finnish. Use semantic context `{semantics}` to improve translation accuracy when needed. Follow these rules: 1) If direct translation exists, provide it. 2) If ambiguous, use semantic context to choose best match. 3) If no good translation exists despite context, return `[?]{text}`. Output format: single line with translation only.",
    "WithSemantics_ForComplex": "Translate: `{text}` from Vietnamese to Finnish. Semantic context: `{semantics}`. Use this context to disambiguate meaning and provide accurate translation. Output format: <translation> (if multiple valid translations, separate with '/'). If translation impossible even with context, return `[?]{text}`. Do not include explanations or metadata.",
    "WithSemantics_Structured": "You are a translation assistant. Translate the following text: `{text}`. Source language: Vietnamese. Target language: Finnish. Additional semantic context provided: `{semantics}`. Instructions: Analyze the semantic context to understand nuance and context. Provide the most accurate Finnish translation. If the text has multiple possible translations, list them separated by '/'. If translation cannot be determined even with semantic context, output exactly: `[?]{text}`. Respond with only the translation, no additional text."
  }
}
```

### **Configuration Options:**
- **ApiUrl**: The Ollama API endpoint (default: http://localhost:11434/api/generate)
- **ModelName**: The Ollama model to use for translation
- **Prompt**: The translation prompt template. The `{text}` placeholder will be replaced with the source text, and `{semantics}` will be replaced with contextual information when available.
- **KeepAlive**: How long to keep the model loaded in memory (default: "10m")
- **ModelAliases**: Dictionary mapping alias names (e.g., "fast", "accurate") to specific model names for dynamic model switching
- **PromptExamples**: Collection of example prompts showing different approaches to translation with semantic context

### **Customizing for Other Languages:**
To translate to other languages, modify the prompt in `ollama-settings.json`:
```json
"Prompt": "Translate '{text}' to Spanish. Return ONLY one line in this exact format: <translation> | <hashtags>\nWhere <translation> is the Spanish translation and <hashtags> are 1-3 relevant category hashtags in English."
```

## Usage Examples

### **1. Translate a Single CSV File**
```powershell
# Basic usage
OllamaTranslatorApp input.csv output.csv

# Using relative paths
OllamaTranslatorApp ..\data\phrases.csv ..\data\translated_phrases.csv

# Using absolute paths
OllamaTranslatorApp "C:\translations\input.csv" "C:\translations\output.csv"
```

### **2. Batch Process All CSV Files in a Folder**
```powershell
# Process all .csv files in the 'my_translations' folder
OllamaTranslatorApp --folder my_translations

# Output files will be created with .translated.csv suffix:
# - my_translations\phrases.csv → my_translations\phrases.translated.csv
# - my_translations\vocabulary.csv → my_translations\vocabulary.translated.csv
```

### **3. Using with Build Toolchain**
```powershell
# Build and run in one step
dotnet run -- input.csv output.csv

# Build release version
dotnet build -c Release

# Run release version
.\bin\Release\net9.0\OllamaTranslatorApp.exe input.csv output.csv
```

## Features

### **AI-Powered Translation**
- Uses local Ollama AI for offline translation
- Supports custom prompts for different translation styles
- Adds relevant hashtags for categorization
- Handles multiple translation candidates (separated by '/')

### **Batch Processing**
- Process single files or entire folders
- Automatic output file naming for folder mode
- Progress indicators for each file

### **Error Handling**
- Validates CSV file existence and format
- Checks Ollama API connectivity
- Continues processing other files if one fails
- Detailed error messages for troubleshooting

### **UTF-8 Support**
- Full Unicode support for multilingual text
- Proper encoding handling for special characters

## How It Works

1. **Input Validation**: Checks if source CSV file exists and has correct format
2. **CSV Parsing**: Reads "SourceText" column from input file
3. **AI Translation**: Sends each text to Ollama API with configured prompt
4. **Response Parsing**: Extracts translation and hashtags from Ollama response
5. **Output Generation**: Writes translations to "TargetText" column in output file
6. **Progress Reporting**: Shows translation progress for each file

## Troubleshooting

### **"Error: No valid translation requests found."**
- Check command-line arguments
- Ensure CSV files exist in specified folder (for --folder mode)
- Verify CSV files have .csv extension

### **"Error: Source file does not exist."**
- Verify file path is correct
- Use absolute paths if unsure
- Check file permissions

### **"Error connecting to Ollama API"**
- Ensure Ollama is running (`ollama serve` or Ollama desktop app)
- Check API URL in ollama-settings.json (default: http://localhost:11434)
- Verify network connectivity to localhost
- Test with: `curl http://localhost:11434/api/generate` (see Ollama documentation)

### **"Warning: Source file may not be a CSV file."**
- Ensure file has .csv extension
- Check file format (comma-separated values)

### **Slow Translation Performance**
- Use smaller Ollama models for faster inference
- Reduce batch size (process fewer files at once)
- Ensure sufficient system resources (RAM, CPU)

### **Poor Translation Quality**
- Adjust the prompt in ollama-settings.json
- Try different Ollama models
- Provide more context in source text if needed

## Integration with Other Apps

### **AddEntryApp Compatibility**
- Both apps use the same CSV format
- Use AddEntryApp to create/manage translation entries
- Use OllamaTranslatorApp to translate entries in bulk

### **TextToSpeechApp Compatibility**
- Translated CSV files can be used with TextToSpeechApp
- Speech app reads both source and translated text for language practice

### **TranslationTools Library**
- Shared library for CSV parsing and translation management
- Consistent behavior across all translation apps

## Example Workflow

1. **Collect Texts**: Gather English texts needing translation in a CSV file
2. **Configure Ollama**: Install Ollama and pull a translation model
3. **Translate**: Run `OllamaTranslatorApp texts.csv translated_texts.csv`
4. **Review**: Check translations in output CSV file
5. **Use**: Import translated CSV into other apps or use directly

## Advanced Usage

### **Custom Translation Prompts**
Create specialized prompts for different domains:
```json
"Prompt": "Translate this technical term '{text}' to Finnish. Return ONLY one line: <translation> | <hashtags>\nExample: algorithm | #computing #noun"
```

### **Multiple Language Support**
Configure different settings files for different languages:
```powershell
# Copy and modify settings for different languages
copy ollama-settings.json ollama-settings-spanish.json

# Run with custom settings (requires code modification)
```

### **Automation Scripts**
```powershell
# PowerShell script for batch processing
Get-ChildItem -Path ".\input_data" -Filter "*.csv" | ForEach-Object {
    $output = ".\output_data\$($_.BaseName).translated.csv"
    .\OllamaTranslatorApp.exe $_.FullName $output
}
```

## Performance Considerations

- **Model Size**: Larger models (7B+) produce better translations but are slower
- **Batch Size**: The app processes one text at a time for reliability
- **Network**: Local Ollama (localhost) minimizes latency
- **Memory**: Ollama models load into RAM; ensure sufficient memory

## Related Projects

- **AddEntryApp** - Console app for adding new entries to translation CSV files
- **TextToSpeechApp** - Windows app for speech synthesis of translation entries
- **TextFileSplitterApp** - Utility for splitting large text files
- **TranslationTools** - Core library for CSV parsing and translation management

## Development

### **Project Structure**
- `Program.cs` - Main entry point and command-line parsing
- `ollama-settings.json` - Configuration file
- `csv_files/` - Example CSV files and documentation

### **Dependencies**
- `OllamaTranslatorApi` - Core translation library
- `TranslationTools` - CSV parsing utilities

### **Building from Source**
```powershell
# Clone repository
git clone https://github.com/khryo-makhina/public.git
cd public\translations_csv\OllamaTranslatorApp

# Restore dependencies
dotnet restore

# Build
dotnet build

# Run tests
cd ..\OllamaTranslatorApi.Tests
dotnet test
```

## Support

For issues, questions, or contributions:
1. Check existing documentation in this README
2. Review other app READMEs for similar patterns
3. Examine example files in `csv_files/` directory
4. Check parent directory `translations_csv/README.md` for overview

## License

See the parent directory `LICENSE` file for licensing information.

---

*Last Updated: April 2026*