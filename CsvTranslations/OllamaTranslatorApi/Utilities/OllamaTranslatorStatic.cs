using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;

using CliUtils;

using OllamaTranslatorApi.Configuration;
using OllamaTranslatorApi.Core;
using OllamaTranslatorApi.Models;

using TranslationTools;

namespace OllamaTranslatorApi.Utilities;

/// <summary>
/// Simple static wrapper for Ollama translation without dependency injection.
/// Loads configuration from JSON file once at startup and provides translation methods.
/// Includes dynamic model switching via aliases defined in the configuration.
/// </summary>
public static class OllamaTranslatorStatic
{
    private static readonly HttpClient _client = new HttpClient();
    private static OllamaApiConfig? _config = null!;
    private static readonly object _configLock = new object();
    private static bool _initialized;

    private static OllamaApiConfig Config
    {
        get
        {
            EnsureInitialized();
            return _config!;
        }
    }

    /// <summary>
    /// Initializes the static translator with configuration from a JSON file.
    /// Call this method once at application startup.
    /// </summary>
    /// <param name="configPath">Path to the Ollama configuration JSON file. Defaults to "ollama-config.json".</param>
    public static void Initialize(string configPath = "ollama-config.json")
    {
        if (_initialized)
            return;

        lock (_configLock)
        {
            if (_initialized)
                return;

            _config = OllamaApiConfig.LoadFromFile(configPath);

            // Ensure model aliases have at least the default alias
            if (_config.ModelAliases == null)
            {
                _config.ModelAliases = new Dictionary<string, string>();
            }

            // Add "default" alias if not already present
            if (!_config.ModelAliases.ContainsKey("default"))
            {
                _config.ModelAliases["default"] = _config.ModelName;
            }

            _initialized = true;
            ConsoleColorHelper.WriteInfo($"OllamaTranslatorStatic initialized with model: {_config.ModelName}");
        }
    }

    /// <summary>
    /// Translates text using the specified model alias.
    /// </summary>
    /// <param name="text">The text to translate.</param>
    /// <param name="modelAlias">The model alias to use (e.g., "default", "fast", "accurate").
    /// Must be defined in the configuration's ModelAliases.
    /// If null or empty, uses the "default" alias.
    /// </param>
    /// <param name="promptOverride">Optional prompt template override. Use "{text}" as placeholder for source text.
    /// If empty, uses the prompt from configuration.
    /// </param>
    /// <returns>The translated text.</returns>
    public static async Task<string> TranslateAsync(
        string text,
        string modelAlias = "default",
        string promptOverride = "")
    {
        var config = Config;
        var modelToUse = config.GetModelForAlias(modelAlias);
        var prompt = string.IsNullOrEmpty(promptOverride)
            ? config.Prompt
            : promptOverride;

        var finalPrompt = OllamaTranslatorStatic.GetRequestPrompt(prompt, text);

        var request = new
        {
            model = modelToUse,
            prompt = finalPrompt,
            stream = false,
            keep_alive = config.KeepAlive
        };

        try
        {
            var response = await _client.PostAsJsonAsync(config.ApiUrl, request);
            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<OllamaResponse>();
            return result?.Response?.Trim() ?? string.Empty;
        }
        catch (Exception ex)
        {
            ConsoleColorHelper.WriteError($"Error translating text: {ex.Message}");
            return string.Empty;
        }
    }

    /// <summary>
    ///     Builds the prompt sent to the LLM. If <paramref name="promptTemplate"/> is provided it is
    ///     used as a template with <c>{text}</c> replaced by the source text; otherwise the built-in
    ///     default template is used.
    /// </summary>
    /// <param name="promptTemplate">Prompt template. Use <c>{text}</c> as the placeholder.</param>
    /// <param name="text">The (already-trimmed) source text to translate.</param>
    /// <param name="semantics">Optional semantics to include in the prompt. Use <c>{semantics}</c> as the placeholder.</param>
    public static string GetRequestPrompt(string promptTemplate, string text, string semantics = "")
    {
        var prompt = promptTemplate.Replace("{text}", text);
        if (promptTemplate.Contains("{semantics}", StringComparison.OrdinalIgnoreCase))
        {
            prompt = prompt.Replace("{semantics}", semantics);
        }
        return prompt;
    }

    /// <summary>
    /// Translates a list of texts in batch with controlled parallelism.
    /// </summary>
    /// <param name="texts">The list of texts to translate.</param>
    /// <param name="modelAlias">The model alias to use (e.g., "default", "fast", "accurate").
    /// Must be defined in the configuration's ModelAliases.
    /// If null or empty, uses the "default" alias.
    /// </param>
    /// <param name="promptOverride">Optional prompt template override. Use "{text}" as placeholder for source text.
    /// If empty, uses the prompt from configuration.
    /// </param>
    /// <param name="maxParallelTasks">Maximum number of parallel translation tasks. Default is 4.</param>
    /// <returns>A list of translated texts in the same order as input.</returns>
    public static async Task<List<string>> BatchTranslateAsync(
        List<string> texts,
        string modelAlias = "default",
        string promptOverride = "",
        int maxParallelTasks = 4)
    {
        EnsureInitialized();

        var results = new List<string>();
        var lockObj = new object();
        int total = texts.Count;
        int completed = 0;

        await Parallel.ForEachAsync(texts, new ParallelOptions { MaxDegreeOfParallelism = maxParallelTasks },
            async (text, token) =>
            {
                await Task.Delay(100, token); // Small delay to prevent overwhelming the API

                var translated = await TranslateAsync(text, modelAlias, promptOverride);

                lock (lockObj)
                {
                    results.Add(translated);
                    completed++;
                    var preview = string.IsNullOrEmpty(text) ? "[empty]" : text.Substring(0, Math.Min(text.Length, 30));
                    ConsoleColorHelper.WriteInfo($"Translated {completed}/{total}: {preview}...");
                }
            });

        return results;
    }

    /// <summary>
    /// Gets the actual model name for a given alias.
    /// </summary>
    public static string GetModelForAlias(string alias)
    {
        var config = Config;
        return config.GetModelForAlias(alias);
    }

    /// <summary>
    /// Gets all available model aliases from the configuration.
    /// </summary>
    public static Dictionary<string, string> GetModelAliases()
    {
        var config = Config;
        return new Dictionary<string, string>(config.ModelAliases);
    }

    /// <summary>
    /// Updates the configuration (useful for testing or runtime changes).
    /// </summary>
    public static void UpdateConfig(OllamaApiConfig newConfig)
    {
        lock (_configLock)
        {
            _config = newConfig;
        }
    }

    private static void EnsureInitialized()
    {
        if (!_initialized)
        {
            Initialize();
        }
    }
}