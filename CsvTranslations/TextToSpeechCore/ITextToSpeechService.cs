using TranslationTools;

namespace TextToSpeechCore;

/// <summary>
///     Platform-neutral contract for a text-to-speech provider capable of speaking
///     translation entries in one of several configured <see cref="VoiceLanguage"/>s.
/// </summary>
public interface ITextToSpeechService : IDisposable
{
    /// <summary>
    ///     The configured voice languages and defaults used by this service.
    /// </summary>
    VoiceLanguageList VoiceLanguages { get; }

    /// <summary>
    ///     Initializes the underlying speech engine for each language in the provided list.
    /// </summary>
    /// <param name="languageList">The list of languages to initialize.</param>
    /// <returns>A task producing human-readable initialization log lines (info/warning/error).</returns>
    Task<List<string>> InitializeAsync(VoiceLanguageList languageList);

    /// <summary>
    ///     List all voices available to this provider.
    /// </summary>
    List<InstalledVoice> ListInstalledVoices();

    /// <summary>
    ///     Synthesizes and plays the supplied <paramref name="text"/> asynchronously
    ///     using the specified <paramref name="voiceLanguage"/>, or the default voice.
    /// </summary>
    /// <param name="text">The text to speak.</param>
    /// <param name="voiceLanguage">Optional language override to use for this utterance.</param>
    /// <returns>A task that completes when playback finishes.</returns>
    Task SpeakTextAsync(string text, VoiceLanguage? voiceLanguage = null);

    /// <summary>
    ///     Synthesizes and plays the supplied translation entry using its own language.
    /// </summary>
    /// <param name="entry">The entry to speak.</param>
    /// <returns>A task that completes when playback finishes.</returns>
    Task SpeakEntryAsync(TextEntry entry);
}
