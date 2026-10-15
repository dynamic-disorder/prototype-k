namespace TranslationTools;

/// <summary>
/// Represents the result of extracting source and target languages from CSV header columns.
/// </summary>
public class LanguageExtractionResult
{
    /// <summary>
    /// Gets the source languages extracted from the header.
    /// </summary>
    public string[] SourceLanguages { get; }

    /// <summary>
    /// Gets the target languages extracted from the header.
    /// </summary>
    public string[] TargetLanguages { get; }

    /// <summary>
    /// Initializes a new instance of the <see cref="LanguageExtractionResult"/> class.
    /// </summary>
    /// <param name="sourceLanguages">The source languages.</param>
    /// <param name="targetLanguages">The target languages.</param>
    public LanguageExtractionResult(string[] sourceLanguages, string[] targetLanguages)
    {
        SourceLanguages = sourceLanguages;
        TargetLanguages = targetLanguages;
    }
}