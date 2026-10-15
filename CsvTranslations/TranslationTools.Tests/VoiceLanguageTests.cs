using System.Globalization;

using Shouldly;

using TranslationTools;

namespace TranslationTools.Tests;

/// <summary>
///     Tests for <see cref="VoiceLanguage" /> covering the constructor, culture resolution,
///     fallbacks and the shared Empty/System instances.
/// </summary>
public sealed class VoiceLanguageTests
{
    /// <summary>
    ///     Verifies the constructor stores the name and type and that ToString returns the name.
    /// </summary>
    [Fact]
    public void Constructor_StoresNameAndType()
    {
        // Given/When: a source language instance
        var sut = new VoiceLanguage("English", LanguageTypes.Source);

        // Then: the supplied values are exposed unchanged
        sut.LanguageName.ShouldBe("English");
        sut.LanguageType.ShouldBe(LanguageTypes.Source);
        sut.ToString().ShouldBe("English");
    }

    /// <summary>
    ///     Verifies a known language name resolves to the corresponding neutral culture.
    /// </summary>
    /// <param name="languageName">The English language name.</param>
    /// <param name="expectedIsoCode">The expected two-letter ISO code.</param>
    [Theory]
    [InlineData("English", "en")]
    [InlineData("Finnish", "fi")]
    [InlineData("German", "de")]
    public void LanguageCulture_KnownLanguage_ResolvesToCulture(string languageName, string expectedIsoCode)
    {
        // Given/When: a voice language for a known name
        var sut = new VoiceLanguage(languageName, LanguageTypes.Source);

        // Then: the culture matches the language
        sut.LanguageCulture.TwoLetterISOLanguageName.ShouldBe(expectedIsoCode);
    }

    /// <summary>
    ///     Verifies an unknown language name falls back to the current culture.
    /// </summary>
    [Fact]
    public void LanguageCulture_UnknownLanguage_FallsBackToCurrentCulture()
    {
        // Given/When: a voice language whose name matches no neutral culture
        var sut = new VoiceLanguage("Klingon", LanguageTypes.Source);

        // Then: the current culture is used as the fallback
        sut.LanguageCulture.ShouldBe(CultureInfo.CurrentCulture);
    }

    /// <summary>
    ///     Verifies Empty is a cached placeholder with no name and no language type.
    /// </summary>
    [Fact]
    public void Empty_IsCachedPlaceholder()
    {
        // When: reading the shared empty language twice
        var first = VoiceLanguage.Empty;
        var second = VoiceLanguage.Empty;

        // Then: it is the same instance with the documented values
        first.ShouldBeSameAs(second);
        first.LanguageName.ShouldBeEmpty();
        first.LanguageType.ShouldBe(LanguageTypes.None);
        first.LanguageCulture.ShouldBe(CultureInfo.CurrentCulture);
    }

    /// <summary>
    ///     Verifies the System language is cached, typed as System and derived from the current culture.
    /// </summary>
    [Fact]
    public void System_IsCachedAndDerivedFromCurrentCulture()
    {
        // Given: the first word of the current culture's English name
        var expectedName = CultureInfo.CurrentCulture.EnglishName.Split(' ')[0];

        // When: reading the shared system language twice
        var first = VoiceLanguage.System;
        var second = VoiceLanguage.System;

        // Then: it is the same instance with the expected name and type
        first.ShouldBeSameAs(second);
        first.LanguageName.ShouldBe(expectedName);
        first.LanguageType.ShouldBe(LanguageTypes.System);
    }
}

/// <summary>
///     Tests for <see cref="VoiceLanguageList" /> covering the default voice fallback and
///     the string representation.
/// </summary>
public sealed class VoiceLanguageListTests
{
    /// <summary>
    ///     Verifies DefaultVoice falls back to the system language when nothing was set.
    /// </summary>
    [Fact]
    public void DefaultVoice_WhenNotSet_FallsBackToSystemLanguage()
    {
        // Given: an empty voice language list
        var sut = new VoiceLanguageList();

        // When: reading the default voice
        var actual = sut.DefaultVoice;

        // Then: the system language is used and cached
        actual.ShouldBeSameAs(VoiceLanguage.System);
        sut.DefaultVoice.ShouldBeSameAs(actual);
    }

    /// <summary>
    ///     Verifies DefaultVoice is independent of the languages contained in the list.
    /// </summary>
    [Fact]
    public void DefaultVoice_WithLanguagesInList_StillFallsBackToSystemLanguage()
    {
        // Given: a list containing an explicit language
        var sut = new VoiceLanguageList { new VoiceLanguage("English", LanguageTypes.Source) };

        // When: reading the default voice
        var actual = sut.DefaultVoice;

        // Then: the list content does not define the default
        actual.ShouldBeSameAs(VoiceLanguage.System);
    }

    /// <summary>
    ///     Verifies ToString joins the language names with commas.
    /// </summary>
    [Fact]
    public void ToString_MultipleLanguages_JoinsNamesWithComma()
    {
        // Given: a list with two languages
        var sut = new VoiceLanguageList
        {
            new VoiceLanguage("English", LanguageTypes.Source),
            new VoiceLanguage("Finnish", LanguageTypes.Target)
        };

        // When/Then: the names are joined in order
        sut.ToString().ShouldBe("English, Finnish");
    }

    /// <summary>
    ///     Verifies ToString of an empty list is an empty string.
    /// </summary>
    [Fact]
    public void ToString_EmptyList_ReturnsEmptyString()
    {
        // Given: an empty list
        var sut = new VoiceLanguageList();

        // When/Then: the representation is empty
        sut.ToString().ShouldBeEmpty();
    }
}
