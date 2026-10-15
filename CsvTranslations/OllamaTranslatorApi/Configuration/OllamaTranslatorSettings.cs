using System.Collections.Generic;

using Newtonsoft.Json;

namespace OllamaTranslatorApi.Configuration;

/// <summary>
///     Configuration settings for the Ollama translator. Can be loaded from a JSON file
///     (e.g. <c>ollama-settings.json</c>) or constructed directly in code.
///     The <see cref="Prompt"/> field is a template: use <c>{text}</c> as the placeholder
///     for the source text that will be translated.
/// </summary>
public class OllamaTranslatorSettings
{
    public string ApiUrl { get; set; } = "http://localhost:11434/api/generate";
    public string ModelName { get; set; } = "translategemma:12b";

    /// <summary>
    ///     Prompt template sent to the LLM. Use <c>{text}</c> where the source text should be inserted.
    ///     Leave empty to use the built-in default prompt.
    /// </summary>
    public string Prompt { get; set; } = "";

    /// <summary>
    ///     Optional dictionary of named prompt examples for different use cases.
    ///     Keys are prompt names (e.g., "NarrativeSimple"), values are prompt templates.
    /// </summary>
    public Dictionary<string, string> PromptExamples { get; set; } = new Dictionary<string, string>();

    /// <summary>
    ///     Loads settings from a JSON file. Returns default settings if the file does not exist.
    /// </summary>
    public static OllamaTranslatorSettings LoadFromFile(string path)
    {
        if (!File.Exists(path))
            return new OllamaTranslatorSettings();

        var json = File.ReadAllText(path);
        return JsonConvert.DeserializeObject<OllamaTranslatorSettings>(json)
               ?? new OllamaTranslatorSettings();
    }
}