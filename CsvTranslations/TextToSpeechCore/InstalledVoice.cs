namespace TextToSpeechCore;

/// <summary>
///     Represents a speech voice installed or available on the current text-to-speech provider.
/// </summary>
/// <param name="displayName">The human-readable name of the voice.</param>
/// <param name="twoLetterIsoLanguageName">The two-letter ISO language code the voice speaks.</param>
public class InstalledVoice(string displayName, string twoLetterIsoLanguageName)
{
    /// <summary>
    ///     Gets or sets the human-readable name of the voice.
    /// </summary>
    public string DisplayName { get; set; } = displayName;

    /// <summary>
    ///     Gets or sets the two-letter ISO language code the voice speaks.
    /// </summary>
    public string TwoLetterIsoLanguageName { get; set; } = twoLetterIsoLanguageName;
}
