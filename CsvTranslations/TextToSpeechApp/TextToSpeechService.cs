using System.Globalization;

using CliUtils;

using TranslationTools;

using Windows.Media.Core;
using Windows.Media.Playback;
using Windows.Media.SpeechSynthesis;

namespace TextToSpeechApp;

/// <summary>
///     Provides text-to-speech functionality using specified language voices.
/// </summary>
/// <summary>
///     Provides text-to-speech services for multiple languages and manages
///     associated synthesizers and media players.
/// </summary>
internal sealed class TextToSpeechService : IDisposable, ITextToSpeechService
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
    ///     Initializes a new instance of the <see cref="TextToSpeechService"/> class
    ///     using the supplied <see cref="VoiceLanguageList"/>.
    /// </summary>
    /// <param name="voiceLanguages">The collection of voice languages to initialize.</param>
    public TextToSpeechService(VoiceLanguageList voiceLanguages)
    {
        VoiceLanguages = voiceLanguages;

        var outputs = Initialize(voiceLanguages);
        foreach (var output in outputs)
        {
            if (output.StartsWith("WARNING:", StringComparison.OrdinalIgnoreCase))
            {
                ConsoleColorHelper.WriteWarning(output);
            }
            else if (output.StartsWith("ERROR:", StringComparison.OrdinalIgnoreCase))
            {
                ConsoleColorHelper.WriteError(output);
            }
            else
            {
                ConsoleColorHelper.WriteInfo(output);
            }
        }

        _rowEntries ??= [];
    }

    /// <summary>
    ///     Initializes a new instance of the <see cref="TextToSpeechService"/> class
    ///     using the supplied <see cref="VoiceLanguageList"/> and pre-populated rows.
    /// </summary>
    /// <param name="voiceLanguages">The collection of voice languages to initialize.</param>
    /// <param name="rowEntries">A list of <see cref="TextEntryRow"/> entries to use.</param>
    public TextToSpeechService(VoiceLanguageList voiceLanguages, List<TextEntryRow> rowEntries) : this(voiceLanguages)
    {
        _rowEntries = rowEntries;
    }

    /// <inheritdoc/>>
    public VoiceLanguageList VoiceLanguages { get; }

    /// <inheritdoc/>
    public Dictionary<string, SpeechSynthesizer> SpeechSynthesizers { get; } = new();

    /// <inheritdoc/>
    public Dictionary<string, MediaPlayer> MediaPlayers { get; } = new();

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
    public List<string> Initialize(VoiceLanguageList languageList)
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

        return output;
    }

    /// <summary>
    ///     Initializes a new instance of the TextToSpeechService class with the specified language.
    /// </summary>
    /// <param name="language">The language to use for speech synthesis (e.g., "en-US", "fi-FI")</param>
    /// <summary>
    ///     Creates and configures the speech synthesizer and media player for a single language.
    /// </summary>
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

    /// <inheritdoc/>
    public VoiceInformation? GetVoiceInformation(CultureInfo languageCulture)
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
    /// Get generic language.
    /// </summary>
    /// <param name="language">Example: en-GB</param>
    /// <param name="twoLetterIsoLanguageName">Example: en</param>
    /// <returns></returns>
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

    /// <summary>
    ///     Speaks the text contained in the supplied <see cref="TextEntry"/>.
    /// </summary>
    /// <param name="entry">The text entry to speak.</param>
    /// <returns>A task that completes when playback finishes.</returns>
    internal async Task SpeakEntryAsync(TextEntry entry)
    {
        var text = entry.Text;

        await SpeakTextAsync(text, entry.Language);
    }
}

public class InstalledVoice(string displayName, string twoLetterIsoLanguageName)
{
    public string DisplayName { get; set; } = displayName;
    public string TwoLetterIsoLanguageName { get; set; } = twoLetterIsoLanguageName;
}