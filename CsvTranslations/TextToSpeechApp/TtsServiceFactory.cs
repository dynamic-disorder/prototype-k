using CliUtils;

using TextToSpeechCore;

using TranslationTools;

namespace TextToSpeechApp;

/// <summary>
///     Constructs the configured <see cref="ITextToSpeechService"/> implementation
///     based on the active provider in <see cref="TtsSettings"/>.
/// </summary>
internal static class TtsServiceFactory
{
    /// <summary>
    ///     Creates the text-to-speech service selected by <paramref name="settings"/>.
    ///     The active provider is identified by <see cref="TtsSettings.TtsProvider"/>.
    /// </summary>
    /// <param name="settings">The loaded TTS settings.</param>
    /// <param name="voiceLanguages">The collection of voice languages to initialize.</param>
    /// <param name="rowEntries">A list of <see cref="TextEntryRow"/> entries to use.</param>
    public static ITextToSpeechService Create(TtsSettings settings, VoiceLanguageList voiceLanguages, List<TextEntryRow> rowEntries)
    {
        // Resolve the active provider configuration
        if (!settings.TtsProviders.TryGetValue(settings.TtsProvider, out var config))
        {
            ConsoleColorHelper.WriteWarning($"TTS provider '{settings.TtsProvider}' not found in settings. Falling back to Windows.");
            return new WindowsTextToSpeechService(voiceLanguages, rowEntries);
        }

        // The dictionary key is the provider name — check if it's "Piper"
        if (settings.TtsProvider.Equals("Piper", StringComparison.OrdinalIgnoreCase))
        {
            return new PiperTextToSpeechService(voiceLanguages, config.PiperVoices, rowEntries);
        }

        return new WindowsTextToSpeechService(voiceLanguages, rowEntries);
    }
}