using System.Globalization;
using System.Text;

using CsvHelper;
using CsvHelper.Configuration;

using OllamaTranslatorApi.Models;

namespace OllamaTranslatorApi.Csv;

internal sealed class TranslationCsvFileHandler
{
    /// <summary>
    ///     Sanitizes text for CSV storage by removing problematic characters and formatting.
    /// </summary>
    /// <remarks>
    ///     This method performs multiple cleaning operations:
    ///     1. Trims leading/trailing whitespace and double quotes
    ///     2. Replaces internal double quotes with backticks to prevent CSV issues
    ///     3. Removes markdown code block markers ("```text", "```")
    ///     4. Replaces line breaks ("\r\n", "\n") with spaces
    ///     5. Returns a trimmed, clean string suitable for CSV storage
    /// </remarks>
    /// <param name="input">String input that may contain quotes, markdown, or line breaks.</param>
    /// <returns>
    ///     Sanitized string. If the input string is null or empty, returns an empty quoted string ("").
    /// </returns>
    public static string SanitizeForCsv(string input)
    {
        if (string.IsNullOrEmpty(input))
        {
            return "\"\""; // Return empty quoted string for null or empty input
        }

        var output = input;
        output = output.Trim().Trim('\"');
        output = output.Replace("\"", "`"); // Replace internal quotes with single quotes to avoid CSV issues

        // Additional cleaning for common markdown and line break artifacts
        output = output.Replace("```text", "", StringComparison.InvariantCultureIgnoreCase);
        output = output.Replace("```", "");
        output = output.Replace("\r\n", " ");
        output = output.Replace("\n", " ");

        // Trim again after replacements
        output = output.Trim();

        return output;
    }

    /// <summary>
    ///     Reads CSV records from the specified input file path and returns a list of CsvEntry objects.
    ///     The method uses UTF-8 encoding with BOM for better compatibility with Excel. It utilizes the CsvHelper
    ///     library to read and parse the CSV file, mapping each record to a CsvEntry object.
    ///     The resulting list of CsvEntry objects is returned to the caller.
    /// </summary>
    /// <param name="inputFilepath">The path to the input CSV file.</param>
    /// <returns>A list of CsvEntry objects representing the records in the CSV file.</returns>
    public static List<CsvEntry> ReadCsvRecords(string inputFilepath)
    {
        // UTF-8 with BOM for better Excel compatibility
        var utf8WithBom = new UTF8Encoding(true);

        using var reader = new StreamReader(inputFilepath, utf8WithBom);

        using var csv = new CsvReader(reader, GetCsvConfiguration());
        List<CsvEntry>
            records = [.. csv.GetRecords<CsvEntry>()]; //Use collection expression to create a new list from the records
        return records;
    }

    private static CsvConfiguration GetCsvConfiguration()
    {
        var configuration = new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            Delimiter = ",", // CSV delimiter
            Encoding = Encoding.UTF8,
            Quote = '"', // Character used for quoting
            ShouldQuote = _ => true, // Always quote all fields
            NewLine = "\r\n", // Force CRLF line endings
            BadDataFound = null,// Ignore bad data to prevent exceptions when encountering malformed CSV lines
            PrepareHeaderForMatch = args => HandlePrepareHeaderForMatch(args), // Trim headers and remove quotes for better matching with CsvEntry properties
            IgnoreBlankLines = true, // Ignore blank lines to prevent issues with empty lines in the CSV file
            MissingFieldFound = null, // Ignore missing fields to prevent exceptions when records have fewer fields than expected
            HeaderValidated = null, // Disable header validation to allow for flexible CSV formats without strict header requirements
        };

        return configuration;
    }

    /// <summary>
    /// Convert CSV headers to lowercase and trim whitespace and quotes for better matching with CsvEntry properties. 
    /// <remarks>
    /// Also checks for presence of LF without CRLF, which is not allowed as it indicates the file is LF and not CRLF, 
    /// which can cause issues with CsvHelper header matching, and currently result into CsvReader returning empty records. 
    /// If such case is detected, an InvalidOperationException is thrown to indicate the issue with the input file format.
    /// </remarks>
    /// </summary>
    /// <param name="args"></param>
    /// <returns></returns>
    /// <exception cref="InvalidOperationException"></exception>
    private static string HandlePrepareHeaderForMatch(PrepareHeaderForMatchArgs args)
    {
        // Trim headers and remove quotes for better matching with CsvEntry properties
        var headerValue = args.Header;

        if (headerValue == null)
        {
            return String.Empty;
        }

        // Clean any newline characters from header (should not be present in proper CSV headers)
        headerValue = headerValue.Replace("\r\n", " ").Replace("\n", " ").Replace("\r", " ");

        var header = headerValue.Trim().Trim('"').Trim('[').Trim(']');
        return header.ToLower(CultureInfo.InvariantCulture);// Convert to lowercase for case-insensitive matching with CsvEntry properties
    }

    /// <summary>
    ///     Writes a list of CsvEntry objects to a CSV file at the specified output file path.
    ///     The method ensures that the output directory exists before writing the file.
    ///     It uses UTF-8 encoding with BOM for better compatibility with Excel and the CsvHelper library
    ///     to write the records to the CSV file. The method returns a string indicating the result of the operation,
    ///     including the number of records saved or any errors encountered during the writing process.
    /// </summary>
    /// <param name="sourceRecords">A list of CsvEntry objects representing the original source records.</param>
    /// <param name="translatedRecords">A list of CsvEntry objects to be written to the output CSV file.</param>
    /// <param name="outputFilepath">The path to the output CSV file.</param>
    /// <param name="fromLanguage">The source language code (e.g., "en" for English) used for translation, included in the result message for context.</param>
    /// <param name="toLanguage">The target language code (e.g., "fr" for French) used for translation, included in the result message for context.</param>
    /// <returns>
    ///     A string indicating the result of the operation, including the number of records saved or any errors
    ///     encountered.
    /// </returns>
    public static string WriteCsvRecords(List<CsvEntry> translatedRecords, string outputFilepath, string fromLanguage, string toLanguage)
    {
        // UTF-8 with BOM for better Excel compatibility
        var utf8WithBom = new UTF8Encoding(true);

        // Ensure output directory exists
        _ = EnsureOutputDirectoryExists(outputFilepath);

        // Write output CSV
        using var writer = new StreamWriter(outputFilepath, false, utf8WithBom);

        string result;
        using var csvWriter = new CsvWriter(writer, GetCsvConfiguration());

        try
        {
            // Write header
            var shouldQuote = false;
            csvWriter.WriteField("[Source:" + fromLanguage + "]", shouldQuote);
            csvWriter.WriteField("[Target:" + toLanguage + "]", shouldQuote);

            // Determine if we need Semantics or Hashtags column based on first record (if any)
            if (translatedRecords.Count > 0)
            {
                var firstRecord = translatedRecords.First();
                if (!string.IsNullOrEmpty(firstRecord.Semantics))
                {
                    csvWriter.WriteField("[Semantics:" + fromLanguage + "]", shouldQuote);
                }
                else if (!string.IsNullOrEmpty(firstRecord.Hashtags))
                {
                    csvWriter.WriteField("[Hashtags:" + fromLanguage + "]", shouldQuote);
                }
            }
            else
            {
                // For empty records, include Hashtags column as default
                csvWriter.WriteField("[Hashtags:" + fromLanguage + "]", shouldQuote);
            }

            csvWriter.NextRecord();

            // Write rows if there are any
            if (translatedRecords.Count > 0)
            {
                foreach (var record in translatedRecords)
                {
                    csvWriter.WriteField(record.SourceText);
                    csvWriter.WriteField(record.TargetText);

                    if (!string.IsNullOrEmpty(record.Semantics))
                    {
                        csvWriter.WriteField(record.Semantics);
                    }
                    else if (!string.IsNullOrEmpty(record.Hashtags))
                    {
                        csvWriter.WriteField(record.Hashtags);
                    }

                    csvWriter.NextRecord();
                }
                result = $"Done: {translatedRecords.Count} results saved to {outputFilepath}";
            }
            else
            {
                result = $"Done: 0 results saved to {outputFilepath}";
            }
        }
        catch (IOException ex)
        {
            result = $"Error: Failed to write output file `{outputFilepath}`: {ex.Message}";
        }

        return result;
    }

    /// <summary>
    ///     Ensures that the output directory exists before writing the CSV file. If the directory does not exist, it creates
    ///     it.
    /// </summary>
    /// <param name="outputFilePath">The full path to the output CSV file.</param>
    /// <returns>The output directory path.</returns>
    private static string EnsureOutputDirectoryExists(string outputFilePath)
    {
        var outputDir = Path.GetDirectoryName(outputFilePath);
        if (!string.IsNullOrEmpty(outputDir) && !Directory.Exists(outputDir))
        {
            Directory.CreateDirectory(outputDir);
        }

        return outputDir ?? string.Empty;
    }
}