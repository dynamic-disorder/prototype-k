using TextToSpeechCore;

using TranslationTools;

namespace TextToSpeechApp;

/// <summary>
///     Constructs the configured <see cref="ITextToSpeechService"/> implementation based on the
///     active provider in <see cref="TtsSettings"/>.
/// </summary>
/// <remarks>
///     Piper is the only provider, so this factory is mostly a guard: it turns a settings file that
///     names a provider this app cannot run into a message instead of a failure deeper in the app.
/// </remarks>
internal static class TtsServiceFactory
{
    /// <summary>
    ///     Creates the text-to-speech service selected by <paramref name="settings"/>.
    ///     The active provider is identified by <see cref="TtsSettings.TtsProvider"/>, which
    ///     <see cref="TtsProviderSelection"/> has already resolved to one this app can run.
    /// </summary>
    /// <param name="settings">The loaded TTS settings.</param>
    /// <param name="voiceLanguages">The collection of voice languages to initialize.</param>
    /// <param name="rowEntries">A list of <see cref="TextEntryRow"/> entries to use.</param>
    /// <exception cref="PlatformNotSupportedException">
    ///     The settings select a provider this app does not have, or the Piper provider has no
    ///     configuration to initialize from.
    /// </exception>
    public static ITextToSpeechService Create(TtsSettings settings, VoiceLanguageList voiceLanguages, List<TextEntryRow> rowEntries)
    {
        if (!settings.TtsProvider.Equals(TtsProviderSelection.PiperProvider, StringComparison.OrdinalIgnoreCase))
        {
            throw new PlatformNotSupportedException(
                $"TTS provider '{settings.TtsProvider}' is not available; '{TtsProviderSelection.PiperProvider}' is the only provider.");
        }

        if (!settings.TtsProviders.TryGetValue(TtsProviderSelection.PiperProvider, out var config))
        {
            throw new PlatformNotSupportedException(
                $"TTS provider '{TtsProviderSelection.PiperProvider}' has no configuration in settings.json. "
                + "Add a \"Piper\" entry with PiperVoices for the languages in the CSV.");
        }

        var initializationOptions = new PiperInitializationOptions
        {
            AssetRootDirectory = config.PiperCache.Directory,
            CacheTtlDays = config.PiperCache.CacheTtlDays
        };

        // Playback is the only OS-specific half of Piper synthesis, so it is chosen for this machine.
        return new PiperTextToSpeechService(
            voiceLanguages,
            config.PiperVoices,
            ProcessWavPlayback.Create(),
            rowEntries,
            initializationOptions);
    }
}
