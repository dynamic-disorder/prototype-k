using TextToSpeechCore;

using TranslationTools;

namespace TextToSpeechApp;

/// <summary>
///     Constructs the configured <see cref="ITextToSpeechService"/> implementation
///     based on <see cref="TtsSettings.TtsProvider"/>.
/// </summary>
internal static class TtsServiceFactory
{
    /// <summary>
    ///     Creates the text-to-speech service selected by <paramref name="settings"/>.
    /// </summary>
    /// <param name="settings">The loaded TTS settings.</param>
    /// <param name="voiceLanguages">The collection of voice languages to initialize.</param>
    /// <param name="rowEntries">A list of <see cref="TextEntryRow"/> entries to use.</param>
    public static ITextToSpeechService Create(TtsSettings settings, VoiceLanguageList voiceLanguages, List<TextEntryRow> rowEntries)
    {
        if (settings.TtsProvider.Equals("Piper", StringComparison.OrdinalIgnoreCase))
        {
            return new PiperTextToSpeechService(voiceLanguages, settings.PiperVoices, rowEntries);
        }

        return new WindowsTextToSpeechService(voiceLanguages, rowEntries);
    }
}
