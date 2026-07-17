using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;

using CliUtils;

using OllamaTranslatorApi.Core;
using OllamaTranslatorApi.Models;

namespace OllamaTranslatorApi.Csv;

/// <summary>
/// Handles translation of CSV files using Ollama AI.
/// Extracted from OllamaTranslator.ProcessCsvAsync for clean separation of concerns.
/// </summary>
public class CsvFileTranslator
{
    private readonly OllamaTranslator _translator;

    /// <summary>
    /// Initializes a new instance of the CsvFileTranslator class.
    /// </summary>
    /// <param name="translator">The OllamaTranslator instance to use for translation.</param>
    public CsvFileTranslator(OllamaTranslator translator)
    {
        _translator = translator ?? throw new ArgumentNullException(nameof(translator));
    }

    /// <summary>
    /// Translates a CSV file from source to target language.
    /// </summary>
    /// <param name="inputFilepath">Path to the input CSV file.</param>
    /// <param name="outputFilepath">Path where the translated CSV will be saved.</param>
    /// <param name="prompt">Optional custom prompt for translation. If null, uses translator's default prompt.</param>
    /// <returns>A result message indicating success or failure.</returns>
    public async Task<string> TranslateFileAsync(string inputFilepath, string outputFilepath, string? prompt = null)
    {
        // Verify input file exists
        if (!File.Exists(inputFilepath))
        {
            throw new FileNotFoundException(
                $"Input file `{inputFilepath}` not found in current working directory `{Directory.GetCurrentDirectory()}`.");
        }

        try
        {
            List<CsvEntry> records = TranslationCsvFileHandler.ReadCsvRecords(inputFilepath);

            if (records.Count == 0)
            {
                var errorNoRecords = $"No records found in `{inputFilepath}`. Please check the file content.";
                ConsoleColorHelper.WriteWarning(errorNoRecords);
                return errorNoRecords; // Exit if no records to process
            }

            ConsoleColorHelper.WriteInfo($"Translating {records.Count} phrases, from `{_translator.SourceLanguage}` to `{_translator.TargetLanguage}`.{Environment.NewLine}" 
                + $"Using LLM `{_translator.OllamaLlmModelName}`.{Environment.NewLine}"
                + $"Using prompt `{_translator.AiPrompt}`.{Environment.NewLine}");

            // Use custom prompt if provided, otherwise use translator's default
            List<CsvEntry> translatedRecords = string.IsNullOrEmpty(prompt) 
                ? await _translator.BatchTranslateAsync(records)
                : await _translator.BatchTranslateAsync(records, prompt: prompt);

            var result = TranslationCsvFileHandler.WriteCsvRecords(translatedRecords, outputFilepath, _translator.SourceLanguage, _translator.TargetLanguage);
            //result example: "Done: 47 results saved to split\translated_en_vi.translated.csv"
            ConsoleColorHelper.WriteFileResult(result);

            return result;
        }
        catch (IOException ex)
        {
            // Re-throw IO exceptions to maintain expected behavior
            throw new IOException($"File operation failed: {ex.Message}", ex);
        }
        catch (Exception)
        {
            // Re-throw all other exceptions
            throw;
        }
    }
}