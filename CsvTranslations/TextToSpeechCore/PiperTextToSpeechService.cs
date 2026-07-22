using NAudio.Wave;

using PiperSharp;
using PiperSharp.Models;

using TranslationTools;

using VoiceLanguage = TranslationTools.VoiceLanguage;

namespace TextToSpeechCore;

/// <summary>
///     A cross-platform-capable <see cref="ITextToSpeechService"/> implementation backed by the
///     Piper neural TTS engine via the PiperSharp package. Downloads the Piper executable and any
///     configured voice models on first use, caching them locally per PiperSharp's own conventions.
///     Playback relies on NAudio's <see cref="WaveOutEvent"/>, which is Windows-only at runtime.
/// </summary>
public sealed class PiperTextToSpeechService : IDisposable, ITextToSpeechService
{
    private readonly Dictionary<string, PiperProvider> _providers = new();
    private readonly IReadOnlyDictionary<string, string> _voiceKeysByLanguageName;
    private readonly List<TextEntryRow>? _rowEntries;

    /// <summary>
    ///     Initializes a new instance of <see cref="PiperTextToSpeechService"/>.
    /// </summary>
    /// <param name="voiceLanguages">The configured voice languages and defaults used by this service.</param>
    /// <param name="voiceKeysByLanguageName">Maps <see cref="VoiceLanguage.LanguageName"/> to a PiperSharp HuggingFace voice model key.</param>
    /// <param name="rowEntries">The translation entry rows this service may be asked to speak.</param>
    public PiperTextToSpeechService(
        VoiceLanguageList voiceLanguages,
        IReadOnlyDictionary<string, string> voiceKeysByLanguageName,
        List<TextEntryRow>? rowEntries = null)
    {
        VoiceLanguages = voiceLanguages;
        _voiceKeysByLanguageName = voiceKeysByLanguageName;
        _rowEntries = rowEntries;
    }

    /// <summary>
    ///     The configured voice languages and defaults used by this service.
    /// </summary>
    public VoiceLanguageList VoiceLanguages { get; }

    /// <summary>
    ///     Ensures the Piper executable is present and loads/downloads a voice model for each
    ///     language in <paramref name="languageList"/> that has a configured Piper voice key.
    /// </summary>
    /// <param name="languageList">The list of languages to initialize.</param>
    public async Task<List<string>> InitializeAsync(VoiceLanguageList languageList)
    {
        var output = new List<string>();

        if (!File.Exists(PiperDownloader.DefaultPiperExecutableLocation))
        {
            output.Add("Downloading the Piper TTS engine...");
            await PiperDownloader.DownloadPiper().ExtractPiper();
        }

        foreach (VoiceLanguage language in languageList)
        {
            List<string> outputs = await InitializeVoiceLanguage(language);
            output.AddRange(outputs);
        }

        return output;
    }

    private async Task<List<string>> InitializeVoiceLanguage(VoiceLanguage language)
    {
        var output = new List<string>();

        if (!_voiceKeysByLanguageName.TryGetValue(language.LanguageName, out var modelKey))
        {
            output.Add($"  WARNING: No Piper voice configured for language '{language.LanguageName}'. Add a PiperVoices entry in settings.json to enable this language.");
            return output;
        }

        // PiperSharp's downloader already skips re-fetching files that exist on disk, so it is
        // safe to call this on every startup rather than tracking local cache state ourselves.
        VoiceModel model = await PiperDownloader.DownloadModelByKey(modelKey);

        var provider = new PiperProvider(new PiperConfiguration
        {
            ExecutableLocation = PiperDownloader.DefaultPiperExecutableLocation,
            WorkingDirectory = PiperDownloader.DefaultPiperLocation,
            Model = model,
        });

        _providers[language.LanguageName] = provider;

        output.Add($"  • Using Piper voice: {modelKey} for language: {language.LanguageName}");

        return output;
    }

    /// <summary>
    ///     List the Piper voices configured for this service via the language-to-model-key mapping
    ///     passed to the constructor.
    /// </summary>
    public List<InstalledVoice> ListInstalledVoices()
    {
        var installedVoices = new List<InstalledVoice>();

        foreach (KeyValuePair<string, string> entry in _voiceKeysByLanguageName)
        {
            installedVoices.Add(new InstalledVoice(entry.Value, entry.Key));
        }

        return installedVoices;
    }

    /// <summary>
    ///     Synthesizes <paramref name="text"/> via Piper and plays the resulting WAV audio,
    ///     awaiting until playback finishes.
    /// </summary>
    /// <param name="text">The text to speak.</param>
    /// <param name="voiceLanguage">Optional language override to use for this utterance.</param>
    public async Task SpeakTextAsync(string text, VoiceLanguage? voiceLanguage = null)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return;
        }

        VoiceLanguage useVoice = voiceLanguage ?? VoiceLanguages.DefaultVoice;

        if (!_providers.TryGetValue(useVoice.LanguageName, out PiperProvider? provider))
        {
            return;
        }

        byte[] wav = await provider.InferAsync(text, AudioOutputType.Wav);

        using var stream = new MemoryStream(wav);
        using var reader = new WaveFileReader(stream);
        using var output = new WaveOutEvent();
        var playbackFinished = new TaskCompletionSource<bool>();

        output.PlaybackStopped += (_, _) => { playbackFinished.TrySetResult(true); };
        output.Init(reader);
        output.Play();

        await playbackFinished.Task;
    }

    /// <summary>
    ///     Synthesizes and plays the supplied translation entry using its own language.
    /// </summary>
    /// <param name="entry">The entry to speak.</param>
    public async Task SpeakEntryAsync(TextEntry entry)
    {
        await SpeakTextAsync(entry.Text, entry.Language);
    }

    /// <summary>
    ///     Releases the cached Piper providers. PiperSharp spawns a piper process per
    ///     <see cref="PiperProvider.InferAsync"/> call rather than holding one open, so there are
    ///     no unmanaged handles to release here beyond clearing the cache.
    /// </summary>
    public void Dispose()
    {
        _providers.Clear();
        GC.SuppressFinalize(this);
    }
}
