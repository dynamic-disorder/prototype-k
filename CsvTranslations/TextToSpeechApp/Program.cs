using System.Diagnostics;
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
    /// Displays the runtime control commands for the text-to-speech application,
    /// closed by a separator line. The commands are read from
    /// <c>TextToSpeechApp.runtime_commands.txt</c> so they stay easy to spot
    /// before reciting starts and again while it is running.
    /// </summary>
    private static void ShowRuntimeCommands()
    {
        Console.WriteLine();
        Console.WriteLine(ReadRuntimeCommands());
        Console.WriteLine(CreateThinSeparator());
        Console.WriteLine();
    }

    /// <summary>
    /// Reads the runtime control commands from <c>TextToSpeechApp.runtime_commands.txt</c>,
    /// which ships alongside the executable. Falls back to a built-in one-liner when the
    /// file cannot be found.
    /// </summary>
    /// <returns>The runtime control commands as a single line.</returns>
    private static string ReadRuntimeCommands()
    {
        var runtimeCommandsFilePath = Path.Combine(AppContext.BaseDirectory, RuntimeCommandsFileName);
        if (File.Exists(runtimeCommandsFilePath))
        {
            return File.ReadAllText(runtimeCommandsFilePath).TrimEnd();
        }

        return "Ctrl+C / ESC: stop   ·   Enter: pause 10 seconds   ·   Space: pause / resume";
    }

    /// <summary>
    /// Displays a text entry row with color coding for different languages.
    /// </summary>
    /// <param name="entryRow">The text entry row to display.</param>
    private static void DisplayEntryWithColors(TextEntryRow entryRow)
    {
        foreach (TextEntry entry in entryRow)
        {
            // Hashtags are metadata, not spoken text.
            if (entry.EntryType == TextEntryType.Hashtags)
            {
                continue;
            }

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
            ShowSyntaxAndExitWithError("Error! No translation entries found. Exiting.");
            return;
        }

        TtsSettings settings = LoadTtsSettings(args);

        try
        {
            await RunRecitingLoop(entryList, settings);
        }
        catch (PlatformNotSupportedException exception)
        {
            // Raised when the app has nothing it can run: Piper without a configuration, or Piper
            // with no audio player installed on this machine.
            ConsoleColorHelper.WriteError(exception.Message);
            Environment.Exit(1);
        }
    }

    // Refactoring completed: Use factory pattern with settings injection
    private static TtsSettings LoadTtsSettings(string[] args)
    {
        var filePath = Path.Combine(AppContext.BaseDirectory, "settings.json");
        TtsSettings settings;

        if (File.Exists(filePath))
        {
            try
            {
                string jsonContent = File.ReadAllText(filePath);
                settings = JsonSerializer.Deserialize<TtsSettings>(jsonContent) ?? new();
            }
            catch (Exception ex)
            {
                ConsoleColorHelper.WriteError($"Failed to load settings: {ex.Message}");
                settings = new();
            }
        }
        else
        {
            ConsoleColorHelper.WriteWarning("settings.json not found. Using default settings.");
            settings = new();
        }

        // Apply --tts command-line override, if present
        var requestedOnCommandLine = false;
        foreach (var arg in args)
        {
            if (!TtsSettings.TryParseTtsArg(arg, out var provider))
            {
                continue; // Not a TTS argument
            }

            if (provider != null)
            {
                settings.TtsProvider = provider;
                requestedOnCommandLine = true;

                // Piper adds the loading notice to the same message, so the live elapsed-time
                // readout shown while the engine and voice models load sits right beneath it.
                string providerMessage = $"TTS provider set from the command line: {provider}";

                if (provider.Equals("Piper", StringComparison.OrdinalIgnoreCase))
                {
                    providerMessage += ". Loading the Piper TTS engine and voice models." + Environment.NewLine
                        + "The first run might take a few minutes. Please wait.";
                }

                ConsoleColorHelper.WriteInfo(providerMessage);
            }
            else
            {
                ConsoleColorHelper.WriteWarning($"Unknown TTS provider in argument '{arg}'. The only provider is Piper. Using settings default: {settings.TtsProvider}");
            }

            break; // Only process the first --tts argument
        }

        // Piper is the only provider. Resolving here means a settings file (or an argument) that
        // names another one is reported once, before any engine work starts.
        settings.TtsProvider = TtsProviderSelection.Resolve(settings.TtsProvider, out var providerNotice);

        if (providerNotice is not null)
        {
            // The user's own --tts argument being unavailable deserves more attention than a
            // settings file that still names the removed provider.
            if (requestedOnCommandLine)
            {
                ConsoleColorHelper.WriteWarning(providerNotice);
            }
            else
            {
                ConsoleColorHelper.WriteInfo(providerNotice);
            }
        }

        return settings;
    }

    /// <summary>
    /// Name of the syntax/help file that ships next to the executable.
    /// </summary>
    private const string SyntaxFileName = "TextToSpeechApp.syntax.txt";

    /// <summary>
    /// Name of the runtime-commands file that ships next to the executable.
    /// </summary>
    private const string RuntimeCommandsFileName = "TextToSpeechApp.runtime_commands.txt";

    /// <summary>
    /// Label printed in front of the live elapsed-time readout shown while a long step runs.
    /// </summary>
    private const string ElapsedTimeLabel = "Elapsed time: ";

    /// <summary>
    /// Determines whether a command-line argument requests the help/syntax information.
    /// Accepts <c>/help</c>, <c>--help</c> and the <c>-h</c> shorthand, case-insensitively.
    /// </summary>
    /// <param name="arg">The command-line argument to test.</param>
    /// <returns><c>true</c> when the argument requests help; otherwise <c>false</c>.</returns>
    private static bool IsHelpArgument(string arg)
    {
        return arg.Equals("/help", StringComparison.OrdinalIgnoreCase)
               || arg.Equals("--help", StringComparison.OrdinalIgnoreCase)
               || arg.Equals("-h", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Displays the contents of <c>TextToSpeechApp.syntax.txt</c>, which ships alongside the
    /// executable. Falls back to a short usage summary if the file cannot be found.
    /// </summary>
    private static void ShowSyntax()
    {
        var syntaxFilePath = Path.Combine(AppContext.BaseDirectory, SyntaxFileName);
        if (File.Exists(syntaxFilePath))
        {
            Console.WriteLine(File.ReadAllText(syntaxFilePath));
            return;
        }

        Console.WriteLine("TextToSpeechApp");
        Console.WriteLine("Usage: TextToSpeechApp [path] [line number] [--tts:{provider}]");
        Console.WriteLine("Run with /help or --help for the full syntax.");
    }

    /// <summary>
    /// Shows the syntax help, then prints the error message in red and exits with a non-zero code.
    /// </summary>
    /// <param name="errorMessage">The error message to display in red.</param>
    private static void ShowSyntaxAndExitWithError(string errorMessage)
    {
        ShowSyntax();
        ConsoleColorHelper.WriteError(errorMessage);
        Environment.Exit(1);
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
        if (args.Any(IsHelpArgument))
        {
            ShowSyntax();
            Environment.Exit(0);
        }

        var csvFilePath = "translations.csv";

        if (args.Length == 0)
        {
            Console.WriteLine("No arguments passed. Using default relative translations CSV file: " + csvFilePath);
            return csvFilePath;
        }

        Console.WriteLine("Arguments passed. Processing...");
        foreach (var arg in args)
        {
            // Skip TTS provider arguments — they are handled by LoadTtsSettings
            if (arg.StartsWith("--tts:", StringComparison.OrdinalIgnoreCase) ||
                arg.StartsWith("-tts:", StringComparison.OrdinalIgnoreCase))
            {
                Console.WriteLine("  (TTS provider argument, processed separately)");
                continue;
            }

            Console.WriteLine(arg);

            if (arg.Contains(".csv", StringComparison.InvariantCultureIgnoreCase))
            {
                if (arg.Contains("csv_files"))
                {
                    Console.WriteLine("Argument contains CSV file path: " + arg);

                    var resolvedFilePath = arg[arg.IndexOf("csv_files", StringComparison.Ordinal)..];
                    if (!File.Exists(resolvedFilePath))
                    {
                        ShowSyntaxAndExitWithError("Error! CSV file not found from resolved file path '" + resolvedFilePath +
                                                   "' of `" + arg + "`.");
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
                        ShowSyntaxAndExitWithError("Error! CSV file not found: " + csvFilePath);
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
    ///     Initializes the text-to-speech service. While Piper downloads and extracts the engine and
    ///     its voice models, a live progress display shows one row per asset, the megabytes already
    ///     received and the elapsed time; the total elapsed time is printed once it finishes.
    /// </summary>
    /// <param name="textToSpeechService">The service to initialize.</param>
    /// <param name="settings">The loaded TTS settings selecting the provider in use.</param>
    /// <param name="voiceLanguages">The voice languages to initialize.</param>
    /// <returns>The initialization messages reported by the service.</returns>
    private static async Task<List<string>> InitializeWithElapsedTimeReportAsync(
        ITextToSpeechService textToSpeechService,
        TtsSettings settings,
        VoiceLanguageList voiceLanguages)
    {
        if (!string.Equals(settings.TtsProvider, "Piper", StringComparison.OrdinalIgnoreCase))
        {
            return await textToSpeechService.InitializeAsync(voiceLanguages);
        }

        var stopwatch = Stopwatch.StartNew();
        List<string> outputs = [];

        await RichConsole.WithLiveProgressAsync(async progressContext =>
        {
            var progressReporter = new PiperProgressReporter(progressContext);
            outputs = await textToSpeechService.InitializeAsync(voiceLanguages, progressReporter);
        });

        stopwatch.Stop();

        // The progress display clears itself, so the total is written as an ordinary line.
        Console.WriteLine(ElapsedTimeLabel + FormatElapsedTime(stopwatch.Elapsed));

        return outputs;
    }

    /// <summary>
    /// Formats a duration as minutes and seconds, each padded to two digits.
    /// </summary>
    /// <param name="elapsed">The duration to format.</param>
    /// <returns>The duration as <c>MM:SS</c>, for example <c>01:05</c>.</returns>
    private static string FormatElapsedTime(TimeSpan elapsed)
    {
        return $"{(int)elapsed.TotalMinutes:D2}:{elapsed.Seconds:D2}";
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

        List<string> initOutputs = await InitializeWithElapsedTimeReportAsync(textToSpeechService, settings, entryList.VoiceLanguages);
        foreach (var output in initOutputs)
        {
            // The services indent their log lines, so classify on the trimmed text.
            var trimmedOutput = output.TrimStart();

            if (trimmedOutput.StartsWith("WARNING:", StringComparison.OrdinalIgnoreCase))
            {
                ConsoleColorHelper.WriteWarning(output);
            }
            else if (trimmedOutput.StartsWith("ERROR:", StringComparison.OrdinalIgnoreCase))
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

        ShowRuntimeCommands();

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
                // Hashtags are metadata, not spoken text.
                if (entry.EntryType == TextEntryType.Hashtags)
                {
                    continue;
                }

                await textToSpeechService.SpeakEntryAsync(entry);
            }

            // Refresh the runtime commands after every 10 recited entries.
            if ((i + 1) % 10 == 0)
            {
                ShowRuntimeCommands();
            }

            // avoid burning CPU
            Thread.Sleep(50);
        }
    }
}