using OllamaTranslatorApi.Core;
using OllamaTranslatorApi.Models;

namespace OllamaTranslatorApi.Tests;

/// <summary>
///   A test implementation of the ITranslationService interface for unit testing purposes. This class provides a simple mock translation service that returns predefined translations for specific input texts. It is designed to facilitate testing of components that depend on the ITranslationService without requiring an actual translation API or service to be available. The TranslateAsync method simulates asynchronous translation by returning a Task with the appropriate translation based on the input text, allowing for easy integration into unit tests that verify translation functionality.
/// </summary>
public sealed class TestTranslationService : ITranslationService
{
    /// <summary>
    ///   Translates the given text asynchronously by returning predefined translations for specific input texts. If the input text matches one of the predefined cases ("Unknown", "Hello", "World", "Test"), it returns the corresponding translation. If the input text does not match any of the predefined cases, it throws a NotSupportedException indicating that there is no translation available for the given text. This method simulates asynchronous behavior by returning a Task, allowing it to be used in unit tests that require asynchronous translation functionality.
    /// </summary>
    /// <param name="text">The text to be translated.</param>
    /// <returns>A Task representing the asynchronous translation operation, containing the translated text.</returns>
    /// <exception cref="NotSupportedException">Thrown when there is no predefined translation for the given text.</exception>
    public Task<TranslationResponse> TranslateAsync(TranslationRequest request)
    {
        try
        {
            var response = request.Text switch
            {
                "Unknown" => new TranslationResponse("MockTranslation:Unknown"),
                "Hello" => new TranslationResponse("Hola"),
                "World" => new TranslationResponse("Mundo"),
                "Test" => new TranslationResponse("Prueba"),
                _ => throw new NotSupportedException($"No translation for '{request.Text}'")
            };

            return Task.FromResult(response);
        }
        catch (Exception exception)
        {
            return Task.FromException<TranslationResponse>(exception);
        }
    }

    string ITranslationService.GetLlmModelName()
    {
        return "FakeModel";
    }
}