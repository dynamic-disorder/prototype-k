namespace OllamaTranslatorApi.Models;

/// <summary>
///     Represents the structured result of a translation operation returned by <see cref="ITranslationService"/>.
///     <see cref="TranslatedText"/> contains the translated word or phrase; <see cref="Hashtags"/> contains
///     optional category tags (e.g. <c>#noun #food</c>) parsed from the LLM response.
///     Use <see cref="Empty"/> to represent a failed or empty translation result.
/// </summary>
public record TranslationResponse(string TranslatedText, string Hashtags = "")
{
    /// <summary>
    ///     A singleton empty response used when a translation could not be produced
    ///     (e.g. after an HTTP error or an empty API response).
    /// </summary>
    public static readonly TranslationResponse Empty = new(string.Empty);
}