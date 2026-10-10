using System.Text;
using System.Text.Json;

using CliUtils;

using OllamaTranslatorApi.Core;
using OllamaTranslatorApi.Models;

using TranslationTools;

namespace AddEntryApp;

internal sealed class Program
{
    private const string SettingsJsonFilename = "settings.json";
    private static readonly JsonSerializerOptions s_jsonSerializerOptions = new JsonSerializerOptions
    {
        PropertyNameCaseInsensitive = true
    };

    private enum InputMode { Manual, Ollama }

    public static async Task Main(string[] args)
    {
        Console.OutputEncoding = Encoding.UTF8;

        var translationFinder = new TranslationsFinder();
        var translationFilepath = translationFinder.FindTranslationsCsvFilepath();

        ConsoleColorHelper.WriteInfo($"Appending new entries to: {translationFilepath}");
        ConsoleColorHelper.WriteInfo("Press Shift+Tab to switch between Manual and Ollama mode.");

        var translator = new OllamaTranslator();
        var mode = InputMode.Manual;
        var isSearching = false;
        var allSearchLines = Array.Empty<string>();

        var ollamaApiModel = string.Empty;
        var ollamaApiPrompt = string.Empty;

        while (true)
        {
            PrintModePrompt(isSearching, mode);

            (string? input, bool shiftTabPressed) = ReadLineWithShiftTab();

            if (shiftTabPressed)
            {
                mode = mode == InputMode.Manual ? InputMode.Ollama : InputMode.Manual;
                if (mode == InputMode.Ollama)
                {
                    ollamaApiModel = LoadOllamaApiModelFromSettings();

                    ollamaApiPrompt = LoadOllamaPromptFromSettings();
                    ConsoleColorHelper.WriteInfo($"Switched to Ollama mode. Using promt: {translator.AiPrompt}.");
                    ConsoleColorHelper.WriteInfo($"Switched to Ollama mode. Using Model: {translator.OllamaLlmModelName}.");
                    ConsoleColorHelper.WriteInfo("\n\n");
                    ConsoleColorHelper.WriteInfo($"Ollama API Prompt: {ollamaApiPrompt}.");
                    ConsoleColorHelper.WriteInfo("Press Shift+Tab to return to Manual mode.");
                }
                else
                {
                    ConsoleColorHelper.WriteInfo("Switched to Manual mode. Press Shift+Tab to switch to Ollama mode.");
                }
                continue;
            }

            if (string.IsNullOrWhiteSpace(input))
            {
                if (!isSearching)
                {
                    break;
                }

                isSearching = false;
                allSearchLines = Array.Empty<string>();
                ConsoleColorHelper.WriteInfo("Exited the Search mode. Entries unloaded.");
                ConsoleColorHelper.WriteInfo("Returning to Add mode.");
                continue;
            }

            if (input.StartsWith("--search", StringComparison.Ordinal))
            {
                allSearchLines = EnterSearchMode(translationFinder, translationFilepath);
                isSearching = allSearchLines.Length > 0;
                continue;
            }

            if (isSearching)
            {
                PerformSearch(input, allSearchLines);
                continue;
            }

            string line;
            CsvEntry entry;
            if (mode == InputMode.Ollama)
            {
                ConsoleColorHelper.WriteInfo("Translating with Ollama API...");
                entry = await translator.TranslateAsync(input, ollamaApiPrompt);
            }
            else
            {
                entry = new CsvEntry
                {
                    SourceText = input,
                    TargetText = string.Empty,
                    Hashtags = string.Empty
                };
            }
            line = entry.ToCsvStringWithHashtags();

            try
            {
                if (AppendNewEntry(translationFilepath, line))
                {
                    if (mode == InputMode.Ollama)
                    {
                        ConsoleColorHelper.WriteSuccess($"Added (Ollama translated) translation for '{input}': '{entry.TargetText}'. Waiting for next input...");
                    }
                    else
                    {
                        ConsoleColorHelper.WriteInfo($"Added (Finnish left empty) '{input}'. Waiting for next input...");
                    }
                }
                else
                {
                    break;
                }
            }
            catch (Exception ex)
            {
                ConsoleColorHelper.WriteError($"Failed to append: {ex.Message}");
                break;
            }
        }

        ConsoleColorHelper.WriteInfo("Exiting. Goodbye.");
    }

    /// <summary>
    ///     Reads a line of input from the console, intercepting Shift+Tab before it reaches the buffer.
    /// </summary>
    /// <returns>
    ///     The typed input and a flag indicating whether Shift+Tab was pressed instead of Enter.
    /// </returns>
    private static (string Input, bool ShiftTabPressed) ReadLineWithShiftTab()
    {
        var buffer = new StringBuilder();
        while (true)
        {
            var keyInfo = Console.ReadKey(intercept: true);

            if (keyInfo.Key == ConsoleKey.Tab && keyInfo.Modifiers.HasFlag(ConsoleModifiers.Shift))
            {
                ConsoleColorHelper.WriteLine("", ConsoleColor.Gray);
                return (string.Empty, true);
            }

            if (keyInfo.Key == ConsoleKey.Enter)
            {
                ConsoleColorHelper.WriteLine("", ConsoleColor.Gray);
                return (buffer.ToString(), false);
            }

            if (keyInfo.Key == ConsoleKey.Backspace)
            {
                if (buffer.Length > 0)
                {
                    buffer.Remove(buffer.Length - 1, 1);
                    Console.Write("\b \b");
                }
                continue;
            }

            if (keyInfo.KeyChar != '\0')
            {
                buffer.Append(keyInfo.KeyChar);
                Console.Write(keyInfo.KeyChar);
            }
        }
    }

    /// <summary>
    /// Prints the input prompt corresponding to the current mode.
    /// </summary>
    private static void PrintModePrompt(bool isSearching, InputMode mode)
    {
        if (isSearching)
        {
            ConsoleColorHelper.WriteInfo("Search Mode:: Enter English text (leave empty to quit): ");
        }
        else
        {
            var modeLabel = mode == InputMode.Ollama ? "Ollama" : "Manual";
            ConsoleColorHelper.WriteInfo($"Add Mode [{modeLabel}]:: Enter English text (leave empty to quit): ");
        }
    }

    /// <summary>
    /// Enters search mode by loading existing translation lines from the provided filepath.
    /// </summary>
    /// <param name="translationFinder">A <see cref="TranslationsFinder"/> used to retrieve translation lines.</param>
    /// <param name="translationFilepath">Path to the translations CSV file.</param>
    /// <returns>An array of translation file lines to be used for searching; empty if none found.</returns>
    private static string[] EnterSearchMode(TranslationsFinder translationFinder, string translationFilepath)
    {
        ConsoleColorHelper.WriteInfo("Entered Search mode. Loading existing entries...");
        try
        {
            var parseResult = TranslationsFinder.GetTranslationsLines(translationFilepath);
            var allSearchLines = parseResult.CsvLines;
            if (allSearchLines.Length == 0)
            {
                ConsoleColorHelper.WriteWarning("Exiting Search mode due to no entries found.");
                return Array.Empty<string>();
            }

            ConsoleColorHelper.WriteInfo($"Loaded {allSearchLines.Length} entries for searching.");
            return allSearchLines;
        }
        catch (Exception ex)
        {
            ConsoleColorHelper.WriteError($"Failed to load entries for searching: {ex.Message}");
            return Array.Empty<string>();
        }
    }

    /// <summary>
    /// Performs a search over the provided translation lines and writes matching results to the console.
    /// </summary>
    /// <param name="input">The search query to match against English text.</param>
    /// <param name="allSearchLines">All translation CSV lines previously loaded.</param>
    private static void PerformSearch(string input, string[] allSearchLines)
    {
        try
        {
            ConsoleColorHelper.WriteInfo("Search results:");
            foreach (var searchLine in allSearchLines)
            {
                var columns = searchLine.Split([','], StringSplitOptions.None);
                var englishText = columns.Length >= 2 ? columns[1].Trim('"') : string.Empty;
                if (columns.Length >= 2 && englishText.Contains(input, StringComparison.OrdinalIgnoreCase))
                {
                    var finnishText = columns.Length >= 4 ? columns[3].Trim('"') : string.Empty;
                    ConsoleColorHelper.WriteLine("  " + englishText + " = " + finnishText, ConsoleColor.Cyan);
                }
            }
        }
        catch (Exception ex)
        {
            ConsoleColorHelper.WriteError($"Failed to read file for searching: {ex.Message}");
        }
    }

    /// <summary>
    /// Appends the specified CSV line to the translations file.
    /// </summary>
    /// <param name="translationFilepath">The translations CSV file path.</param>
    /// <param name="line">The CSV-formatted line to append.</param>
    /// <returns><c>true</c> if the append succeeded; otherwise <c>false</c>.</returns>
    private static bool AppendNewEntry(string translationFilepath, string line)
    {
        if (string.IsNullOrEmpty(translationFilepath))
        {
            throw new InvalidOperationException($"File path is not provided in parameter '{nameof(translationFilepath)}'.");
        }

        try
        {
            File.AppendAllText(translationFilepath, line + Environment.NewLine);
            return true;
        }
        catch (Exception ex)
        {
            ConsoleColorHelper.WriteError($"Failed to append: {ex.Message}");
            return false;
        }
    }

    private static string LoadOllamaApiModelFromSettings()
    {

        var settings = LoadFromSettings();

        if (!string.IsNullOrWhiteSpace(settings?.OllamaPrompt))
        {
            return settings.OllamaPrompt;
        }

        ConsoleColorHelper.WriteWarning($"Ollama API LLM model name was missing or empty in settings. Using default.");

        return string.Empty;
    }

    private static string LoadOllamaPromptFromSettings()
    {
        var settings = LoadFromSettings();

        if (!string.IsNullOrWhiteSpace(settings?.OllamaPrompt))
        {
            return settings.OllamaPrompt;
        }

        ConsoleColorHelper.WriteWarning($"Ollama prompt was missing or empty in settings. Using default.");

        return string.Empty;
    }

    private static AddEntryAppSettings? LoadFromSettings()
    {
        var settingsPath = Path.Combine(AppContext.BaseDirectory, SettingsJsonFilename);
        if (!File.Exists(settingsPath))
        {
            ConsoleColorHelper.WriteWarning($"Settings file not found at: {settingsPath}. Using default Ollama prompt.");
            return new AddEntryAppSettings();
        }

        try
        {
            var settingsJson = File.ReadAllText(settingsPath);
            AddEntryAppSettings? settings = JsonSerializer.Deserialize<AddEntryAppSettings>(settingsJson, s_jsonSerializerOptions);

            return settings;
        }
        catch (Exception ex)
        {
            ConsoleColorHelper.WriteError($"Failed to read settings from {settingsPath}: {ex.Message}");
        }

        return new AddEntryAppSettings();
    }

    private static string GetDefaultOllamaPrompt()
    {
        return "Translate '{text}' to Finnish. Return ONLY one line in this exact format: <translation> | <hashtags>\nWhere <translation> is the Finnish translation (if multiple candidates, separate with '/') and <hashtags> are 1-3 relevant category hashtags in English (e.g. #noun #verb #food). Example: dog | #noun #animal";
    }

    private sealed class AddEntryAppSettings
    {
        public string OllamaPrompt { get; set; } = string.Empty;
    }
}
