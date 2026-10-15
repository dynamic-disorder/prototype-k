using Newtonsoft.Json;

namespace OllamaTranslatorApi.Models;

/// <summary>
///  Represents a request to the Ollama API for translation, containing the model to be used, the prompt text to be translated, and a flag indicating whether the response should be streamed. This class serves as a data model for serializing the request parameters into JSON format when making API calls to the Ollama translation service, allowing for easy configuration of the translation request and ensuring that all necessary information is included in the API call.
/// </summary>
public class OllamaTranslationRequest
{
    /// <summary>
    /// Gets or sets the identifier of the model to be used for translation. This property specifies which language model the Ollama API should utilize when processing the translation request. It is initialized with a default value of "translategemma:12b", but can be modified to use different models as needed for specific translation tasks or requirements.
    /// </summary>
    [JsonProperty("model")] public string Model { get; set; } = "translategemma:12b";

    /// <summary>
    /// Gets or sets the prompt text to be translated. This property contains the original text that the user wants to translate, and it is sent to the Ollama API as part of the translation request. It is initialized to an empty string to ensure that it always has a valid value, even if the request is created without explicitly setting the prompt text. The content of this property will be processed by the specified model to generate the translated output.
    /// </summary>
    [JsonProperty("prompt")] public string Prompt { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets a value indicating whether the response should be streamed. This property allows the client to specify if the translation results should be returned incrementally as they are generated, rather than waiting for the entire translation to be completed.
    /// </summary>
    [JsonProperty("stream")] public bool Stream { get; set; }
}