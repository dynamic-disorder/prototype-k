using Newtonsoft.Json;

namespace OllamaTranslatorApi.Models;

/// <summary>
///  Represents the response from the Ollama API, containing the translated text, any context information, and a flag indicating whether the translation process is complete. This class serves as a data model for deserializing the JSON response from the Ollama API, allowing for easy access to the translation results and related metadata throughout the application.
/// </summary>
public class OllamaResponse
{
    /// <summary>
    /// Gets or sets the translated text from the Ollama API response. This property holds the result of the translation process, allowing for easy reference and manipulation of the translated text within the application. It is initialized to an empty string to ensure that it always has a valid value, even if the API response is incomplete or missing data.
    /// </summary>
    [JsonProperty("response")] public string Response { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the context information from the Ollama API response. This property holds any additional context or metadata related to the translation process, allowing for easy reference and manipulation of this information within the application. It is defined as a nullable list of long integers, indicating that it may not always be present in the API response.
    /// </summary>
    [JsonProperty("context")] public List<long>? Context { get; set; }

    /// <summary>
    /// Gets or sets a flag indicating whether the translation process is complete. This property allows the application to determine if the translation has finished, enabling appropriate handling of the translation results and any subsequent actions that may depend on the completion of the translation process.
    /// </summary>
    [JsonProperty("done")] public bool Done { get; set; }
}