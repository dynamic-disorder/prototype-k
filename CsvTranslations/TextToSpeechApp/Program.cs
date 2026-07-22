using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.Json;

using CliUtils;

using TextToSpeechApp;
using TextToSpeechCore;

using TranslationTools;

internal sealed class Program
{
    private static string CreateFullWidthSeparator()
    {
        int width = Math.Min(Console.WindowWidth, 80);
        return new string('═', width);
    }

    private static string CreateThinSeparator()
    {
        int width = Math.Min(Console.WindowWidth, 80);
        return new string('─', width);
    }

    /// <summary>
    /// Displays the control instructions for the text-to-speech application
    /// as a formatted section with separators.
    /// </summary>
    private static void DisplayControlInstructions()
    {
        Console.WriteLine();
        Console.WriteLine(CreateFullWidthSeparator());
        Console.WriteLine("CONTROL INSTRUCTIONS");
        Console.WriteLine(CreateThinSeparator());
        Console.WriteLine("Starting text-to-speech for translation entries. Press Ctrl+C or ESC to stop.");
        Console.WriteLine("Press Enter to pause for 10 seconds. Press space bar to pause and again to resume.");
        Console.WriteLine();
    }

    /// <summary>
    /// Displays a text entry row with color coding for different languages.
    /// </summary>
    /// <param name="entryRow">The text entry row to display.</param>
    private static void DisplayEntryWithColors(TextEntryRow entryRow)
    {
        foreach (TextEntry entry in entryRow)
        {
            var originalColor = Console.ForegroundColor;
            var languageCode = entry.Language.LanguageCulture.TwoLetterISOLanguageName.ToLower(CultureInfo.InvariantCulture);

            // Set color based on language
            switch (languageCode)
            {
                case "en":
                    Console.ForegroundColor = ConsoleColor.Cyan;
                    break;
                case "fi":
                    Console.ForegroundColor = ConsoleColor.Yellow;
                    break;
                case "de":
                    Console.ForegroundColor = ConsoleColor.Green;
                    break;
                case "fr":
                    Console.ForegroundColor = ConsoleColor.Magenta;
                    break;
                case "es":
                    Console.ForegroundColor = ConsoleColor.Red;
                    break;
                default:
                    Console.ForegroundColor = ConsoleColor.White;
                    break;
            }

            Console.WriteLine($"  {languageCode}: {entry.Text}");
            Console.ForegroundColor = originalColor;
        }
    }

    public static async Task Main(string[] args)
    {
        Console.OutputEncoding = Encoding.UTF8;
        var csvFilePath = ParseArguments(args, out var lineNumber);

        Console.WriteLine(CreateFullWidthSeparator());
        Console.WriteLine("LOCATING THE .CSV FILE FOR RECITING");
        Console.WriteLine(CreateThinSeparator());
        Console.WriteLine("Loading CSV entries from '" + csvFilePath + "' ...");

        Console.WriteLine();
        Console.WriteLine(CreateFullWidthSeparator());
        Console.WriteLine("LOADING THE .CSV FILE AND ITS CONTENT REPORTING");
        Console.WriteLine(CreateThinSeparator());
        TranslationEntryList entryList = TranslationEntryLoader.LoadTranslationEntriesFromCsv(csvFilePath, lineNumber);
        ConsoleLogger.Logs.ForEach(log => Console.WriteLine(log.LogText));

        var entriesLoadedAmount = entryList.Count;

        if (entriesLoadedAmount == 0)
        {
            Console.WriteLine("No translation entries found. Exiting.");
            return;
        }

        TtsSettings settings = LoadTtsSettings();

        await RunRecitingLoop(entryList, settings);
    }

    // Refactoring completed: Use factory pattern with settings injection
    private static TtsSettings LoadTtsSettings()
    {
        var filePath = Path.Combine(AppContext.BaseDirectory, "settings.json");
        if (File.Exists(filePath))
        {
            try
            {
                string jsonContent = File.ReadAllText(filePath);
                return JsonSerializer.Deserialize<TtsSettings>(jsonContent) ?? new();
            }
            catch (Exception ex)
            {
                ConsoleColorHelper.WriteError($"Failed to load settings: {ex.Message}");
                return new();
            }
        }

        ConsoleColorHelper.WriteWarning("settings.json not found. Using default settings.");
        return new();
    }

    /// <summary>
    /// Parses command-line arguments to determine the translations CSV file path
    /// and an optional starting line number.
    /// </summary>
    /// <param name="args">The command-line arguments passed to the application.</param>
    /// <param name="startingLineNumber">Outputs the parsed starting line number or -1 if none provided.</param>
    /// <returns>The resolved CSV file path to load.</returns>
    private static string ParseArguments(string[] args, out int startingLineNumber)
    {
        startingLineNumber = -1;
        if (args.Contains("--help") || args.Contains("-h"))
        {
            Console.WriteLine("Usage: TextToSpeechApp [path to translations CSV file]");
            Environment.Exit(0);
        }

        var csvFilePath = "translations_csv/translations.csv";

        if (args.Length == 0)
        {
            Console.WriteLine("No arguments passed. Using default relative translations CSV file: " + csvFilePath);
            return csvFilePath;
        }

        Console.WriteLine("Arguments passed. Processing...");
        foreach (var arg in args)
        {
            Console.WriteLine(arg);

            if (arg.Contains(".csv", StringComparison.InvariantCultureIgnoreCase))
            {
                if (arg.Contains("csv_files"))
                {
                    Console.WriteLine("Argument contains CSV file path: " + arg);

                    var resolvedFilePath = arg[arg.IndexOf("csv_files", StringComparison.Ordinal)..];
                    if (!File.Exists(resolvedFilePath))
                    {
                        Console.WriteLine("Error! CSV file not found from resolved file path '" + resolvedFilePath +
                                          "' of `" + arg + "`.");
                        Environment.Exit(1);
                    }

                    Console.WriteLine("Loading CSV key-value pairs will be loaded from resolved file path '" +
                                      resolvedFilePath + "' of `" + arg + "`.");
                    csvFilePath = resolvedFilePath;
                }
                else if (arg.EndsWith(".csv", StringComparison.OrdinalIgnoreCase))
                {
                    // ReSharper disable once ConvertIfStatementToConditionalTernaryExpression
#pragma warning disable IDE0045 // Convert to conditional expression
                    if (arg.Contains("csv_files"))
                    {
                        csvFilePath = arg;
                    }
                    else
                    {
                        csvFilePath = Path.Combine(Directory.GetCurrentDirectory(), "csv_files", arg);
                    }
#pragma warning restore IDE0045 // Convert to conditional expression

                    if (!File.Exists(csvFilePath))
                    {
                        Console.WriteLine("Error! CSV file not found: " + csvFilePath);
                        Environment.Exit(1);
                    }

                    Console.WriteLine("CSV key-value pairs will be loaded from file path '" + csvFilePath + "'.");
                }

                continue;
            }

            if (int.TryParse(arg, out startingLineNumber))
            {
                Console.WriteLine("Argument indicates line number to read: " + startingLineNumber);
                continue;
            }

            Console.WriteLine("Warning! Unknown argument: " + arg);
        }

        return csvFilePath;
    }

    /// <summary>
    /// Checks for a pressed console key and handles control commands.
    /// Returns <c>true</c> when the user requested to stop execution (Escape),
    /// otherwise <c>false</c>. Pressing Enter will pause execution for 10 seconds.
    /// </summary>
    /// <returns><c>true</c> if execution should stop; otherwise <c>false</c>.</returns>
    private static bool HandleConsoleKey()
    {
        if (!Console.KeyAvailable)
        {
            return false;
        }

        ConsoleKeyInfo key = Console.ReadKey(true);

        if (key.Key == ConsoleKey.Escape)
        {
            Console.WriteLine("Esc pressed — stopping speech. Exiting.");
            return true;
        }

        if (key.Key == ConsoleKey.Enter)
        {
            Console.WriteLine("Enter pressed — pausing for 10 seconds.");
            Thread.Sleep(10000);
        }

        if (key.Key == ConsoleKey.Spacebar)
        {
            Console.WriteLine("Space bar pressed. Paused.");
            Console.WriteLine("Press space bar again to continue.");
            Console.ReadKey(true);
        }

        return false;
    }

    /// <summary>
    /// Runs the main reciting loop that speaks translation entries using
    /// the text-to-speech service. The loop selects entries randomly and
    /// responds to console key input to pause or stop.
    /// </summary>
    /// <param name="entryList">The list of translation entries to recite.</param>
    /// <param name="settings">The loaded TTS settings selecting the provider to use.</param>
    /// <returns>A task that represents the asynchronous reciting operation.</returns>
    private static async Task RunRecitingLoop(TranslationEntryList entryList, TtsSettings settings)
    {
        using ITextToSpeechService textToSpeechService = TtsServiceFactory.Create(settings, entryList.VoiceLanguages, entryList.Entries);

        List<string> initOutputs = await textToSpeechService.InitializeAsync(entryList.VoiceLanguages);
        foreach (var output in initOutputs)
        {
            if (output.StartsWith("WARNING:", StringComparison.OrdinalIgnoreCase))
            {
                ConsoleColorHelper.WriteWarning(output);
            }
            else if (output.StartsWith("ERROR:", StringComparison.OrdinalIgnoreCase))
            {
                ConsoleColorHelper.WriteError(output);
            }
            else
            {
                ConsoleColorHelper.WriteInfo(output);
            }
        }

        var entriesLoadedAmount = entryList.Count;
        var textStartingRecitingLoop = "Reciting " + entriesLoadedAmount + " entries, randomly.";

        DisplayControlInstructions();

        Console.WriteLine(textStartingRecitingLoop);
        
        // Find English voice language for announcements, fallback to system if not found
        var englishVoice = entryList.VoiceLanguages.FirstOrDefault(v => 
            v.LanguageCulture.TwoLetterISOLanguageName.Equals("en", StringComparison.OrdinalIgnoreCase)) ?? 
            VoiceLanguage.System;
        
        await textToSpeechService.SpeakTextAsync(textStartingRecitingLoop, englishVoice);

        var entriesCountChars = entriesLoadedAmount.ToString(CultureInfo.InvariantCulture).Length;

        // Speak random entries in either source language (e.g. English) and in target language (e.g. Finnish)
        var randomizer = new Random();
        for (var i = 0; i < entriesLoadedAmount; i++)
        {
            // Check if a key has been pressed
            if (HandleConsoleKey())
            {
                break;
            }

            var randomIndex = randomizer.Next(0, entriesLoadedAmount);
            TextEntryRow entryRow = entryList[randomIndex];
            var padding = (i + 1).ToString(CultureInfo.InvariantCulture).PadLeft(entriesCountChars, '0');

            Console.WriteLine($"{padding} / {entriesLoadedAmount} ::");
            DisplayEntryWithColors(entryRow);

            foreach (TextEntry entry in entryRow)
            {
                await textToSpeechService.SpeakEntryAsync(entry);
            }

            // avoid burning CPU
            Thread.Sleep(50);
        }
    }
}