using CliUtils;

using OllamaTranslatorApi.Configuration;
using OllamaTranslatorApi.Csv;
using OllamaTranslatorApi.Models;

using Spectre.Console;

namespace OllamaTranslatorApi.Core;

/// <summary>
///     The OllamaTranslator class provides functionality to translate text from English to Finnish using the Ollama API.
///     It includes methods for translating individual texts, batch translating a list of entries,
///     and processing CSV files containing source texts and saving the translated results.
///     The class handles HTTP communication with the Ollama API, error handling, and ensures proper CSV formatting for the
///     output.
/// </summary>
public class OllamaTranslator : IOllamaTranslator
{
    /// <inheritdoc/>
    public string OllamaUrl { get; } = "http://localhost:11434/api/generate";

    /// <summary>
    ///     The ITranslationService instance used for translating text.
    ///     It is initialized in the constructor and can be optionally injected for testing or customization purposes.
    /// </summary>
    private readonly ITranslationService _translationService; 

    /// <summary>
    ///     Default prompt used when no per-call prompt is supplied. Sourced from
    ///     <see cref="OllamaTranslatorSettings.Prompt"/>; empty means the built-in default is used.
    /// </summary>
    public string AiPrompt { get; private set; } = String.Empty;

    /// <summary>
    /// Gets the language code representing the source language for translation operations.
    /// </summary>
    public string SourceLanguage
    {
        get
        {
            return _sourceLanguage;
        }
    }

    /// <summary>
    /// Gets the target language code for translation operations.
    /// </summary>
    public string TargetLanguage
    {
        get
        {
            return _targetLanguage;
        }
    }

    /// <summary>
    ///     Initializes a new instance of the OllamaTranslator class.
    /// </summary>
    /// <param name="translationService"><see cref="ITranslationService" /> instance to use for translation operations.</param>
    /// <param name="settings">
    ///     Optional settings (API URL, model name, default prompt).
    ///     Load from file with <see cref="OllamaTranslatorSettings.LoadFromFile"/>.
    ///     When <c>null</c>, defaults are used.
    /// </param>
    public OllamaTranslator(ITranslationService? translationService = null, OllamaTranslatorSettings? settings = null)
    {
        var effectiveSettings = settings ?? new OllamaTranslatorSettings();
        OllamaUrl = effectiveSettings.ApiUrl;

        AiPrompt = ResolvePrompt(effectiveSettings.Prompt);

        _translationService = translationService
                              ?? new OllamaTranslationService(effectiveSettings.ApiUrl, effectiveSettings.ModelName);
    }

    /// <inheritdoc/>
    public string OllamaLlmModelName
    {
        get
        {
            if (_translationService == null)
            {
                ConsoleColorHelper.WriteWarning("Translation service is not initialized. Returning empty model name.");
                return string.Empty;
            }

            return _translationService.GetLlmModelName();
        }
    }

    /// <inheritdoc/>
    public async Task<List<CsvEntry>> BatchTranslateAsync(List<CsvEntry> entries, int maxParallelTasks = 4, string prompt = "")
    {
        if (entries.Count == 0)
        {
            return entries;
        }

        _resolvedPrompt = ResolvePrompt(prompt);
        var translatedEntries = new List<CsvEntry>();
        var lockObj = new object();
        int totalEntries = entries.Count;
        int counter = 0;
        await Parallel.ForEachAsync(entries, new ParallelOptions { MaxDegreeOfParallelism = maxParallelTasks },
            async (entry, token) =>
            {
                await Task.Delay(100, token); // Small delay to prevent overwhelming the API, a delay without blocking.

                CsvEntry result;
                try
                {
                    result = await TranslateEntryAsync(entry, _resolvedPrompt);
                    ConsoleColorHelper.WriteTranslation(counter, totalEntries, entry.SourceText, result.TargetText);
                    lock (lockObj)
                    {
                        counter++;
                    }
                }
                catch (Exception ex)
                {
                    ConsoleColorHelper.WriteError($"Error translating '{entry.SourceText}': {ex.Message}");
                    result = entry;
                }

                lock (lockObj)
                {
                    translatedEntries.Add(result);
                }
            });

        return translatedEntries;
    }

    /// <inheritdoc/>
    public async Task<CsvEntry> TranslateAsync(string sourceText, string prompt = "")
    {
        var entry = new CsvEntry { SourceText = sourceText };
        _resolvedPrompt = ResolvePrompt(prompt);
        return await TranslateEntryAsync(entry, _resolvedPrompt);
    }

    /// <inheritdoc/>
    public async Task<string> TranslateWithCustomPromptAsync(string text, string userPrompt)
    {
        var entry = new CsvEntry { SourceText = text };
        var translatedEntry = await TranslateEntryAsync(entry, userPrompt);
        return translatedEntry.TargetText ?? string.Empty;
    }

    /// <inheritdoc/>
    public async Task<string> TranslateTextAsync(string text)
    {
        var entry = new CsvEntry { SourceText = text };
        _resolvedPrompt = ResolvePrompt(string.Empty);
        var translatedEntry = await TranslateEntryAsync(entry, _resolvedPrompt);
        return translatedEntry.TargetText ?? string.Empty;
    }

    /// <summary>
    ///     Core translation logic: calls the translation service, deserializes the response,
    ///     and applies CSV formatting. Used by both <see cref="TranslateAsync" /> and
    ///     <see cref="BatchTranslateAsync" />.
    /// </summary>
    /// <param name="entry">The entry to translate. <see cref="CsvEntry.SourceText" /> must be set.</param>
    /// <param name="prompt">Resolved prompt template to forward to the translation service.</param>
    /// <returns>The same <see cref="CsvEntry" /> with <see cref="CsvEntry.TargetText" /> populated.</returns>
    internal async Task<CsvEntry> TranslateEntryAsync(CsvEntry entry, string prompt = "")
    {
        var response = await _translationService.TranslateAsync(new TranslationRequest(entry.SourceText, prompt, entry.Semantics));

        if (string.IsNullOrEmpty(response.TranslatedText))
        {
            ConsoleColorHelper.WriteWarning($"Received empty response text for '{entry.SourceText}'.");
            return entry;
        }

        entry.SourceText = TranslationCsvFileHandler.SanitizeForCsv(entry.SourceText);
        entry.TargetText = TranslationCsvFileHandler.SanitizeForCsv(response.TranslatedText);

        // Always set hashtags if present in response, regardless of prompt content
        if (!string.IsNullOrEmpty(response.Hashtags))
        {
            entry.Hashtags = TranslationCsvFileHandler.SanitizeForCsv(response.Hashtags);
        }

        return entry;
    }

    /// <summary>
    ///     Returns <paramref name="prompt"/> when non-empty; otherwise falls back to
    ///     <see cref="AiPrompt"/>, which itself may be empty (causing the service to use its built-in default).
    /// </summary>
    private string ResolvePrompt(string prompt)
    {
        _resolvedPrompt = !string.IsNullOrEmpty(prompt) ? prompt : AiPrompt;
        _sourceLanguage = ExtractSourceLanguage(_resolvedPrompt);
        _targetLanguage = ExtractTargetLanguage(_resolvedPrompt);
        return _resolvedPrompt;
    }

    /// <summary>
    ///   Extracts the target language name from a prompt string that specifies translation instructions.
    /// </summary>
    /// <remarks>
    ///   The method expects the prompt to contain the phrase 'Source language:' followed by the
    ///   language name and a period. If the expected format is not present, the method returns an empty string.
    /// </remarks>
    /// <param name="resolvedPrompt">The resolved prompt string containing the target language information.</param>
    /// <returns>The extracted target language, or an empty string if not found.</returns>
    private static string ExtractTargetLanguage(string resolvedPrompt)
    {
        // resolvedPromt example: "Translate: `{text}`. Source language: English. Target language: Finnish. ...
        var targetLanguage = ExtractBetween(resolvedPrompt, "Target language:", ".");
        return targetLanguage;
    }

    /// <summary>
    ///   Extracts the source language name from a prompt string that specifies translation instructions. 
    /// </summary>
    /// <remarks>
    ///   The method expects the prompt to contain the phrase 'Source language:' followed by the
    ///   language name and a period. If the expected format is not present, the method returns an empty string.
    /// </remarks>
    /// <param name="resolvedPrompt">The prompt string containing translation instructions, including a 'Source language' section. Cannot be null.</param>
    /// <returns>The name of the source language specified in the prompt, or an empty string if the source language is not found.</returns>
    private static string ExtractSourceLanguage(string resolvedPrompt)
    {
        // resolvedPromt example: "Translate: `{text}`. Source language: English. Target language: Finnish. ...
        var sourceLanguage = ExtractBetween(resolvedPrompt, "Source language:", ".");
        return sourceLanguage;
    }

    /// <summary>
    /// Extracts the substring that occurs between the specified start and end strings within the given text, ignoring
    /// case.
    /// </summary>
    /// <param name="text">The source string from which to extract the substring.</param>
    /// <param name="start">The string that marks the beginning of the substring to extract. The search is case-insensitive.</param>
    /// <param name="end">The string that marks the end of the substring to extract. The search is case-insensitive.</param>
    /// <returns>A trimmed substring found between the specified start and end strings. Returns an empty string if the start or
    /// end markers are not found in the correct order.</returns>
    private static string ExtractBetween(string text, string start, string end)
    {
        var i1 = text.IndexOf(start, StringComparison.InvariantCultureIgnoreCase);
        if (i1 == -1) return string.Empty;
        i1 += start.Length;
        
        var i2 = text.IndexOf(end, i1, StringComparison.InvariantCultureIgnoreCase);
        if (i2 == -1 || i2 <= i1) return string.Empty;
        
        return text[i1..i2].Trim();
    }

    /// <summary>
    /// Stores the resolved prompt text used internally by the class.
    /// </summary>
    private string _resolvedPrompt = string.Empty;

    /// <summary>
    /// Stores the source language code used for translation operations.
    /// </summary>
    private string _sourceLanguage = string.Empty;

    /// <summary>
    /// Stores the target language code used for translation operations.
    /// </summary>
    private string _targetLanguage = string.Empty;

    /// <inheritdoc/>
    public async Task<string> ProcessCsvAsync(string inputFilepath, string outputFilepath)
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
                // Still create an empty output file
                TranslationCsvFileHandler.WriteCsvRecords([], outputFilepath, _sourceLanguage, _targetLanguage);
                return errorNoRecords;
            }

            ConsoleColorHelper.WriteInfo($"Translating {records.Count} phrases, from `{_sourceLanguage}` to `{_targetLanguage}`.{Environment.NewLine}" 
                + $"Using LLM `{OllamaLlmModelName}`.{Environment.NewLine}"
                + $"Using prompt `{_resolvedPrompt}`.{Environment.NewLine}");

            List<CsvEntry> translatedRecords = await BatchTranslateAsync(records);

            var result = TranslationCsvFileHandler.WriteCsvRecords(translatedRecords, outputFilepath, _sourceLanguage, _targetLanguage);
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