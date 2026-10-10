using System.Reflection;

using CliUtils;

namespace TranslationTools;

/// <summary>
///     Provides methods to find and read translation CSV files.
/// </summary>
public class TranslationsFinder
{
    private const string SettingsJsonFilename = "settings.json";
    private const string TranslationCsvFilename = "translations.csv";

    /// <summary>
    ///     Finds the .csv file path by searching parent directories or using settings.
    /// </summary>
    /// <returns>Full path to the .csv file</returns>
    public string FindTranslationsCsvFilepath(string csvFilePath = "")
    {
        if (File.Exists(csvFilePath))
        {
            return csvFilePath;
        }

        var isTranslationEntryTranslations =
            string.IsNullOrEmpty(csvFilePath) || csvFilePath.Contains(TranslationCsvFilename);
        if (!isTranslationEntryTranslations)
        {
            ConsoleLogger.WriteLine("Using " + TranslationCsvFilename + " file at: " + csvFilePath);
            return csvFilePath;
        }

        ConsoleLogger.WriteLine($"Resolving {TranslationCsvFilename} file path from settings ...");
        var translationFilepath = GetTranslationFilePathFromSettings();
        if (!string.IsNullOrEmpty(translationFilepath))
        {
            if (!File.Exists(translationFilepath))
            {
                var currentDir = Directory.GetCurrentDirectory();
                ConsoleLogger.WriteLine($"Current directory '{currentDir}'.");

                ConsoleLogger.WriteLine(
                    $"Warning: The translation file path from settings does not exist: {translationFilepath}");
            }
            else
            {
                ConsoleLogger.WriteLine($"Using {TranslationCsvFilename} file at: {translationFilepath}");
                return translationFilepath;
            }
        }

        ConsoleLogger.WriteLine($"Could not determine {TranslationCsvFilename} file path from settings.");
        ConsoleLogger.WriteLine($"Resolving {TranslationCsvFilename} file path from parent directories...");

        if (TryFindInWorkingDirectory(out var foundPath))
        {
            return foundPath;
        }

        if (TryFindInParentDirectories(out foundPath))
        {
            return foundPath;
        }

        if (TryFallbackPath(out foundPath))
        {
            return foundPath;
        }

        if (TryEntryAssemblyPath(out foundPath))
        {
            ConsoleLogger.WriteLine($"Using file path resolved from entry assembly, at: {foundPath}");
            return foundPath;
        }

        return string.Empty;
    }

    /// <summary>
    ///     Reads the translation file path from settings.json if available.
    /// </summary>
    /// <returns>Translation file path or empty string if not found</returns>
    public static string GetTranslationFilePathFromSettings()
    {
        var settingsPath = Path.Combine(AppContext.BaseDirectory, SettingsJsonFilename);
        var settingsJsonExists = File.Exists(settingsPath);
        if (!settingsJsonExists)
        {
            ConsoleLogger.WriteLine($"Settings file not found at: {settingsPath}");
            return string.Empty;
        }

        var settingsJson = File.ReadAllText(settingsPath);
        return GetTranslationFilepathFromEnvironmentVariable(settingsJson);
    }

    /// <summary>
    ///     Reads all lines from the .csv file.
    /// </summary>
    /// <param name="translationFilepath"></param>
    /// <param name="startingLineNumber"></param>
    /// <returns>A <see cref="CsvParseResult"/> containing the header line and CSV data lines.</returns>
    public static CsvParseResult GetTranslationsLines(string translationFilepath, int startingLineNumber = -1)
    {
        if (!File.Exists(translationFilepath))
        {
            return new CsvParseResult(string.Empty, Array.Empty<string>());
        }

        return ReadTranslationsLines(translationFilepath, startingLineNumber);
    }

    /// <summary>
    ///     Attempts to find the translation CSV in the current working directory.
    /// </summary>
    private bool TryFindInWorkingDirectory(out string path)
    {
        ConsoleLogger.WriteLine($"{nameof(TryFindInWorkingDirectory)} ...");

        path = Path.GetFullPath(TranslationCsvFilename);

        if (!File.Exists(TranslationCsvFilename))
        {
            ConsoleLogger.WriteLine($"File {TranslationCsvFilename} is not current working directory at: {path}");
            return false;
        }

        ConsoleLogger.WriteLine($"Found {TranslationCsvFilename} in current working directory at: {path}");
        return true;
    }

    /// <summary>
    ///     Attempts to find the translation CSV by climbing parent directories starting from the base directory.
    /// </summary>
    private bool TryFindInParentDirectories(out string path)
    {
        ConsoleLogger.WriteLine($"{nameof(TryFindInParentDirectories)} ...");

        path = string.Empty;
        ConsoleLogger.WriteLine($"Searching for of folder of file {TranslationCsvFilename} ...");
        DirectoryInfo? directoryInfo = new DirectoryInfo(AppContext.BaseDirectory);
        while (directoryInfo != null)
        {
            var files = directoryInfo.GetFiles();
            if (files.FirstOrDefault(x => x.Name.Equals(TranslationCsvFilename, StringComparison.OrdinalIgnoreCase)) != null)
            {
                path = Path.Combine(directoryInfo.FullName, TranslationCsvFilename);
                break;
            }

            directoryInfo = directoryInfo.Parent;
        }

        if (string.IsNullOrEmpty(path))
        {
            return false;
        }

        if (!File.Exists(path))
        {
            ConsoleLogger.WriteLine($"Warning: The found translation file path does not exist: {path}");
            return false;
        }

        ConsoleLogger.WriteLine($"Found {TranslationCsvFilename} at: {path}");
        return true;
    }

    /// <summary>
    ///     Attempts the fallback path (parent of the current working directory) for the translation CSV.
    /// </summary>
    private bool TryFallbackPath(out string path)
    {
        ConsoleLogger.WriteLine($"{nameof(TryFallbackPath)} ...");

        var currentDir = Directory.GetCurrentDirectory();
        path = Path.GetFullPath(Path.Combine(currentDir, "..", TranslationCsvFilename));

        ConsoleLogger.WriteLine($@"Current directory {currentDir}\..\{TranslationCsvFilename} ...");

        if (!File.Exists(path))
        {
            ConsoleLogger.WriteLine($"Warning: The fallback translation file path does not exist: {path}");
            path = string.Empty;
            return false;
        }

        ConsoleLogger.WriteLine($"Using fallback {TranslationCsvFilename} file at: {path}");
        return true;
    }

    private bool TryEntryAssemblyPath(out string path)
    {
        ConsoleLogger.WriteLine($"{nameof(TryEntryAssemblyPath)} ...");
        var entryAssembly = Assembly.GetEntryAssembly();
        var assemblyName = entryAssembly!.GetName();

        const string solutionName = "translations_csv";
        var index = entryAssembly.Location.IndexOf(solutionName, StringComparison.Ordinal);
        var solutionPath = entryAssembly.Location[..(index + solutionName.Length)];
        path = Path.GetFullPath(Path.Combine(solutionPath, TranslationCsvFilename));

        ConsoleLogger.WriteLine($@"Solution path {assemblyName}\{TranslationCsvFilename} ...");

        if (!File.Exists(path))
        {
            ConsoleLogger.WriteLine($"Warning: The fallback translation file path does not exist: {path}");
            path = string.Empty;
            return false;
        }

        ConsoleLogger.WriteLine($"Using fallback {TranslationCsvFilename} file at: {path}");
        return true;
    }

    /// <summary>
    ///     Parses the translation file path from the provided environment variable.
    /// </summary>
    private static string GetTranslationFilepathFromEnvironmentVariable(string json)
    {
        const string environmentVariableName = "translation_filepath";

        var pathValue = Environment.GetEnvironmentVariable(environmentVariableName, EnvironmentVariableTarget.User);

        if (string.IsNullOrEmpty(pathValue))
        {
            pathValue = Environment.GetEnvironmentVariable(environmentVariableName, EnvironmentVariableTarget.Machine);
        }

        if (string.IsNullOrWhiteSpace(pathValue))
        {
            ConsoleLogger.WriteLine($"Translation file path entry is empty in environment variable {environmentVariableName}.");
            return string.Empty;
        }

        var tidyPath = Path.GetFullPath(pathValue);

        if (!string.IsNullOrWhiteSpace(tidyPath))
        {
            ConsoleLogger.WriteLine($"Translation file path found  in environment variable {environmentVariableName}: {tidyPath}");
            return tidyPath;
        }

        return string.Empty;
    }

    /// <summary>
    ///     Reads the lines from the translation CSV, honoring an optional starting line number.
    /// </summary>
    private static CsvParseResult ReadTranslationsLines(string translationFilepath, int startingLineNumber)
    {
        string headerLine;
        string[] allLines;
        IEnumerable<string> array;
        if (startingLineNumber > 0)
        {
            ConsoleLogger.WriteLine($"Starting line number {startingLineNumber} requested.");
            allLines = File.ReadAllLines(translationFilepath);
            if (startingLineNumber < allLines.Length)
            {
                ConsoleLogger.WriteLine($"Reading {startingLineNumber}/{allLines.Length}");
                headerLine = allLines[0];
                array = allLines.Skip(startingLineNumber);

                return new CsvParseResult(headerLine, [.. array]);// to array
            }

            ConsoleLogger.WriteLine(
                $"Warning: Start line number {startingLineNumber} is out of range of {allLines.Length}.");
        }

        ConsoleLogger.WriteLine("Loading all entries.");
        allLines = File.ReadAllLines(translationFilepath);
        if (allLines.Length > 0)
        {
            headerLine = allLines[0];
            array = allLines.Skip(1);
            return new CsvParseResult(headerLine, [.. array]); // to array
        }

        return new CsvParseResult(string.Empty, []); // to array
    }
}