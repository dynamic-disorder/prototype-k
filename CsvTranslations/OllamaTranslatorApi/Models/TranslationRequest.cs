namespace OllamaTranslatorApi.Models;

/// <summary>
///     Represents a single translation request passed to <see cref="ITranslationService"/>.
///     <see cref="Prompt"/> is a template; use <c>{text}</c> as the placeholder for the source text.
///     Leave <see cref="Prompt"/> empty to let the service use its built-in default.
/// </summary>
public record TranslationRequest(string Text, string Prompt = "", string Semantics = "");