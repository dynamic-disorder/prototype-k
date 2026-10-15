using OllamaTranslatorApi.Models;

namespace OllamaTranslatorApi.Core;

public interface IOllamaTranslator
{
    /// <summary>
    ///     The base URL for the Ollama API endpoint used for generating translations.
    /// </summary>
    string OllamaUrl { get; }

    /// <summary>
    /// Gets the name of the large language model (LLM) currently used by the translation service.
    /// </summary>
    /// <returns>A string containing the name of the LLM model in use. The value may be null or empty if no model is configured.</returns>
    string OllamaLlmModelName { get; }

    /// <summary>
    /// Gets the source language code for translation operations.
    /// </summary>
    string SourceLanguage { get; }

    /// <summary>
    /// Gets the target language code for translation operations.
    /// </summary>
    string TargetLanguage { get; }

    /// <summary>
    /// Gets the default AI prompt used for translation.
    /// </summary>
    string AiPrompt { get; }

    /// <summary>
    ///     Translate in batches with controlled parallelism to avoid overwhelming the API and to improve performance.
    /// </summary>
    /// <param name="entries">The source texts contained in a list of <see cref="CsvEntry" /></param>
    /// <param name="maxParallelTasks">Optional max concurrent requests. Default: 4.</param>
    /// <param name="prompt">
    ///     Optional prompt template override (use <c>{text}</c> as the placeholder).
    ///     Falls back to <see cref="AiPrompt"/>, then to the built-in default.
    /// </param>
    /// <returns>A list of <see cref="CsvEntry" /> containing translations.</returns>
    Task<List<CsvEntry>> BatchTranslateAsync(List<CsvEntry> entries, int maxParallelTasks = 4, string prompt = "");

    /// <summary>
    ///     Translates a single word or phrase and returns the result as a <see cref="CsvEntry" />
    ///     with <see cref="CsvEntry.TargetText" /> and <see cref="CsvEntry.Hashtags" /> populated.
    /// </summary>
    /// <param name="sourceText">The word or phrase to translate.</param>
    /// <param name="prompt">
    ///     Optional prompt template override (use <c>{text}</c> as the placeholder).
    ///     Falls back to <see cref="AiPrompt"/>, then to the built-in default.
    /// </param>
    /// <returns>A <see cref="CsvEntry" /> containing the translation and its related hashtags.</returns>
    Task<CsvEntry> TranslateAsync(string sourceText, string prompt = "");

    /// <summary>
    /// Translates text using a custom prompt, bypassing all default prompts.
    /// </summary>
    /// <param name="text">The text to translate.</param>
    /// <param name="userPrompt">The custom prompt to use for translation.</param>
    /// <returns>The translated text.</returns>
    Task<string> TranslateWithCustomPromptAsync(string text, string userPrompt);

    /// <summary>
    /// Translates text using default settings (auto-detection or configured defaults).
    /// </summary>
    /// <param name="text">The text to translate.</param>
    /// <returns>The translated text.</returns>
    Task<string> TranslateTextAsync(string text);

    /// <summary>
    ///     Processes a CSV file by reading it, translating its contents, and writing the translated results to a new CSV file.
    /// </summary>
    /// <param name="inputFilepath">The path to the input CSV file.</param>
    /// <param name="outputFilepath">The path where the translated output CSV file will be saved.</param>
    /// <returns>A <see cref="System.String" /> containing file processing status.</returns>
    Task<string> ProcessCsvAsync(string inputFilepath, string outputFilepath);
}