using System.Text;

using CliUtils;

namespace TranslationTools;

/// <summary>
///     Parses translation CSV lines into translation entries.
/// </summary>
public class TranslationsParser
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

    public const string ColumnSourceLanguage = "Source Language";
    public const string ColumnTargetLanguage = "Target Language";
    public const string ColumnSourceText = "Source Text";
    public const string ColumnTargetText = "Target Text";
    public const string ColumnSource = "Source";
    public const string ColumnTarget = "Target";
    public const string ColumnSemantics = "Semantics";
    public const string ColumnHashtags = "Hashtags";

    /// <summary>
    ///     Parses CSV lines into a list of TranslationEntry objects.
    /// </summary>
    /// <param name="headerLineParam">The header line</param>
    /// <param name="csvLines">Raw CSV lines</param>
    /// <returns>A list of TranslationEntry objects</returns>
    public static TranslationEntryList ParseTranslationsCsvLines(string headerLineParam, string[] csvLines)
    {
        var entryList = new TranslationEntryList();
        ParseInto(entryList, headerLineParam, csvLines);
        return entryList;
    }

    /// <summary>
    ///     Parses CSV lines and populates the provided TranslationEntryList.
    /// </summary>
    /// <param name="entryList">The entry list to populate</param>
    /// <param name="headerLineParam">The header line</param>
    /// <param name="csvLines">Raw CSV lines</param>
    public static void ParseInto(TranslationEntryList entryList, string headerLineParam, string[] csvLines)
    {
        if (csvLines.Length == 0)
        {
            return;
        }

        string headerLine;

#pragma warning disable IDE0045
        if (headerLineParam.Contains(':')) // e.g., "Source:English, Target:French"
#pragma warning restore IDE0045
        {
            headerLine = GetCleanHeaderLine(headerLineParam);
        }
        else // e.g., "English, French" in the first data line
        {
            headerLine = GetCleanHeaderLineFromLanguageColumns(headerLineParam, csvLines);
        }

        var headerColumns = GetHeaderColumns(headerLine);

        LanguageExtractionResult languageExtractionResult;

#pragma warning disable IDE0045 // Convert to conditional expression
        if (headerLine.Contains(ColumnSourceLanguage, StringComparison.InvariantCultureIgnoreCase) &&
            headerLine.Contains(ColumnTargetLanguage, StringComparison.InvariantCultureIgnoreCase))
        {
            languageExtractionResult = ExtractSourceAndTargetLanguages2(headerColumns);
        }
        else
        {
            languageExtractionResult = ExtractSourceAndTargetLanguages(headerColumns);
        }
#pragma warning restore IDE0045 // Convert to conditional expression

        string[] sourceLanguages = languageExtractionResult.SourceLanguages;
        string[] targetLanguages = languageExtractionResult.TargetLanguages;

        // Clear existing data
        entryList.VoiceLanguages.Clear();
        entryList.Entries.Clear();

        // Print languages section header once
        ConsoleLogger.WriteLine("");
        ConsoleLogger.WriteLine(CreateFullWidthSeparator());
        ConsoleLogger.WriteLine("LANGUAGES CONTAINED IN THE .CSV FILE");
        ConsoleLogger.WriteLine(CreateThinSeparator());

        AddVoiceLanguages(entryList, sourceLanguages, LanguageTypes.Source);
        AddVoiceLanguages(entryList, targetLanguages, LanguageTypes.Target);

        entryList.IsTranslationEntryTranslations = headerLine.Split(',').Length > 2
                                                   && headerLine.Contains(ColumnSourceLanguage, StringComparison.InvariantCultureIgnoreCase) &&
                                                   headerLine.Contains(ColumnTargetLanguage, StringComparison.InvariantCultureIgnoreCase);

        if (entryList.IsTranslationEntryTranslations)
        {
            foreach (var line in csvLines)
            {
                var entryRow = CreateTranslationEntryRowFromLine(headerColumns, line, entryList.VoiceLanguages);
                entryList.Add(entryRow);
            }
        }
        else
        {
            foreach (var line in csvLines)
            {
                var entryRow = CreateEntryRowFromLine(headerColumns, line, entryList.VoiceLanguages);
                entryList.Add(entryRow);
            }
        }
    }

    /// <summary>
    ///    Retrieves the language name for a given index from the voice languages list. If the index is out of range, it returns a default system language. This method ensures that each text entry is associated with the correct language based on its position in the CSV line, while also providing a fallback option to maintain robustness in cases where the CSV structure may not perfectly align with the expected format.
    /// </summary>
    /// <param name="voiceLanguages">The list of detected voice languages</param>
    /// <param name="index">The index of the language to retrieve</param>
    /// <returns>The voice language at the specified index or a default system language if the index is out of range</returns>
    private static VoiceLanguage GetLanguageName(VoiceLanguageList voiceLanguages, int index)
    {
        // ReSharper disable once ConvertIfStatementToReturnStatement
        if (index < voiceLanguages.Count)
        {
            return voiceLanguages[index];
        }
        return VoiceLanguage.System;
    }

    /// <summary>
    ///     Returns a cleaned header line with quotes and brackets removed and trimmed.
    /// </summary>
    /// <param name="rawHeader">The original header line</param>
    /// <returns>The cleaned header line</returns>
    private static string GetCleanHeaderLine(string rawHeader)
    {
        var cleanedHeaderLine
            = rawHeader.Replace("\"", "").Replace("[", "").Replace("]", "").Replace(" ", "").Trim();
        return cleanedHeaderLine;
    }

    private static string GetCleanHeaderLineFromLanguageColumns(string headerLine, string[] csvLines)
    {
        var sourcePattern = ColumnSource;
        if (headerLine.Contains(ColumnSourceLanguage, StringComparison.InvariantCultureIgnoreCase)) // if translations.csv
        {
            sourcePattern = ColumnSourceLanguage;
        }

        var targetPattern = ColumnTarget;
        if (headerLine.Contains(ColumnTargetLanguage, StringComparison.InvariantCultureIgnoreCase)) // if translations.csv
        {
            targetPattern = ColumnTargetLanguage;
        }

        var columns = new List<string>();
        var headerLineArray = headerLine.Replace("[", string.Empty).Replace("]", string.Empty).Trim().Split(',');
        for (var index = 0; index < headerLineArray.Length; index++)
        {
            var column = headerLineArray[index];
            var columnValue = column.Trim();
            if (columnValue.StartsWith(sourcePattern, StringComparison.InvariantCulture))
            {
                var sourceLanguage = csvLines[index].Split(',')[index].Trim('"');
                var sourceWithLanguage = columnValue + ":" + sourceLanguage;
                columns.Add(sourceWithLanguage);
                continue;
            }

            if (columnValue.StartsWith(targetPattern, StringComparison.OrdinalIgnoreCase))
            {
                var targetLanguage = csvLines[index].Split(',')[index].Trim('"');
                var targetWithLanguage = columnValue + ":" + targetLanguage;
                columns.Add(targetWithLanguage);
                continue;
            }

            if (columnValue.StartsWith("Hashtags", StringComparison.OrdinalIgnoreCase))
            {
                var targetLanguage = csvLines[index].Split(',')[index].Trim('"');
                var targetWithLanguage = columnValue + ":" + targetLanguage;
                columns.Add(targetWithLanguage);
                continue;
            }

            columns.Add(columnValue);
        }
        var languageHeaderLines = string.Join(",", columns);
        return languageHeaderLines;
    }

    /// <summary>
    ///     Splits a cleaned header line into individual header columns.
    /// </summary>
    /// <param name="cleanHeader">A cleaned header line</param>
    /// <returns>An array of header column strings</returns>
    private static string[] GetHeaderColumns(string cleanHeader)
    {
        var headerColumns = cleanHeader.Split(',').Select(h => h.Trim()).ToArray();
        return headerColumns;
    }

    /// <summary>
    ///     Extracts source and target language names from header columns.
    /// </summary>
    /// <param name="headerColumns">Array of header column strings</param>
    /// <returns>A <see cref="LanguageExtractionResult"/> containing source and target languages arrays</returns>
    private static LanguageExtractionResult ExtractSourceAndTargetLanguages(string[] headerColumns)
    {
        var sources = headerColumns.Where(h => h.StartsWith(ColumnSource, StringComparison.OrdinalIgnoreCase))
            .Select(x => x.Split(':')[1]).ToArray();

        var targets = headerColumns.Where(h => h.StartsWith(ColumnTarget, StringComparison.OrdinalIgnoreCase))
            .Select(x => x.Split(':')[1]).ToArray();

        return new LanguageExtractionResult(sources, targets);
    }

    /// <summary>
    ///     Extracts source and target language names from header columns.
    /// </summary>
    /// <param name="headerColumns">Array of header column strings</param>
    /// <returns>A <see cref="LanguageExtractionResult"/> containing source and target languages arrays</returns>
    private static LanguageExtractionResult ExtractSourceAndTargetLanguages2(string[] headerColumns)
    {
        List<string> sources = [];

        List<string> targets = [];

        foreach (var headerColumn in headerColumns)
        {
            var split = headerColumn.Split(':');
            if (split.Length <= 1)
            {
                continue;
            }

            if (headerColumn.Contains(ColumnSourceLanguage, StringComparison.InvariantCultureIgnoreCase))
            {
                sources.Add(split[1]);
                continue;
            }

            if (headerColumn.Contains(ColumnTargetLanguage, StringComparison.InvariantCultureIgnoreCase))
            {
                targets.Add(split[1]);
            }
        }

        return new LanguageExtractionResult(sources.ToArray(), targets.ToArray());
    }

    /// <summary>
    ///     Adds detected voice languages to the provided entry list and logs detection.
    /// </summary>
    /// <param name="entryList">The entry list to update</param>
    /// <param name="languages">Array of language names to add</param>
    /// <param name="type">The language type (Source/Target)</param>
    private static void AddVoiceLanguages(TranslationEntryList entryList, string[] languages, LanguageTypes type)
    {
        foreach (var language in languages)
        {
            ConsoleLogger.WriteLine($"  • Detected {type.ToString().ToLowerInvariant()} language: {language}");
            entryList.VoiceLanguages.Add(new VoiceLanguage(language, type));
        }
    }

    /// <summary>
    ///     Creates a <see cref="TextEntryRow"/> from a CSV line using the provided voice language list.
    /// </summary>
    /// <param name="line">The CSV line to parse</param>
    /// <param name="voiceLanguages">The list of detected voice languages</param>
    /// <returns>A populated <see cref="TextEntryRow"/></returns>
    private static TextEntryRow CreateEntryRowFromLine(string[] headerColumns, string line, VoiceLanguageList voiceLanguages)
    {
        var entryRow = new TextEntryRow();
        var columns = SplitCsvLine(line).ToArray();
        for (var i = 0; i < columns.Length; i++)
        {
            var column = columns[i];
            var entry = new TextEntry
            {
                Language = GetLanguageName(voiceLanguages, i),
                Text = column.Trim('"').Trim()
            };

            entryRow.Add(entry);
        }

        return entryRow;
    }

    private static TextEntryRow CreateTranslationEntryRowFromLine(string[] headerColumns, string line,
        VoiceLanguageList voiceLanguages)
    {
        var entryRow = new TextEntryRow();
        var columns = SplitCsvLine(line).ToArray();
        for (var i = 0; i < columns.Length; i++)
        {
            var isSource = headerColumns[i].StartsWith(ColumnSourceText, StringComparison.InvariantCultureIgnoreCase);
            var isTarget = headerColumns[i].StartsWith(ColumnTargetText, StringComparison.InvariantCultureIgnoreCase);

            var isSemantics = headerColumns[i].StartsWith(ColumnSemantics, StringComparison.InvariantCultureIgnoreCase);

            string languageName;
#pragma warning disable IDE0045 // Convert to conditional expression
            if (isSource)
            {
                languageName = headerColumns
                    .First(x => x.StartsWith(ColumnSourceLanguage, StringComparison.InvariantCultureIgnoreCase))
                    .Split(':')[1];
            }
            else
            {
                if (isTarget)
                {
                    languageName = headerColumns
                        .First(x => x.StartsWith(ColumnTargetLanguage, StringComparison.InvariantCultureIgnoreCase))
                        .Split(':')[1];
                }
                else
                {
                    if (isSemantics)
                    {
                        languageName = headerColumns
                            .First(x => x.StartsWith(ColumnSemantics, StringComparison.InvariantCultureIgnoreCase))
                            .Split(':')[1];
                    }
                    else
                    {
                        continue;
                    }
                }
            }
#pragma warning restore IDE0045 // Convert to conditional expression
            var column = columns[i];
            var entry = new TextEntry
            {
                Language = voiceLanguages.FirstOrDefault(x => x.LanguageName == languageName) ??
                           VoiceLanguage.System,
                Text = column.Trim('"').Trim()
            };

            entryRow.Add(entry);
        }

        return entryRow;
    }


    /// <summary>
    ///     Splits a CSV line into individual fields, handling quoted fields and escaped quotes.
    /// </summary>
    /// <param name="line">The CSV line to parse</param>
    /// <returns>A list of strings representing the CSV fields</returns>
    /// <remarks>
    ///     This method properly handles:
    ///     - Fields enclosed in quotes
    ///     - Escaped quotes within fields (represented as "")
    ///     - Commas within quoted fields
    ///     - Empty fields
    /// </remarks>
    public static List<string> SplitCsvLine(string line)
    {
        var result = new List<string>();
        var current = new StringBuilder();
        var inQuotes = false;
        var position = 0;

        foreach (var c in line)
        {
            if (c == '"')
            {
                // Toggle quoted state, unless it's an escaped quote ("")
                if (inQuotes && position + 1 < line.Length && line[position + 1] == '"')
                {
                    current.Append('"'); // escaped quote
                    position++; // skip next quote
                }
                else
                {
                    inQuotes = !inQuotes;
                }
            }
            else if (c == ',' && !inQuotes)
            {
                // End of field
                result.Add(current.ToString());
                current.Clear();
            }
            else
            {
                current.Append(c);
            }

            position++;
        }

        // Add last field
        result.Add(current.ToString());

        return result;
    }
}