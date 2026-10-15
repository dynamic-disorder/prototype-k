using CliUtils;

namespace TranslationTools;

/// <summary>
/// Responsible for loading translation entries from a CSV file.
/// </summary>
public class TranslationEntryLoader
{
    /// <summary>
    /// Loads translation entries from the translations CSV file related to <paramref name="csvFilePath"/>.
    /// </summary>
    /// <param name="csvFilePath">The path to a CSV file that is located in the same folder (or a related location)
    /// as the translations CSV file. The loader will locate the actual translations CSV using <see cref="TranslationsFinder"/>.</param>
    /// <param name="startingLineNumber">Optional zero-based line number to start reading translations from. Use -1 to
    /// start from the beginning (default).</param>
    /// <returns>A <see cref="TranslationEntryList"/> containing the parsed translation entries. If no translation lines
    /// are found an empty list is returned.</returns>
    public static TranslationEntryList LoadTranslationEntriesFromCsv(string csvFilePath, int startingLineNumber = -1)
    {
        var translationFinder = new TranslationsFinder();
        var translationFilepath = translationFinder.FindTranslationsCsvFilepath(csvFilePath);

        var (headerLine, csvLines) = TranslationsFinder.GetTranslationsLines(translationFilepath, startingLineNumber);
        if (csvLines.Length == 0)
        {
            ConsoleLogger.WriteLine("No " + nameof(TextEntry) + " lines found in the CSV file.");

            return new TranslationEntryList();
        }

        ConsoleLogger.WriteLine(
            $"Loaded {csvLines.Length} lines from translations CSV file - one is expected to be a header line.");

        var translationEntryList = new TranslationEntryList();
        translationEntryList.LoadFromCsvLines(headerLine, csvLines);

        return translationEntryList;
    }
}
