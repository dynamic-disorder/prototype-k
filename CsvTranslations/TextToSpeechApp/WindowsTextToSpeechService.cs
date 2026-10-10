using System.Globalization;

using TextToSpeechCore;

using TranslationTools;

using Windows.Media.Core;
using Windows.Media.Playback;
using Windows.Media.SpeechSynthesis;

namespace TextToSpeechApp;

/// <summary>
///     Provides text-to-speech services for multiple languages using the Windows
///     <see cref="SpeechSynthesizer"/>/<see cref="MediaPlayer"/> APIs, and manages
///     the associated synthesizers and media players.
/// </summary>
internal sealed class WindowsTextToSpeechService : IDisposable, ITextToSpeechService
{
    private static string CreateFullWidthSeparator()
    {
        int width = Math.Min(Console.WindowWidth, 80);
        return new string('═', width);
    }

    private static string CreateThinSeparator()
    {
        int width = Math.Min(Console.WindowWidth, 80);
        return new string('─', width);
    }

    private readonly List<TextEntryRow> _rowEntries;

    /// <summary>
    ///     Initializes a new instance of the <see cref="WindowsTextToSpeechService"/> class
    ///     using the supplied <see cref="VoiceLanguageList"/>.
    /// </summary>
    /// <param name="voiceLanguages">The collection of voice languages to initialize.</param>
    public WindowsTextToSpeechService(VoiceLanguageList voiceLanguages)
    {
        VoiceLanguages = voiceLanguages;
        _rowEntries = [];
    }

    /// <summary>
    ///     Initializes a new instance of the <see cref="WindowsTextToSpeechService"/> class
    ///     using the supplied <see cref="VoiceLanguageList"/> and pre-populated rows.
    /// </summary>
    /// <param name="voiceLanguages">The collection of voice languages to initialize.</param>
    /// <param name="rowEntries">A list of <see cref="TextEntryRow"/> entries to use.</param>
    public WindowsTextToSpeechService(VoiceLanguageList voiceLanguages, List<TextEntryRow> rowEntries) : this(voiceLanguages)
    {
        _rowEntries = rowEntries;
    }

    /// <inheritdoc/>
    public VoiceLanguageList VoiceLanguages { get; }

    // Removed rowEntries parameter from WindowsTextToSpeechService signature
    // to match TextToSpeechCore interface requirements.

    private Dictionary<string, SpeechSynthesizer> SpeechSynthesizers { get; } = new();

    private Dictionary<string, MediaPlayer> MediaPlayers { get; } = new();

    /// <inheritdoc cref="IDisposable.Dispose" />
    public void Dispose()
    {
        foreach (KeyValuePair<string, SpeechSynthesizer> entry in SpeechSynthesizers)
        {
            entry.Value.Dispose();
        }

        foreach (KeyValuePair<string, MediaPlayer> entry in MediaPlayers)
        {
            entry.Value.Dispose();
        }

        GC.SuppressFinalize(this);
    }

    /// <inheritdoc/>
    public Task<List<string>> InitializeAsync(VoiceLanguageList languageList)
    {
        var output = new List<string>();
        List<InstalledVoice> installedVoices = ListInstalledVoices();

        output.Add("");
        output.Add(CreateFullWidthSeparator());
        output.Add("AVAILABLE VOICES INSTALLED FOR RECITING THE TRANSLATIONS OR TEXTS");
        output.Add(CreateThinSeparator());

        foreach (InstalledVoice voice in installedVoices)
        {
            output.Add($"  • {voice.DisplayName} ({voice.TwoLetterIsoLanguageName})");
        }

        output.Add("");
        output.Add(CreateFullWidthSeparator());
        output.Add("THE LANGUAGES USED FOR RECITING");
        output.Add(CreateThinSeparator());

        foreach (VoiceLanguage language in languageList)
        {
            List<string> outputs = InitializeVoiceLanguage(language);
            output.AddRange(outputs);
        }

        // ReSharper disable once InvertIf
        if (SpeechSynthesizers.Count == 0 || MediaPlayers.Count == 0)
        {
            List<string> outputs = InitializeVoiceLanguage(VoiceLanguage.System);
            output.AddRange(outputs);
        }

        return Task.FromResult(output);
    }

    /// <summary>
    ///     Creates and configures the speech synthesizer and media player for a single language.
    /// </summary>
    /// <param name="language">The language to use for speech synthesis.</param>
    private List<string> InitializeVoiceLanguage(VoiceLanguage language)
    {
        var output = new List<string>();
        var synth = new SpeechSynthesizer();
        SpeechSynthesizers[language.LanguageName] = synth;

        var player = new MediaPlayer();
        MediaPlayers[language.LanguageName] = player;

        VoiceInformation? defaultVoice = SpeechSynthesizer.DefaultVoice;

        VoiceInformation? voice = GetVoiceInformation(language.LanguageCulture);

        if (voice != null)
        {
            if (voice.Language[..2] == defaultVoice.Language[..2] && voice != defaultVoice)
            {
                voice = defaultVoice;
            }

            synth.Voice = voice;

            output.Add($"  • Using voice: {voice.DisplayName} for language: {language.LanguageName[..2]}");
        }
        else
        {
            output.Add($"  WARNING: No installed voice found for language '{language.LanguageName}' ({language.LanguageCulture.TwoLetterISOLanguageName}). Using the default voice may speak this language with English pronunciation.");
            output.Add("     Install the correct language voice in Windows Settings → Time & Language → Speech, then rerun TextToSpeechApp.");
        }

        return output;
    }

    /// <inheritdoc/>
    public List<InstalledVoice> ListInstalledVoices()
    {
        var installedVoices = new List<InstalledVoice>();
        foreach (VoiceInformation? v in SpeechSynthesizer.AllVoices)
        {
            var displayName = v.DisplayName;
            var twoLetterIsoLanguageName = v.Language[..2];

            installedVoices.Add(new InstalledVoice(displayName, twoLetterIsoLanguageName));
        }

        return installedVoices;
    }

    /// <summary>
    ///     Finds the installed Windows voice best matching the supplied language culture.
    /// </summary>
    /// <param name="languageCulture">Example: en-GB</param>
    private static VoiceInformation? GetVoiceInformation(CultureInfo languageCulture)
    {
        // Select voice by language tag (e.g., "en-US", "fi-FI")
        var twoLetterIsoLanguageName = languageCulture.TwoLetterISOLanguageName;
        IReadOnlyList<VoiceInformation> allVoices = SpeechSynthesizer.AllVoices;
        VoiceInformation? voice = null;

        foreach (VoiceInformation? v in allVoices)
        {
            if (!GenericLanguageMatch(v.Language, twoLetterIsoLanguageName))
            {
                continue;
            }

            voice = v;
            break;
        }

        return voice;
    }

    /// <summary>
    ///     Get generic language.
    /// </summary>
    /// <param name="language">Example: en-GB</param>
    /// <param name="twoLetterIsoLanguageName">Example: en</param>
    private static bool GenericLanguageMatch(string language, string twoLetterIsoLanguageName)
    {
        var isMatch = language.StartsWith(twoLetterIsoLanguageName, StringComparison.OrdinalIgnoreCase);
        return isMatch;
    }

    /// <inheritdoc/>
    public async Task SpeakTextAsync(string text, VoiceLanguage? voiceLanguage = null)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return;
        }

        VoiceLanguage useVoice = voiceLanguage ?? VoiceLanguages.DefaultVoice;

        SpeechSynthesisStream? stream = await SpeechSynthesizers[useVoice.LanguageName].SynthesizeTextToStreamAsync(text);
        MediaPlayers[useVoice.LanguageName].Source = MediaSource.CreateFromStream(stream, stream.ContentType);

        // Use TaskCompletionSource to await media end.
        var tsc = new TaskCompletionSource<bool>();
        MediaPlayers[useVoice.LanguageName].MediaEnded += (_, _) => { tsc.TrySetResult(true); };
        MediaPlayers[useVoice.LanguageName].Play();

        // Wait for a speech synthesis to complete.
        await tsc.Task;
    }

    /// <inheritdoc/>
    public async Task SpeakEntryAsync(TextEntry entry)
    {
        var text = entry.Text;

        await SpeakTextAsync(text, entry.Language);
    }
}
