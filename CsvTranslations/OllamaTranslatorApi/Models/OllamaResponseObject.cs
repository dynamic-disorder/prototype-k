namespace OllamaTranslatorApi.Models;

/// <summary>
///     Represents the response object returned by the Ollama API when making a request to generate a response from a
///     model.
/// </summary>
public class OllamaResponseObject //TODO Check and remove. The translation response is no longer a JSON but a string.
{
    /// <summary>
    ///     The identifier of the model that produced the response (for example, "llama2" or a custom model name).
    /// </summary>
    public string Model { get; set; } = string.Empty;

    /// <summary>
    ///     The timestamp (usually in ISO 8601 or a provider-specific format) when the response was created.
    /// </summary>
    public string CreatedAt { get; set; } = string.Empty;

    /// <summary>
    ///     The textual content returned by the model as its generated response.
    /// </summary>
    public string Response { get; set; } = string.Empty;

    /// <summary>
    ///     Indicates whether the model finished generating the response.</summary>
    public bool Done { get; set; }

    /// <summary>
    ///     If <see cref="Done"/> is true, this may contain a short reason or status (for example, "completed" or "stopped").
    /// </summary>
    public string DoneReason { get; set; } = string.Empty;

    /// <summary>
    ///     Optional context window or token indices related to the response. The exact meaning depends on the API and model.
    /// </summary>
    public List<int> Context { get; set; } = [];

    /// <summary>
    ///     Total duration in milliseconds (or provider units) spent generating the response.
    /// </summary>
    public int TotalDuration { get; set; }

    /// <summary>
    ///     Time taken to load the model or prepare resources, in the same units as <see cref="TotalDuration"/>.
    /// </summary>
    public int LoadDuration { get; set; }

    /// <summary>
    ///     Number of prompt evaluation steps performed during generation (provider-specific metric).
    /// </summary>
    public int PromptEvalCount { get; set; }

    /// <summary>
    ///     Duration spent evaluating the prompt, in the same units as other duration fields.
    /// </summary>
    public int PromptEvalDuration { get; set; }

    /// <summary>
    ///     Total number of evaluation operations executed while generating the response.
    /// </summary>
    public int EvalCount { get; set; }

    /// <summary>
    ///     Duration of the evaluation phase of generation, in the same units as other duration fields.
    /// </summary>
    public int EvalDuration { get; set; }
}