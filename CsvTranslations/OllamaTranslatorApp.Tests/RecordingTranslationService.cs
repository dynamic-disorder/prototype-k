using System.Collections.Concurrent;

using OllamaTranslatorApi.Core;
using OllamaTranslatorApi.Models;

namespace OllamaTranslatorApp.Tests;

/// <summary>
///     An <see cref="ITranslationService" /> test double that records every
///     <see cref="TranslationRequest" /> it receives and returns canned translations.
///     Lets tests observe prompt/semantics plumbing without a network call.
/// </summary>
public sealed class RecordingTranslationService : ITranslationService
{
    private readonly ConcurrentQueue<TranslationRequest> _requests = new();

    /// <summary>
    ///     Every request received so far, in completion order.
    ///     Translation is parallelised, so do not rely on this order.
    /// </summary>
    public IReadOnlyCollection<TranslationRequest> Requests => _requests.ToArray();

    /// <inheritdoc />
    public Task<TranslationResponse> TranslateAsync(TranslationRequest request)
    {
        _requests.Enqueue(request);

        TranslationResponse response = request.Text switch
        {
            "Hello" => new TranslationResponse("Hola"),
            "World" => new TranslationResponse("Mundo"),
            "Test" => new TranslationResponse("Prueba"),
            _ => new TranslationResponse($"translated:{request.Text}"),
        };

        return Task.FromResult(response);
    }

    /// <inheritdoc />
    public string GetLlmModelName() => "RecordingModel";
}
