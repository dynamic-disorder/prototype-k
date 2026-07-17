using System.Collections.Generic;

using Newtonsoft.Json;

namespace OllamaTranslatorApi.Configuration;

/// <summary>
/// Extended configuration for Ollama API with dynamic model switching capabilities.
/// Inherits from OllamaTranslatorSettings and adds model aliases for dynamic model selection.
/// </summary>
public class OllamaApiConfig : OllamaTranslatorSettings
{
    /// <summary>
    /// Dictionary of model aliases for dynamic model switching.
    /// Keys: alias names (e.g., "fast", "accurate")
    /// Values: actual model names (e.g., "tinyllama", "llama2:13b")
    /// </summary>
    public Dictionary<string, string> ModelAliases { get; set; } = new Dictionary<string, string>();

    /// <summary>
    /// Keep-alive duration for Ollama API to prevent model reloading between calls.
    /// Default: "10m" (10 minutes)
    /// </summary>
    public string KeepAlive { get; set; } = "10m";

    /// <summary>
    /// Loads configuration from a JSON file. Returns default configuration if the file does not exist.
    /// </summary>
    public static new OllamaApiConfig LoadFromFile(string path)
    {
        if (!File.Exists(path))
            return new OllamaApiConfig();

        var json = File.ReadAllText(path);
        return JsonConvert.DeserializeObject<OllamaApiConfig>(json)
               ?? new OllamaApiConfig();
    }

    /// <summary>
    /// Gets the actual model name for a given alias.
    /// If the alias doesn't exist, returns the default model name.
    /// </summary>
    public string GetModelForAlias(string alias)
    {
        if (ModelAliases != null && ModelAliases.TryGetValue(alias, out var model))
        {
            return model;
        }
        return ModelName;
    }
}