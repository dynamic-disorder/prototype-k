using Shouldly;

using TranslationTools;

namespace TranslationTools.Tests;

/// <summary>
///     Tests for <see cref="TranslationEntryList" /> covering the collection surface and
///     its integration with <see cref="TranslationsParser" /> via LoadFromCsvLines.
/// </summary>
public sealed class TranslationEntryListTests
{
    /// <summary>
    ///     Verifies Add appends rows and Count reflects the number of rows.
    /// </summary>
    [Fact]
    public void Add_AppendsRows_AndCountReflectsThem()
    {
        // Given: an empty list
        var sut = new TranslationEntryList();

        // When: adding two rows
        sut.Add(new TextEntryRow());
        sut.Add(new TextEntryRow());

        // Then: both rows are stored
        sut.Count.ShouldBe(2);
        sut.Entries.Count.ShouldBe(2);
    }

    /// <summary>
    ///     Verifies the indexer returns the row at the requested position.
    /// </summary>
    [Fact]
    public void Indexer_ReturnsRowAtRequestedIndex()
    {
        // Given: a list with two distinguishable rows
        var sut = new TranslationEntryList();
        var first = new TextEntryRow { new TextEntry { Text = "first" } };
        var second = new TextEntryRow { new TextEntry { Text = "second" } };
        sut.Add(first);
        sut.Add(second);

        // When/Then: the indexer returns the matching rows
        sut[0].ShouldBeSameAs(first);
        sut[1].ShouldBeSameAs(second);
        sut[1][0].Text.ShouldBe("second");
    }

    /// <summary>
    ///     Verifies IsSingleLanguage is true only when exactly one voice language is present.
    /// </summary>
    /// <param name="languageCount">The number of voice languages to add.</param>
    /// <param name="expected">The expected IsSingleLanguage value.</param>
    [Theory]
    [InlineData(0, false)]
    [InlineData(1, true)]
    [InlineData(2, false)]
    public void IsSingleLanguage_DependsOnVoiceLanguageCount(int languageCount, bool expected)
    {
        // Given: a list with the requested number of voice languages
        var sut = new TranslationEntryList();
        for (var i = 0; i < languageCount; i++)
        {
            sut.VoiceLanguages.Add(new VoiceLanguage($"Language{i}", LanguageTypes.Source));
        }

        // When/Then: the flag follows the language count
        sut.IsSingleLanguage.ShouldBe(expected);
    }

    /// <summary>
    ///     Verifies LoadFromCsvLines populates both the voice languages and the entries.
    /// </summary>
    [Fact]
    public void LoadFromCsvLines_ValidLines_PopulatesLanguagesAndEntries()
    {
        // Given: a compact colon header and one data row
        var sut = new TranslationEntryList();
        string[] csvLines = ["\"hello\",\"bonjour\""];

        // When: loading the CSV lines
        sut.LoadFromCsvLines("Source:English, Target:French", csvLines);

        // Then: the languages and the single row are populated
        sut.Count.ShouldBe(1);
        sut.IsTranslationEntryTranslations.ShouldBeFalse();
        sut.VoiceLanguages.Count.ShouldBe(2);
        sut.VoiceLanguages[0].LanguageName.ShouldBe("English");
        sut.VoiceLanguages[1].LanguageName.ShouldBe("French");
        sut[0][0].Text.ShouldBe("hello");
        sut[0][1].Text.ShouldBe("bonjour");
    }

    /// <summary>
    ///     Verifies that loading twice replaces existing languages and entries instead of appending.
    /// </summary>
    [Fact]
    public void LoadFromCsvLines_CalledTwice_ReplacesPreviousData()
    {
        // Given: a list already populated once
        var sut = new TranslationEntryList();
        sut.LoadFromCsvLines("Source:English, Target:French", ["\"hello\",\"bonjour\""]);

        // When: loading a different set of lines
        sut.LoadFromCsvLines("Source:German, Target:Spanish", ["\"hallo\",\"hola\""]);

        // Then: the previous languages and entries were cleared
        sut.Count.ShouldBe(1);
        sut.VoiceLanguages.Count.ShouldBe(2);
        sut.VoiceLanguages[0].LanguageName.ShouldBe("German");
        sut.VoiceLanguages[1].LanguageName.ShouldBe("Spanish");
        sut[0][0].Text.ShouldBe("hallo");
    }
}
