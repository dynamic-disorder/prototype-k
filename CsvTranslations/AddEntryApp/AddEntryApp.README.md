AddEntryApp

- Purpose: Console app that appends English entries to the workspace `translations.csv`, with optional automatic translation using Ollama API.
- Run:

```powershell
cd AddEntryApp
dotnet run
```

## Features

### 1. **Dual Input Modes**
   - **Manual Mode**: Appends English text with empty Finnish translation (default).
   - **Ollama Mode**: Automatically translates English to Finnish using Ollama API and adds relevant hashtags.

   **Switch between modes**: Press **Shift+Tab** at any time to toggle between Manual and Ollama mode.

### 2. **Search Functionality**
   - Enter `--search` to load all existing entries for searching.
   - In Search Mode, type any text to find matching English entries with their Finnish translations.
   - Leave input empty to exit Search Mode and return to Add Mode.

### 3. **CSV Format**
   - In Manual Mode: Appends `"English",""` (Finnish column empty).
   - In Ollama Mode: Appends `"English","Finnish translation","hashtags"` (translation and hashtags provided by Ollama).

## Usage

1. **Start the app**: `dotnet run` from the AddEntryApp directory.
2. **Mode indicator**: The prompt shows current mode: `Add Mode [Manual]` or `Add Mode [Ollama]`.
3. **Enter English text** and press Enter to add an entry.
4. **Switch modes** anytime with Shift+Tab.
5. **Search entries** by typing `--search`.
6. **Quit**: Leave input empty and press Enter.

## Ollama API Integration

- The app uses a local Ollama instance (default URL: `http://localhost:11434`).
- In Ollama Mode, each English entry is sent to Ollama with a translation prompt.
- The prompt is loaded from `settings.json` when switching into Ollama Mode.
- The response is parsed into Finnish translation and 1-3 relevant hashtags.
- If Ollama is unavailable, the app will fail to translate; switch back to Manual Mode with Shift+Tab.

## Configuring the Ollama prompt

- Open `settings.json` in the `AddEntryApp` directory.
- Edit the `OllamaPrompt` value to change the prompt template.
- The prompt should include the `{text}` placeholder for the source English text.

Example `settings.json`:

```json
{
  "OllamaPrompt": "Translate '{text}' to Finnish. Return ONLY one line in this exact format: <translation> | <hashtags>\nWhere <translation> is the Finnish translation (if multiple candidates, separate with '/') and <hashtags> are 1-3 relevant category hashtags in English (e.g. #noun #verb #food). Example: dog | #noun #animal"
}
```

## Example Session

```
Appending new entries to: translations.csv
Press Shift+Tab to switch between Manual and Ollama mode.
Add Mode [Manual]:: Enter English text (leave empty to quit): hello
Added (Finnish left empty). Waiting for next input...
Add Mode [Manual]:: Enter English text (leave empty to quit): [Shift+Tab]
Switched to Ollama mode. Press Shift+Tab to return to Manual mode.
Add Mode [Ollama]:: Enter English text (leave empty to quit): dog
Translating with Ollama (http://localhost:11434) API...
Added (Ollama translated). Waiting for next input...
Add Mode [Ollama]:: Enter English text (leave empty to quit):
Exiting. Goodbye.
```


