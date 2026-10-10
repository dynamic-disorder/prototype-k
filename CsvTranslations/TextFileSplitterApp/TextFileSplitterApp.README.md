TextFileSplitterApp

A console application that splits large text files into smaller files with configurable line limits, and optionally formats them as CSV translation entries.

## Purpose

Splits large text files into manageable chunks for easier processing, storage, or translation workflows. Useful when dealing with large translation datasets or text corpora that need to be broken down into smaller files.

## Usage

```powershell
TextFileSplitter <input_file_path> <max_lines_per_file> [--csv]
TextFileSplitter /help   # or --help, -h, /?, -?
```

### Arguments
- `input_file_path`: Path to the text file to split
- `max_lines_per_file`: Maximum number of lines per output file (must be between 250 and 25000)
- `--csv`: Optional flag to format split files as CSV translation entries

### Help Options
- `/help`, `--help`, `-h`, `/?`, `-?`: Display help information

### Notes
- Running the application without any arguments will display help
- Help text is loaded from `TextFileSplitterApp.syntax.txt` file when available

### Examples
```powershell
# Split a file with 1000 lines per chunk
TextFileSplitter "C:\data\large_file.txt" 1000

# Split and format as CSV entries
TextFileSplitter "C:\data\translations.txt" 500 --csv

# Run from project directory
cd translations_csv\TextFileSplitterApp
dotnet run "..\translations.csv" 1000 --csv
```

## Features

### 1. **Preview Before Splitting**
- Shows total lines in input file
- Estimates number of output files
- Requires user confirmation before proceeding
- Displays: `Do you want to proceed with splitting the file? (y/n)`

### 2. **Configurable Split Size**
- Minimum: 250 lines per file
- Maximum: 25,000 lines per file
- Output files are numbered sequentially: `input_001.txt`, `input_002.txt`, etc.

### 3. **CSV Header Preservation**
- **Automatically detects CSV files** (`.csv` extension)
- **Preserves header row** in every split file
- Maintains CSV structure across all output files
- Shows warning when header is detected: `CSV header detected and will be included in split files: ...`

### 4. **CSV Formatting Option**
- With `--csv` flag: formats each line as `<entry>line text</entry>`
- Creates `*_formatted.txt` files alongside split files
- Useful for preparing translation entries for CSV import

### 5. **Error Handling**
- Validates file existence and accessibility
- Checks line count parameter range
- Provides clear error messages
- Graceful exit on cancellation

### 4. **Error Handling**
- Validates file existence and accessibility
- Checks line count parameter range
- Provides clear error messages
- Graceful exit on cancellation

## CSV Formatting Example

When using the `--csv` flag, each line in split files gets wrapped in `<entry>` tags:

**Input line:**
```
Hello world
```

**Formatted output:**
```
<entry>Hello world</entry>
```

## Build and Run

### Build
```powershell
cd translations_csv\TextFileSplitterApp
dotnet build
```

### Run (from project directory)
```powershell
dotnet run "input.txt" 1000
```

### Run compiled executable
```powershell
.\bin\Debug\net9.0\TextFileSplitterApp.exe "input.txt" 500 --csv
```

## Example Session

```
> TextFileSplitter "large_translations.txt" 1000 --csv

Input file: large_translations.txt
Total lines in file: 5250
Max lines per file: 1000
Estimated number of files to be created: 6

Do you want to proceed with splitting the file? (y/n)
y
Proceeding with file splitting...
File splitting complete.
Details: Split 5250 lines into 6 files.

CSV option detected. Formatting the split files as CSV...
File formatted and saved to: large_translations_001_formatted.txt
...
CSV formatting complete.
```

## Integration with Other Apps

- **AddEntryApp**: Use split files as source for adding translation entries
- **OllamaTranslatorApp**: Process split files through AI translation
- **TextToSpeechApp**: Use formatted entries for speech synthesis practice

## Notes

- The app preserves all lines including empty lines
- Output files are created in the same directory as input file
- User confirmation prevents accidental large file operations
- CSV formatting creates separate files (doesn't modify original splits)