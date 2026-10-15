using OllamaTranslatorApi.Models;

namespace OllamaTranslatorApi.Core;

/// <summary>
///   Defines an interface for a translation service that provides asynchronous translation capabilities. Implementations of this interface are expected to provide a method for translating text, allowing for flexibility in how translations are performed (e.g., using different APIs or algorithms). The interface abstracts the translation functionality, enabling the application to use various translation services interchangeably without being tightly coupled to a specific implementation.
/// </summary>
public interface ITranslationService
{
    /// <summary>
    ///     Translates the given request asynchronously and returns a structured <see cref="TranslationResponse"/>
    ///     containing the translated text and any associated hashtags parsed from the LLM response.
    ///     Returns <see cref="TranslationResponse.Empty"/> on failure (HTTP error, empty response, etc.)
    ///     rather than throwing, keeping the translation pipeline non-fatal.
    /// </summary>
    /// <param name="request">The translation request containing the source text and an optional prompt template.</param>
    /// <remarks>
    ///     Use the default prompt template defined in <see cref="OllamaTranslationRequest.DefaultPromptTemplate"/> 
    ///     if the request does not specify a custom prompt. The prompt should instruct the LLM to return
    ///     a JSON object with "translatedText" and "hashtags" fields, where "translatedText" contains
    ///     the translated text and "hashtags" contains a comma-separated list of relevant hashtags. 
    ///     The translation service implementation is responsible for parsing the LLM response and 
    ///     populating the <see cref="TranslationResponse"/> accordingly.
    /// </remarks>
    /// <returns>
    ///     A task that represents the asynchronous operation.
    ///     The task result is a <see cref="TranslationResponse"/> with <see cref="TranslationResponse.TranslatedText"/>
    ///     and <see cref="TranslationResponse.Hashtags"/> populated, or <see cref="TranslationResponse.Empty"/> on failure.
    /// </returns>
    Task<TranslationResponse> TranslateAsync(TranslationRequest request);

    /// <summary>
    /// Gets the name of the language model to be used for translation. This method currently returns a hardcoded model name "translategemma:12b", which is specified in the OllamaTranslationRequest class as the default value for the Model property. The method can be modified in the future to allow for dynamic selection of different models based on specific translation requirements or user preferences, enabling greater flexibility and customization of the translation process.
    /// </summary>
    /// <returns>The name of the language model to be used for translation.</returns>
    string GetLlmModelName();
}