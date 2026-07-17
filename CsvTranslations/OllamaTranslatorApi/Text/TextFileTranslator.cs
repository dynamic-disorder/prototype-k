using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Threading.Tasks;

using CliUtils;

using OllamaTranslatorApi.Core;
using OllamaTranslatorApi.Models;

namespace OllamaTranslatorApi.Text;

/// <summary>
/// Handles translation of plain text files using Ollama AI.
/// Supports line-by-line translation with optional context from previous lines.
/// </summary>
public class TextFileTranslator
{
    private readonly OllamaTranslator _translator;
    private readonly bool _useContext;

    /// <summary>
    /// Initializes a new instance of the TextFileTranslator class.
    /// </summary>
    /// <param name="translator">The OllamaTranslator instance to use for translation.</param>
    /// <param name="useContext">Whether to include previous line as context for better narrative continuity.</param>
    public TextFileTranslator(OllamaTranslator translator, bool useContext = false)
    {
        _translator = translator ?? throw new ArgumentNullException(nameof(translator));
        _useContext = useContext;
    }

    /// <summary>
    /// Translates a text file from source to target language, line by line.
    /// </summary>
    /// <param name="inputFilepath">Path to the input text file.</param>
    /// <param name="outputFilepath">Path where the translated text will be saved.</param>
    /// <param name="prompt">Optional custom prompt for translation. If null, uses appropriate narrative prompt.</param>
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
            // Read all lines from the text file (preserving empty lines)
            var lines = await File.ReadAllLinesAsync(inputFilepath, Encoding.UTF8);
            
            if (lines.Length == 0)
            {
                var errorNoContent = $"No content found in `{inputFilepath}`. The file is empty.";
                ConsoleColorHelper.WriteWarning(errorNoContent);
                return errorNoContent;
            }

            // Convert lines to CsvEntry objects
            var entries = ConvertLinesToCsvEntries(lines);

            ConsoleColorHelper.WriteInfo($"Translating {entries.Count} lines, from `{_translator.SourceLanguage}` to `{_translator.TargetLanguage}`.{Environment.NewLine}" 
                + $"Using LLM `{_translator.OllamaLlmModelName}`.{Environment.NewLine}"
                + $"Using context-aware translation: {_useContext}{Environment.NewLine}");

            // Use appropriate prompt - get actual prompt template from settings
            var effectivePrompt = GetNarrativePrompt(prompt, _useContext);

            // Translate entries
            List<CsvEntry> translatedEntries = await _translator.BatchTranslateAsync(entries, prompt: effectivePrompt);

            // Write translated lines back to file
            await WriteTranslatedLinesAsync(translatedEntries, outputFilepath);

            var result = $"Done: {entries.Count} lines translated and saved to `{outputFilepath}`.";
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

    /// <summary>
    /// Converts text lines to CsvEntry objects, optionally adding previous line as context.
    /// </summary>
    private List<CsvEntry> ConvertLinesToCsvEntries(string[] lines)
    {
        var entries = new List<CsvEntry>();
        
        for (int i = 0; i < lines.Length; i++)
        {
            var entry = new CsvEntry
            {
                SourceText = lines[i]
            };

            if (_useContext && i > 0)
            {
                // Use previous line as semantic context for better narrative continuity
                entry.Semantics = lines[i - 1];
            }

            entries.Add(entry);
        }

        return entries;
    }

    /// <summary>
    /// Gets the appropriate narrative prompt based on context usage and custom prompt.
    /// </summary>
    private string GetNarrativePrompt(string? customPrompt, bool useContext)
    {
        // If a custom prompt is provided, use it
        if (!string.IsNullOrEmpty(customPrompt))
        {
            return customPrompt;
        }
        
        // Otherwise use appropriate narrative prompt name
        // These names should match keys in ollama-settings.json PromptExamples
        return useContext ? "NarrativeLineWithContext" : "NarrativeSimple";
    }

    /// <summary>
    /// Writes translated CsvEntry objects back to a text file.
    /// </summary>
    private static async Task WriteTranslatedLinesAsync(List<CsvEntry> translatedEntries, string outputFilepath)
    {
        // Ensure output directory exists
        var outputDirectory = Path.GetDirectoryName(outputFilepath);
        if (!string.IsNullOrEmpty(outputDirectory) && !Directory.Exists(outputDirectory))
        {
            Directory.CreateDirectory(outputDirectory);
        }

        // Build translated lines
        var translatedLines = new List<string>();
        foreach (var entry in translatedEntries)
        {
            // Use TargetText if available, otherwise fall back to SourceText (translation failed)
            var translatedLine = string.IsNullOrEmpty(entry.TargetText) ? entry.SourceText : entry.TargetText;
            translatedLines.Add(translatedLine);
        }

        // Write to file
        await File.WriteAllLinesAsync(outputFilepath, translatedLines, Encoding.UTF8);
    }
}