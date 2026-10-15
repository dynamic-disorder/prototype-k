using CsvHelper.Configuration.Attributes;

namespace OllamaTranslatorApi.Models;

/// <summary>
///   Represents a single entry in the translations CSV file, containing the source text and its corresponding target text. This class serves as a data model for storing and manipulating translation pairs during the processing of the CSV file, allowing for easy access to both the original text and its translation throughout the application.
/// </summary>
public class CsvEntry
{
    /// <summary>
    ///  Gets or sets the source language (e.g., "English"). Defaults to "English".
    /// </summary>
    public string SourceLanguage { get; set; } = "English";

    /// <summary>
    ///  Gets or sets the source text from the CSV entry. This property holds the original text that is to be translated, allowing for easy reference and manipulation during the translation process. It is initialized to an empty string to ensure that it always has a valid value, even if the CSV entry is incomplete or missing data.
    /// </summary>
    public string SourceText { get; set; } = string.Empty;

    /// <summary>
    ///  Gets or sets the target language (e.g., "Finnish"). Defaults to "Finnish".
    /// </summary>
    public string TargetLanguage { get; set; } = "Finnish";

    /// <summary>
    ///  Gets or sets the target text from the CSV entry. This property holds the translated text corresponding to the source text, allowing for easy reference and manipulation during the translation process. It is initialized to an empty string to ensure that it always has a valid value, even if the CSV entry is incomplete or missing data.
    /// </summary>
    public string TargetText { get; set; } = string.Empty;

    /// <summary>
    ///  Gets or sets the hashtags associated with the CSV entry. Hashtags are used to categorize or label the translation entry (e.g. "#noun #food"). Initialized to an empty string when not provided.
    /// </summary>
    [Optional]
    public string Hashtags { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the semantic meaning or description associated with the current instance.
    /// </summary>
    [Optional]
    public string Semantics { get; set; } = string.Empty;

    /// <summary>
    /// Converts the current object's source language, source text, target language, target text, and hashtags to a single CSV-formatted string.
    /// </summary>
    /// <remarks>The returned string is suitable for inclusion as a line in a CSV file. Special characters
    /// such as commas, quotes, and newlines in the values are escaped according to CSV conventions.</remarks>
    /// <returns>A CSV-formatted string containing the source language, source text, target language, target text, and hashtags, with each value properly escaped
    /// and enclosed in double quotes.</returns>
    public string ToCsvStringWithHashtags()
    {
        var csvLine = $"\"{EscapeCsv(SourceLanguage)}\",\"{EscapeCsv(SourceText)}\",\"{EscapeCsv(TargetLanguage)}\",\"{EscapeCsv(TargetText)}\",\"{EscapeCsv(Hashtags)}\"";
        return csvLine;
    }

    /// <summary>
    /// Converts the source language, source text, target language, target text, and semantics to a single CSV-formatted string with proper escaping.
    /// </summary>
    /// <remarks>This method ensures that special characters such as commas, quotes, and newlines in the text
    /// fields are correctly escaped according to CSV formatting rules. The resulting string can be safely written to a
    /// CSV file or used in data exchange scenarios that require CSV format.</remarks>
    /// <returns>A CSV-formatted string containing the source language, source text, target language, target text, and semantics, with each value properly escaped
    /// and enclosed in double quotes.</returns>
    public string ToCsvStringWithSemantics()
    {
        var csvLine = $"\"{EscapeCsv(SourceLanguage)}\",\"{EscapeCsv(SourceText)}\",\"{EscapeCsv(TargetLanguage)}\",\"{EscapeCsv(TargetText)}\",\"{EscapeCsv(Semantics)}\"";
        return csvLine;
    }

    /// <summary>
    ///    Escapes a string for safe inclusion in a CSV file by doubling any existing double quotes.
    /// </summary>
    /// <param name="s">The input string to escape</param>
    /// <returns>The escaped string, safe for inclusion in a CSV file</returns>
    private static string EscapeCsv(string s)
    {
        return s.Replace("\"", "\"\"");
    }

    /// <summary>
    /// Get CSV header text containing only <see cref="SourceText"/> and <see cref="TargetText"/>
    /// </summary>
    /// <returns>Return the CSV header string</returns>
    public string GetCsvHeaders()
    {
        var csvLine = $"{nameof(SourceText)},{nameof(TargetText)}";
        return csvLine;
    }

    /// <summary>
    /// Get CSV header text containing source language, source text, target language, target text, and hashtags.
    /// </summary>
    /// <returns>Return the CSV header string</returns>
    public string GetCsvHeadersWithHashtags()
    {
        var csvLine = $"{nameof(SourceLanguage)},{nameof(SourceText)},{nameof(TargetLanguage)},{nameof(TargetText)},{nameof(Hashtags)}";
        return csvLine;
    }

    /// <summary>
    /// Get CSV header text containing source language, source text, target language, target text, and semantics.
    /// </summary>
    /// <returns>Return the CSV header string</returns>
    public string GetCsvHeadersWithSemantics()
    {
        var csvLine = $"{nameof(SourceLanguage)},{nameof(SourceText)},{nameof(TargetLanguage)},{nameof(TargetText)},{nameof(Semantics)}";
        return csvLine;
    }
}