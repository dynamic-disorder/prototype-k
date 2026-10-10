using Shouldly;

using TranslationTools;

namespace TextToSpeechCore.Tests;

/// <summary>
///     Tests for <see cref="PiperTextToSpeechService" /> covering the behaviour reachable without
///     downloading the Piper engine or a voice model.
/// </summary>
/// <remarks>
///     <para>
///         The service only reaches the injected <see cref="IAudioPlayback" /> after a provider has
///         been created by <see cref="PiperTextToSpeechService.InitializeAsync" />, which downloads
///         the Piper executable and models. That makes the *positive* playback path (synthesized
///         WAV reaches playback) untestable here without a network and a provider seam.
///     </para>
///     <para>
///         What <see cref="FakeAudioPlayback" /> does buy is observability of the guards: every
///         "nothing to speak" path can now be asserted to leave playback untouched, instead of
///         relying on the absence of an audible sound from a real audio device.
///     </para>
/// </remarks>
public sealed class PiperTextToSpeechServiceTests
{
    private static readonly VoiceLanguage English = new("English", LanguageTypes.Source);
    private static readonly VoiceLanguage Finnish = new("Finnish", LanguageTypes.Target);

    private readonly FakeAudioPlayback _playback = new();

    // --------------------------------------------------------------- construction / properties

    [Fact]
    public void Constructor_ExposesConfiguredVoiceLanguages()
    {
        // Given: a language list
        var languages = new VoiceLanguageList { English, Finnish };

        // When: constructing the service
        using var sut = Create(languages);

        // Then: the same list is exposed unchanged
        sut.VoiceLanguages.ShouldBeSameAs(languages);
        sut.VoiceLanguages.Count.ShouldBe(2);
    }

    [Fact]
    public void Constructor_WithoutRowEntries_IsAccepted()
    {
        // Given/When: constructing without the optional row entries
        var exception = Record.Exception(() =>
        {
            using var sut = Create(voices: Voices(("English", "en_GB", "northern_english_male", "medium")));
        });

        // Then: no exception
        exception.ShouldBeNull();
    }

    // ------------------------------------------------------------------------ SpeakTextAsync

    [Fact]
    public async Task SpeakTextAsync_NullText_DoesNotPlay()
    {
        using var sut = Create();

        await sut.SpeakTextAsync(null!);

        _playback.CallCount.ShouldBe(0);
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("\t")]
    [InlineData("\r\n")]
    [InlineData("   \t  ")]
    public async Task SpeakTextAsync_BlankText_DoesNotPlay(string text)
    {
        using var sut = Create();

        await sut.SpeakTextAsync(text);

        _playback.CallCount.ShouldBe(0);
    }

    [Fact]
    public async Task SpeakTextAsync_TextButNoInitializedProvider_DoesNotPlay()
    {
        // Given: a voice is configured, but InitializeAsync has not run so no provider exists
        using var sut = Create(voices: Voices(("English", "en_GB", "northern_english_male", "medium")));

        // When: speaking real text
        await sut.SpeakTextAsync("hello", English);

        // Then: nothing is played -- configuration alone is not enough to synthesise audio
        _playback.CallCount.ShouldBe(0);
    }

    [Fact]
    public async Task SpeakTextAsync_ExplicitLanguageWithoutConfiguredProvider_DoesNotPlay()
    {
        // Given: a language that has no configured Piper voice at all
        using var sut = Create(voices: Voices(("English", "en_GB", "northern_english_male", "medium")));
        var vietnamese = new VoiceLanguage("Vietnamese", LanguageTypes.Target);

        // When: speaking in that language
        await sut.SpeakTextAsync("xin chào", vietnamese);

        // Then: nothing is played and no exception is thrown
        _playback.CallCount.ShouldBe(0);
    }

    [Fact]
    public async Task SpeakTextAsync_DefaultVoice_DoesNotPlayWhenNoProviderExists()
    {
        // Given: no language override, so the default voice is used
        using var sut = Create();

        // When: speaking without an explicit language
        await sut.SpeakTextAsync("hello");

        // Then: nothing is played
        _playback.CallCount.ShouldBe(0);
    }

    // ----------------------------------------------------------------------- SpeakEntryAsync

    [Fact]
    public async Task SpeakEntryAsync_EntryWithEmptyText_DoesNotPlay()
    {
        using var sut = Create();
        var entry = new TextEntry { Language = English, Text = string.Empty };

        await sut.SpeakEntryAsync(entry);

        _playback.CallCount.ShouldBe(0);
    }

    [Fact]
    public async Task SpeakEntryAsync_EntryWhoseLanguageHasNoProvider_DoesNotPlay()
    {
        // Given: an entry in a language with no initialised provider
        using var sut = Create(voices: Voices(("English", "en_GB", "northern_english_male", "medium")));
        var entry = new TextEntry { Language = Finnish, Text = "vatsa" };

        // When: speaking the entry
        await sut.SpeakEntryAsync(entry);

        // Then: nothing is played
        _playback.CallCount.ShouldBe(0);
    }

    // --------------------------------------------------------------------- ListInstalledVoices

    [Fact]
    public void ListInstalledVoices_ReturnsOneVoicePerConfiguredLanguage()
    {
        // Given: two configured voices
        using var sut = Create(voices: Voices(
            ("English", "en_GB", "northern_english_male", "medium"),
            ("Finnish", "fi_FI", "harri", "medium")));

        // When: listing them
        List<InstalledVoice> voices = sut.ListInstalledVoices();

        // Then: each configured language is reported once
        voices.Count.ShouldBe(2);
        voices.ShouldContain(v => v.DisplayName == "en_GB-northern_english_male-medium" && v.TwoLetterIsoLanguageName == "English");
        voices.ShouldContain(v => v.DisplayName == "fi_FI-harri-medium" && v.TwoLetterIsoLanguageName == "Finnish");
    }

    [Fact]
    public void ListInstalledVoices_NoConfiguredVoices_ReturnsEmpty()
    {
        using var sut = Create();

        sut.ListInstalledVoices().ShouldBeEmpty();
    }

    [Fact]
    public void ListInstalledVoices_DoesNotDependOnInitialization()
    {
        // Given: a configured voice and a service that has never been initialized
        using var sut = Create(voices: Voices(("Vietnamese", "vi_VN", "vivos", "x_low")));

        // When: listing voices
        List<InstalledVoice> voices = sut.ListInstalledVoices();

        // Then: the configured voice is still reported (it describes configuration, not downloads)
        voices.ShouldHaveSingleItem().DisplayName.ShouldBe("vi_VN-vivos-x_low");
    }

    // --------------------------------------------------------------------------------- Dispose

    [Fact]
    public void Dispose_IsIdempotent()
    {
        var sut = Create();

        Should.NotThrow(() =>
        {
            sut.Dispose();
            sut.Dispose();
        });
    }

    [Fact]
    public async Task Dispose_ThenSpeak_DoesNotPlay()
    {
        using var sut = Create(voices: Voices(("English", "en_GB", "northern_english_male", "medium")));

        sut.Dispose();

        await sut.SpeakTextAsync("hello", English);

        _playback.CallCount.ShouldBe(0);
    }

    // --------------------------------------------------------------------------------- helpers

    private PiperTextToSpeechService Create(
        VoiceLanguageList? languages = null,
        Dictionary<string, PiperVoiceConfig>? voices = null)
        => new(languages ?? new VoiceLanguageList { English, Finnish }, voices ?? [], _playback);

    private static Dictionary<string, PiperVoiceConfig> Voices(
        params (string Language, string LanguageCode, string ModelCard, string ModelQuality)[] entries)
        => entries.ToDictionary(
            e => e.Language,
            e => new PiperVoiceConfig
            {
                LanguageCode = e.LanguageCode,
                ModelCard = e.ModelCard,
                ModelQuality = e.ModelQuality
            });
}
