using System.Text;

using CliUtils;

using Newtonsoft.Json;

using OllamaTranslatorApi.Models;
using OllamaTranslatorApi.Utilities;

using TranslationTools;

namespace OllamaTranslatorApi.Core;

public class OllamaTranslationService : ITranslationService
{
    private const string DefaultApiUrl = "http://localhost:11434/api/generate";

    /// <summary>
    /// Defines the URL endpoint for the Ollama API translation service. This constant string specifies the base URL to which translation requests will be sent. The URL is set to "http://localhost:11434/api/generate", indicating that the Ollama API is expected to be running locally on port 11434 and that the translation requests should be directed to the "/api/generate" endpoint. This constant can be modified if the API endpoint changes or if the service is hosted on a different server or port, allowing for easy configuration of the translation service without requiring changes to the core logic of the application.
    /// </summary>
    private readonly string _apiUrl = DefaultApiUrl;

    private const string DefaultModelName = "translategemma:12b";
    private readonly string _llmModel = DefaultModelName;

    public OllamaTranslationService(
      string apiUrl = DefaultApiUrl,
      string modelName = DefaultModelName,
      HttpClient? httpClient = null)
    {
        _apiUrl = apiUrl;
        _llmModel = modelName;
        _httpClient = httpClient ?? new HttpClient();
    }

    /// <summary>
    /// Initializes a new instance of the OllamaTranslationService class, which provides functionality to translate text using the Ollama API.
    /// The constructor accepts an optional HttpClient parameter, allowing for dependency injection of a custom HttpClient instance.
    /// If no HttpClient is provided, a new instance will be created internally. This design promotes flexibility and testability
    /// of the translation service, enabling it to be easily integrated into various applications and testing scenarios without being
    /// tightly coupled to a specific HttpClient implementation.
    /// </summary>
    private readonly HttpClient _httpClient;

    /// <inheritdoc />
    public async Task<TranslationResponse> TranslateAsync(TranslationRequest request)
    {
        var textTrimmed = request.Text.Trim().Trim('"').Replace("\"", "`");

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
            var translatedText = parts[0].Trim();
            var hashtags = parts.Length > 1 ? parts[1].Trim() : string.Empty;

            return new TranslationResponse(translatedText, hashtags);
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