using System.Globalization;

using TranslationTools;

using Windows.Media.Playback;
using Windows.Media.SpeechSynthesis;

namespace TextToSpeechApp;

internal interface ITextToSpeechService
{
    /// <summary>
    ///     The configured voice languages and defaults used by this service.
    /// </summary>
    VoiceLanguageList VoiceLanguages { get; }

    /// <summary>
    ///     Mapping of language name to its <see cref="SpeechSynthesizer"/> instance.
    /// </summary>
    Dictionary<string, SpeechSynthesizer> SpeechSynthesizers { get; }

    /// <summary>
    ///     Mapping of language name to its <see cref="MediaPlayer"/> instance.
    /// </summary>
    Dictionary<string, MediaPlayer> MediaPlayers { get; }

    /// <summary>
    ///     Initializes synthesizers and players for each language in the provided list.
    /// </summary>
    /// <param name="languageList">The list of languages to initialize.</param>
    List<string> Initialize(VoiceLanguageList languageList);

    /// <summary>
    /// List all installed voices.
    /// </summary>
    List<InstalledVoice> ListInstalledVoices();

    /// <summary>
    /// Get <see cref="VoiceInformation"/>.
    /// </summary>
    /// <param name="languageCulture"><see cref="CultureInfo"/></param>
    /// <returns></returns>
    VoiceInformation? GetVoiceInformation(CultureInfo languageCulture);

    /// <summary>
    ///     Synthesizes and plays the supplied <paramref name="text"/> asynchronously
    ///     using the specified <paramref name="voiceLanguage"/>, or the default voice.
    /// </summary>
    /// <param name="text">The text to speak.</param>
    /// <param name="voiceLanguage">Optional language override to use for this utterance.</param>
    /// <returns>A task that completes when playback finishes.</returns>
    Task SpeakTextAsync(string text, VoiceLanguage? voiceLanguage = null);
}