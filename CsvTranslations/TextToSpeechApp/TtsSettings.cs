using System.Globalization;

using TextToSpeechCore;

namespace TextToSpeechApp;

/// <summary>
///     A named profile containing voice configuration for a TTS provider.
///     The provider name is the dictionary key, not a field here.
/// </summary>
internal sealed class TtsProviderConfig
{
    /// <summary>
    ///     Maps a <see cref="TranslationTools.VoiceLanguage.LanguageName"/> to a detailed
    ///     <see cref="PiperVoiceConfig"/> for the corresponding Piper voice. Only used when
    ///     the provider is <c>"Piper"</c>.
    /// </summary>
    public Dictionary<string, PiperVoiceConfig> PiperVoices { get; set; } = new();

    /// <summary>
    ///     Informational comment describing the provider configuration.
    ///     Not used by the application logic.
    /// </summary>
    public string? Comment { get; set; }
}

/// <summary>
///     Configuration read from <c>settings.json</c> that selects and configures
///     the text-to-speech provider used by <see cref="Program"/>.
/// </summary>
internal sealed class TtsSettings
{
    /// <summary>
    ///     The name of the active TTS provider to use from <see cref="TtsProviders"/>.
    ///     Valid values: <c>"Windows"</c> or <c>"Piper"</c>.
    /// </summary>
    public string TtsProvider { get; set; } = "Windows";

    /// <summary>
    ///     A dictionary of named TTS provider configurations. Each provider's
    ///     key (e.g. <c>"Windows"</c>, <c>"Piper"</c>) is the identifier used by
    ///     <see cref="TtsProvider"/>.
    /// </summary>
    public Dictionary<string, TtsProviderConfig> TtsProviders { get; set; } = new();

    /// <summary>
    ///     Attempts to parse a command-line argument as a TTS provider override
    ///     (<c>--tts:Value</c> or <c>-tts:Value</c>, case-insensitive).
    /// </summary>
    /// <param name="arg">The command-line argument to parse.</param>
    /// <param name="provider">
    ///     When this method returns <c>true</c>, contains the normalised provider name
    ///     (<c>"Windows"</c> or <c>"Piper"</c>), title-cased.
    ///     When this method returns <c>false</c>, <c>null</c>.
    /// </param>
    /// <returns>
    ///     <c>true</c> if <paramref name="arg"/> is a recognised TTS argument
    ///     with a valid provider name; otherwise <c>false</c>.
    /// </returns>
    public static bool TryParseTtsArg(string arg, out string? provider)
    {
        provider = null;

        const string prefixLong = "--tts:";
        const string prefixShort = "-tts:";

        string? rawValue = null;
        if (arg.StartsWith(prefixLong, StringComparison.OrdinalIgnoreCase))
        {
            rawValue = arg[prefixLong.Length..];
        }
        else if (arg.StartsWith(prefixShort, StringComparison.OrdinalIgnoreCase))
        {
            rawValue = arg[prefixShort.Length..];
        }

        if (rawValue == null)
        {
            return false;
        }

        // Normalise to title case for a clean settings value
        var normalised = rawValue.Length switch
        {
            0 => null,
            _ => char.ToUpper(rawValue[0], CultureInfo.InvariantCulture) + rawValue[1..].ToLower(CultureInfo.InvariantCulture)
        };

        if (normalised is "Windows" or "Piper")
        {
            provider = normalised;
            return true;
        }

        return true; // Recognised as a TTS arg but value was unknown
    }
}