namespace TextToSpeechApp;

/// <summary>
///     Configuration read from <c>settings.json</c> that selects and configures
///     the text-to-speech provider used by <see cref="Program"/>.
/// </summary>
internal sealed class TtsSettings
{
    /// <summary>
    ///     The text-to-speech provider to use: <c>"Windows"</c> (default) or <c>"Piper"</c>.
    /// </summary>
    public string TtsProvider { get; set; } = "Windows";

    /// <summary>
    ///     Maps a <see cref="TranslationTools.VoiceLanguage.LanguageName"/> to a PiperSharp
    ///     HuggingFace voice model key (e.g. <c>"English"</c> -&gt; <c>"en_US-lessac-medium"</c>).
    ///     Only used when <see cref="TtsProvider"/> is <c>"Piper"</c>.
    /// </summary>
    public Dictionary<string, string> PiperVoices { get; set; } = new();
}
