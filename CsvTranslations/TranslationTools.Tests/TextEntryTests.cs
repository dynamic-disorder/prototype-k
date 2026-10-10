using Shouldly;

using TranslationTools;

namespace TranslationTools.Tests;

/// <summary>
///     Tests for <see cref="TextEntry" /> covering defaults, the shared Empty instance
///     and string formatting.
/// </summary>
public sealed class TextEntryTests
{
    /// <summary>
    ///     Verifies the default property values of a new entry.
    /// </summary>
    [Fact]
    public void NewInstance_HasEmptyDefaults()
    {
        // Given/When: a freshly constructed entry
        var sut = new TextEntry();

        // Then: language, text and entry type use their documented defaults
        sut.Language.ShouldBeSameAs(VoiceLanguage.Empty);
        sut.Text.ShouldBeEmpty();
        sut.EntryType.ShouldBe(TextEntryType.None);
    }

    /// <summary>
    ///     Verifies the static Empty entry is an empty placeholder.
    /// </summary>
    [Fact]
    public void Empty_HasEmptyLanguageAndText()
    {
        // When: reading the shared empty entry
        var sut = TextEntry.Empty;

        // Then: it carries the empty voice language and no text
        sut.Language.ShouldBeSameAs(VoiceLanguage.Empty);
        sut.Text.ShouldBeEmpty();
    }

    /// <summary>
    ///     Verifies ToString only includes the entry type when one is set.
    /// </summary>
    [Fact]
    public void ToString_WithoutEntryType_ListsLanguageAndTextOnly()
    {
        // Given: an entry with a language and text but no entry type
        var sut = new TextEntry
        {
            Language = new VoiceLanguage("English", LanguageTypes.Source),
            Text = "hello"
        };

        // When/Then: the entry type suffix is omitted
        sut.ToString().ShouldBe("Language: English, Text: hello");
    }

    /// <summary>
    ///     Verifies ToString appends the entry type when it is not None.
    /// </summary>
    [Fact]
    public void ToString_WithEntryType_AppendsEntryType()
    {
        // Given: an entry with an explicit entry type
        var sut = new TextEntry
        {
            Language = new VoiceLanguage("Finnish", LanguageTypes.Target),
            Text = "hei",
            EntryType = TextEntryType.Target
        };

        // When/Then: the entry type is part of the representation
        sut.ToString().ShouldBe("Language: Finnish, Text: hei, EntryType: Target");
    }
}

/// <summary>
///     Tests for <see cref="TextEntryRow" /> covering its list behaviour and the
///     language-prefixed text rendering.
/// </summary>
public sealed class TextEntryRowTests
{
    /// <summary>
    ///     Verifies a row behaves as a list of text entries.
    /// </summary>
    [Fact]
    public void Add_MultipleEntries_ExposesThemByIndex()
    {
        // Given: an empty row
        var sut = new TextEntryRow();

        // When: adding a source and a target entry
        sut.Add(new TextEntry { Language = new VoiceLanguage("English", LanguageTypes.Source), Text = "hello" });
        sut.Add(new TextEntry { Language = new VoiceLanguage("Finnish", LanguageTypes.Target), Text = "hei" });

        // Then: both entries are addressable
        sut.Count.ShouldBe(2);
        sut[0].Text.ShouldBe("hello");
        sut[1].Text.ShouldBe("hei");
    }

    /// <summary>
    ///     Verifies GetAllAsString renders each entry on its own line using the ISO language code.
    /// </summary>
    [Fact]
    public void GetAllAsString_MultipleEntries_RendersLanguageCodeAndText()
    {
        // Given: a row with an English and a Finnish entry
        var sut = new TextEntryRow
        {
            new TextEntry { Language = new VoiceLanguage("English", LanguageTypes.Source), Text = "hello" },
            new TextEntry { Language = new VoiceLanguage("Finnish", LanguageTypes.Target), Text = "hei" }
        };
        var newLine = Environment.NewLine;

        // When: rendering the row
        var actual = sut.GetAllAsString();

        // Then: each line is prefixed with the two-letter ISO language name
        actual.ShouldBe($"{newLine}  en: hello{newLine}  fi: hei");
    }

    /// <summary>
    ///     Verifies an empty row renders as a single line break.
    /// </summary>
    [Fact]
    public void GetAllAsString_EmptyRow_ReturnsOnlyLineBreak()
    {
        // Given: an empty row
        var sut = new TextEntryRow();

        // When: rendering the row
        var actual = sut.GetAllAsString();

        // Then: no entry lines are produced
        actual.ShouldBe(Environment.NewLine);
    }
}
