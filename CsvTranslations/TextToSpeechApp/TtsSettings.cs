namespace TextToSpeechApp;

/// <summary>
///     A named profile containing voice configuration for a TTS provider.
///     The provider name is the dictionary key, not a field here.
/// </summary>
internal sealed class TtsProviderConfig
{
    /// <summary>
    ///     Maps a <see cref="TranslationTools.VoiceLanguage.LanguageName"/> to a PiperSharp
    ///     HuggingFace voice model key (e.g. <c>"English"</c> -> <c>"en_US-lessac-medium"</c>).
    ///     Only used when the provider is <c>"Piper"</c>.
    /// </summary>
    public Dictionary<string, string> PiperVoices { get; set; } = new();
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
}