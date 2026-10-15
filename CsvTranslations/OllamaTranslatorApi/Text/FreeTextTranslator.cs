using System;
using System.Threading.Tasks;

using OllamaTranslatorApi.Core;
using OllamaTranslatorApi.Models;

namespace OllamaTranslatorApi.Text;

/// <summary>
/// Provides a simple API for free text translation using Ollama AI.
/// Supports custom prompts and automatic language detection with defaults.
/// </summary>
public class FreeTextTranslator
{
    private readonly OllamaTranslator _translator;

    /// <summary>
    /// Initializes a new instance of the FreeTextTranslator class.
    /// </summary>
    /// <param name="translator">The OllamaTranslator instance to use for translation.</param>
    public FreeTextTranslator(OllamaTranslator translator)
    {
        _translator = translator ?? throw new ArgumentNullException(nameof(translator));
    }

    /// <summary>
    /// Translates text using the default prompt configured in the translator.
    /// Automatically uses source/target language settings from the translator.
    /// </summary>
    /// <param name="text">The text to translate.</param>
    /// <returns>The translated text.</returns>
    public async Task<string> TranslateAsync(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return text;
        }

        try
        {
            return await _translator.TranslateTextAsync(text);
        }
        catch (Exception ex)
        {
            // Re-throw with context
            throw new InvalidOperationException($"Failed to translate text: '{text}'", ex);
        }
    }

    /// <summary>
    /// Translates text using a custom prompt template.
    /// The prompt template should contain "{text}" placeholder for the source text.
    /// </summary>
    /// <param name="text">The text to translate.</param>
    /// <param name="customPrompt">Custom prompt template with "{text}" placeholder.</param>
    /// <returns>The translated text.</returns>
    public async Task<string> TranslateWithCustomPromptAsync(string text, string customPrompt)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return text;
        }

        if (string.IsNullOrWhiteSpace(customPrompt))
        {
            return await TranslateAsync(text);
        }

        try
        {
            return await _translator.TranslateWithCustomPromptAsync(text, customPrompt);
        }
        catch (Exception ex)
        {
            // Re-throw with context
            throw new InvalidOperationException($"Failed to translate text with custom prompt: '{text}'", ex);
        }
    }

    /// <summary>
    /// Translates text using a specific prompt name from the configured prompt examples.
    /// Note: This method is deprecated as prompt names are not directly supported.
    /// Use TranslateWithCustomPromptAsync with explicit prompt template instead.
    /// </summary>
    /// <param name="text">The text to translate.</param>
    /// <param name="promptName">Name of the prompt to use (e.g., "NarrativeSimple", "Technical").</param>
    /// <returns>The translated text.</returns>
    [Obsolete("Prompt names are not directly supported. Use TranslateWithCustomPromptAsync with explicit prompt template instead.")]
    public async Task<string> TranslateWithPromptNameAsync(string text, string promptName)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return text;
        }

        if (string.IsNullOrWhiteSpace(promptName))
        {
            return await TranslateAsync(text);
        }

        // For compatibility, treat promptName as a custom prompt template
        // Users should provide the actual prompt template, not just a name
        return await TranslateWithCustomPromptAsync(text, promptName);
    }

    /// <summary>
    /// Translates text with semantic context for better translation accuracy.
    /// </summary>
    /// <param name="text">The text to translate.</param>
    /// <param name="semanticContext">Additional semantic context to guide the translation.</param>
    /// <returns>The translated text.</returns>
    public async Task<string> TranslateWithContextAsync(string text, string semanticContext)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return text;
        }

        try
        {
            // Create a CsvEntry with semantics
            var entry = new CsvEntry
            {
                SourceText = text,
                Semantics = semanticContext ?? string.Empty
            };

            // Use the translator's batch translation with semantics support
            var translatedEntry = await _translator.TranslateEntryAsync(entry);
            return translatedEntry.TargetText ?? string.Empty;
        }
        catch (Exception ex)
        {
            // Re-throw with context
            throw new InvalidOperationException($"Failed to translate text with context: '{text}'", ex);
        }
    }

    /// <summary>
    /// Gets information about the current translator configuration.
    /// </summary>
    /// <returns>A string describing the translator configuration.</returns>
    public string GetConfigurationInfo()
    {
        return $"Source language: {_translator.SourceLanguage}, " +
               $"Target language: {_translator.TargetLanguage}, " +
               $"Model: {_translator.OllamaLlmModelName}";
    }
}