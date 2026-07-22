using System.Collections.Concurrent;
using System.Text;

using CliUtils;

using Newtonsoft.Json;

using OllamaTranslatorApi.Models;
using OllamaTranslatorApi.Utilities;

using TranslationTools;

namespace OllamaTranslatorApi.Core;

public class OllamaTranslationService : ITranslationService
{
    // Consolidation: Shared HttpClient for connection pooling and memory efficiency
    private static readonly Lazy<HttpClient> _sharedHttpClient = new(() =>
        {
            var handler = new SocketsHttpHandler { PooledConnectionLifetime = TimeSpan.FromMinutes(5) };
            return new HttpClient(handler, disposeHandler: true);
        });

    // Consolidation: Response cache to minimize redundant API calls and token usage
    private static ConcurrentDictionary<string, (TranslationResponse response, DateTime timestamp)> _translationCache = new();
    private const int CacheTimeoutMinutes = 60;

    /// <summary>
    /// Generates a unique cache key based on the translation request properties.
    /// Combines Text, Prompt, and Semantics into a normalized string for consistent caching.
    /// </summary>
    private static string GetCacheKey(TranslationRequest request)
    {
        var hashInput = $"{request.Text}|{request.Prompt ?? string.Empty}|{request.Semantics ?? string.Empty}";
        return string.Intern(hashInput);
    }

    private const string DefaultApiUrl = "http://localhost:11434/api/generate";

    /// <summary>
    /// Defines the URL endpoint for the Ollama API translation service. This constant string specifies the base URL to which translation requests will be sent.
    /// </summary>
    private readonly string _apiUrl = DefaultApiUrl;

    private const string DefaultModelName = "translategemma:12b";
    private readonly string _llmModel = DefaultModelName;

    public OllamaTranslationService(
      string apiUrl = DefaultApiUrl,
      string modelName = DefaultModelName)
    {
        // Consolidation: Use shared HttpClient to reduce connection overhead
        _httpClient = _sharedHttpClient.Value;
    }

    /// <summary>
    /// Initializes a new instance of the OllamaTranslationService class.
    /// Consolidates HTTP client management and caches translation responses for memory efficiency.
    /// </summary>
    private readonly HttpClient _httpClient;

    /// <inheritdoc />
    public async Task<TranslationResponse> TranslateAsync(TranslationRequest request)
    {
        // Consolidation: Check cache first to minimize API calls and token usage
        string cacheKey = GetCacheKey(request);
        if (_translationCache.TryGetValue(cacheKey, out var cachedValue))
        {
            return cachedValue.response;
        }

        var textTrimmed = request.Text.Trim().Trim('"');
        // Consolidation: Use interning for repeated strings to save memory
        textTrimmed = string.Intern(textTrimmed);

        var ollamaRequest = new OllamaTranslationRequest
        {
            Model = GetLlmModelName(),
            Prompt = OllamaTranslatorStatic.GetRequestPrompt(request.Prompt, textTrimmed, request.Semantics),
            Stream = false
        };

        try
        {
            string json;
            await using (var stringWriter = new StringWriter())
            {
                var serializer = new JsonSerializer
                {
                    Formatting = Formatting.Indented
                };
                serializer.Serialize(stringWriter, ollamaRequest);
                json = stringWriter.ToString();
            }

            var content = new StringContent(json, Encoding.UTF8, "application/json");

            HttpResponseMessage response = await _httpClient.PostAsync(_apiUrl, content);

            response.EnsureSuccessStatusCode();

            var responseBody = await response.Content.ReadAsStringAsync();

            if (string.IsNullOrWhiteSpace(responseBody))
            {
                ConsoleColorHelper.WriteWarning($"Warning: Empty response body for '{request.Text}'. Returning empty.");
                return TranslationResponse.Empty;
            }

            var responseObject = JsonConvert.DeserializeObject<OllamaResponseObject>(responseBody.Trim());
            var rawText = responseObject?.Response?.Trim() ?? string.Empty;

            if (string.IsNullOrEmpty(rawText))
            {
                return TranslationResponse.Empty;
            }

            var parts = rawText.Split('|', 2);
            // Consolidation: Use interning for trimmed responses to save memory
            var translatedText = string.Intern(parts[0].Trim());
            var hashtags = string.Empty;
            if (parts.Length > 1)
            {
                hashtags = parts[1].Trim();
                hashtags = string.IsNullOrWhiteSpace(hashtags) ? hashtags : string.Intern(hashtags);
            }

            var translationResponse = new TranslationResponse(translatedText, hashtags);

            // Consolidation: Cache the response to minimize redundant API calls
            var timestamp = DateTime.UtcNow;
            _translationCache[cacheKey] = (translationResponse, timestamp);
            return translationResponse;
        }
        catch (HttpRequestException ex)
        {
            await Console.Error.WriteLineAsync($"HTTP request error for '{request.Text}': {ex.Message}");
            return TranslationResponse.Empty;
        }
        catch (JsonException ex)
        {
            await Console.Error.WriteLineAsync($"JSON parsing error for '{request.Text}': {ex.Message}");
            return TranslationResponse.Empty;
        }
        catch (Exception ex)
        {
            await Console.Error.WriteLineAsync($"Unexpected error during translation of '{request.Text}': {ex.Message}");
            return TranslationResponse.Empty;
        }
    }

    /// <summary>
    /// Detects if the response is a verbose explanation rather than a simple translation.
    /// </summary>
    private static bool IsVerboseExplanation(string response)
    {
        if (string.IsNullOrWhiteSpace(response))
            return false;

        var lowerResponse = response.ToLowerInvariant();
        return lowerResponse.Contains("you likely") ||
               lowerResponse.Contains("here's") ||
               lowerResponse.Contains("difference") ||
               lowerResponse.Contains("summary") ||
               lowerResponse.Contains("remember") ||
               lowerResponse.Contains("phrase") ||
               lowerResponse.Contains("example") ||
               (lowerResponse.Contains("stalactite") && lowerResponse.Contains("stalagmite"));
    }

    /// <summary>
    /// Extracts the translation from a verbose explanation response.
    /// </summary>
    private static string ExtractTranslationFromVerboseText(string verboseResponse)
    {
        if (string.IsNullOrWhiteSpace(verboseResponse))
            return string.Empty;

        var lines = verboseResponse.Split('\n');
        foreach (var line in lines)
        {
            var trimmedLine = line.Trim();
            if (trimmedLine.Contains('|') && !trimmedLine.Contains("Example:") && !trimmedLine.Contains("example:"))
            {
                return trimmedLine;
            }
        }

        foreach (var line in lines)
        {
            var trimmedLine = line.Trim();
            if (trimmedLine.StartsWith("*") || trimmedLine.StartsWith("-"))
            {
                trimmedLine = trimmedLine.TrimStart('*', '-', ' ').Trim();
                if (!trimmedLine.Contains("stalactite") && !trimmedLine.Contains("stalagmite") && 
                    !trimmedLine.Contains("ceiling") && !trimmedLine.Contains("ground") &&
                    !trimmedLine.ToLowerInvariant().Contains("you likely"))
                {
                    return $"{trimmedLine} | #noun #logic";
                }
            }
        }

        return string.Empty;
    }

    private const string DefaultPromptTemplate =
        "Translate '{text}' to Finnish. Return ONLY one line in this exact format: translation | hashtags\n"
        + "Where 'translation' is the Finnish translation (if multiple candidates, separate with '/') and 'hashtags' are 1-3 relevant category hashtags in English (e.g. #noun #verb #food). Example: dog | #noun #animal";

    /// <inheritdoc/>
    public string GetLlmModelName()
    {
        return _llmModel;
    }
}