using Shouldly;

using TranslationTools;

namespace TranslationTools.Tests;

/// <summary>
///     Tests for <see cref="TranslationsParser" />, covering CSV field splitting,
///     the five-column translations layout, the compact colon header layout and
///     malformed input.
/// </summary>
public sealed class TranslationsParserTests
{
    /// <summary>
    ///     Header used by the real translations.csv file (note that the hashtags column
    ///     is named "Context Categorization Hashtags").
    /// </summary>
    private const string FiveColumnHeader =
        "[Source Language],[Source Text],[Target Language],[Target Text],[Context Categorization Hashtags]";

    /// <summary>
    ///     Header using the documented short "Hashtags" column name.
    /// </summary>
    private const string DocumentedHashtagsHeader =
        "[Source Language],[Source Text],[Target Language],[Target Text],[Hashtags]";

    /// <summary>
    ///     Creates three well-formed data rows for the five-column header.
    /// </summary>
    private static string[] ThreeDataRows()
    {
        return
        [
            "\"English\",\"abdomen\",\"Finnish\",\"vatsa/vatsan alue\",\"#anatomy\"",
            "\"English\",\"abet\",\"Finnish\",\"avustaa\",\"#action\"",
            "\"English\",\"ably\",\"Finnish\",\"taidokkaasti\",\"#adverb\""
        ];
    }

    /// <summary>
    ///     Verifies that an unquoted line is split on commas.
    /// </summary>
    [Fact]
    public void SplitCsvLine_PlainFields_SplitsOnCommas()
    {
        // Given: a simple, unquoted CSV line
        const string line = "a,b,c";

        // When: splitting the line
        var actual = TranslationsParser.SplitCsvLine(line);

        // Then: every field is returned in order
        actual.ShouldBe(["a", "b", "c"]);
    }

    /// <summary>
    ///     Verifies that surrounding quotes are removed from quoted fields.
    /// </summary>
    [Fact]
    public void SplitCsvLine_QuotedFields_RemovesSurroundingQuotes()
    {
        // Given: a line whose fields are all quoted
        const string line = "\"English\",\"abdomen\"";

        // When: splitting the line
        var actual = TranslationsParser.SplitCsvLine(line);

        // Then: the quotes are consumed and do not appear in the fields
        actual.ShouldBe(["English", "abdomen"]);
    }

    /// <summary>
    ///     Verifies that commas inside quoted fields are preserved.
    /// </summary>
    [Fact]
    public void SplitCsvLine_CommaInsideQuotedField_IsPreserved()
    {
        // Given: a quoted field containing a comma
        const string line = "\"one, two\",\"three\"";

        // When: splitting the line
        var actual = TranslationsParser.SplitCsvLine(line);

        // Then: the embedded comma does not start a new field
        actual.ShouldBe(["one, two", "three"]);
    }

    /// <summary>
    ///     Verifies that a doubled quote inside a quoted field is unescaped to a single quote
    ///     without swallowing the remaining separator or field.
    /// </summary>
    [Fact]
    public void SplitCsvLine_DoubledQuotes_AreUnescaped()
    {
        // Given: a quoted field containing escaped quotes ("" becomes one ")
        const string line = "\"He said \"\"hi\"\"\",x";

        // When: splitting the line
        var actual = TranslationsParser.SplitCsvLine(line);

        // Then: the escaped quotes collapse and the trailing field stays separate
        actual.ShouldBe(["He said \"hi\"", "x"]);
    }

    /// <summary>
    ///     Verifies that empty fields are preserved rather than dropped.
    /// </summary>
    [Theory]
    [InlineData("a,,b", new[] { "a", "", "b" })]
    [InlineData("a,b,", new[] { "a", "b", "" })]
    [InlineData(",a", new[] { "", "a" })]
    [InlineData("", new[] { "" })]
    [InlineData(",,", new[] { "", "", "" })]
    public void SplitCsvLine_EmptyFields_ArePreserved(string line, string[] expected)
    {
        // When: splitting the line
        var actual = TranslationsParser.SplitCsvLine(line);

        // Then: the field count matches, including the empty fields
        actual.ShouldBe(expected);
    }

    /// <summary>
    ///     Verifies that the splitter does not trim whitespace (trimming happens later in the parser).
    /// </summary>
    [Fact]
    public void SplitCsvLine_Whitespace_IsNotTrimmed()
    {
        // Given: a line with whitespace around the values
        const string line = " a , b ";

        // When: splitting the line
        var actual = TranslationsParser.SplitCsvLine(line);

        // Then: whitespace is preserved because trimming is the parser's responsibility
        actual.ShouldBe([" a ", " b "]);
    }

    /// <summary>
    ///     Verifies that an unbalanced opening quote simply consumes the rest of the line.
    /// </summary>
    [Fact]
    public void SplitCsvLine_UnbalancedQuote_ReturnsRemainingTextWithoutQuote()
    {
        // Given: a field opened with a quote that is never closed
        const string line = "\"abc,def";

        // When: splitting the line
        var actual = TranslationsParser.SplitCsvLine(line);

        // Then: the comma is treated as quoted content and the quote is dropped
        actual.ShouldBe(["abc,def"]);
    }

    /// <summary>
    ///     Verifies that quotes embedded in an unquoted field are stripped.
    /// </summary>
    [Fact]
    public void SplitCsvLine_QuotesInsideUnquotedField_AreStripped()
    {
        // Given: a field with quotes in the middle
        const string line = "a\"b\"c,d";

        // When: splitting the line
        var actual = TranslationsParser.SplitCsvLine(line);

        // Then: the quotes are removed and the fields remain separated
        actual.ShouldBe(["abc", "d"]);
    }

    /// <summary>
    ///     Verifies the documented five-column layout produces source, target and hashtag entries
    ///     with the correct entry types.
    /// </summary>
    [Fact]
    public void ParseTranslationsCsvLines_FiveColumnLayout_ParsesSourceTargetAndHashtagEntries()
    {
        // Given: the five-column header and three data rows
        var lines = ThreeDataRows();

        // When: parsing the lines
        var sut = TranslationsParser.ParseTranslationsCsvLines(FiveColumnHeader, lines);

        // Then: the list is flagged as translation entries with one source and one target language
        sut.IsTranslationEntryTranslations.ShouldBeTrue();
        sut.Count.ShouldBe(3);
        sut.VoiceLanguages.Count.ShouldBe(2);
        sut.VoiceLanguages[0].LanguageName.ShouldBe("English");
        sut.VoiceLanguages[0].LanguageType.ShouldBe(LanguageTypes.Source);
        sut.VoiceLanguages[1].LanguageName.ShouldBe("Finnish");
        sut.VoiceLanguages[1].LanguageType.ShouldBe(LanguageTypes.Target);

        // Then: each row carries source text, target text and the hashtag metadata
        sut[0].Count.ShouldBe(3);
        sut[0][0].Language.LanguageName.ShouldBe("English");
        sut[0][0].Text.ShouldBe("abdomen");
        sut[0][0].EntryType.ShouldBe(TextEntryType.Source);
        sut[0][1].Language.LanguageName.ShouldBe("Finnish");
        sut[0][1].Text.ShouldBe("vatsa/vatsan alue");
        sut[0][1].EntryType.ShouldBe(TextEntryType.Target);
        sut[0][2].Text.ShouldBe("#anatomy");
        sut[0][2].EntryType.ShouldBe(TextEntryType.Hashtags);
        sut[2][1].Text.ShouldBe("taidokkaasti");
    }

    /// <summary>
    ///     Verifies the source and target language values are taken from the first data row,
    ///     so a differing language in a later row does not change the detected languages.
    /// </summary>
    [Fact]
    public void ParseTranslationsCsvLines_LanguagesComeFromFirstDataRow()
    {
        // Given: three rows where only the third row declares a different target language
        string[] lines =
        [
            "\"English\",\"a\",\"Finnish\",\"aa\",\"#x\"",
            "\"English\",\"b\",\"Finnish\",\"bb\",\"#x\"",
            "\"English\",\"c\",\"Swedish\",\"cc\",\"#x\""
        ];

        // When: parsing the lines
        var sut = TranslationsParser.ParseTranslationsCsvLines(FiveColumnHeader, lines);

        // Then: the languages declared by the first data row win
        sut.VoiceLanguages[0].LanguageName.ShouldBe("English");
        sut.VoiceLanguages[1].LanguageName.ShouldBe("Finnish");
        sut[0][1].Language.LanguageName.ShouldBe("Finnish");

        // Then: the outstanding third-row value is still parsed as ordinary target text
        sut[2][1].Text.ShouldBe("cc");
    }

    /// <summary>
    ///     Verifies that a five-column file with fewer than three data rows parses without error.
    /// </summary>
    [Fact]
    public void ParseTranslationsCsvLines_TwoDataRows_AreParsedWithoutError()
    {
        // Given: only two data rows for the five-column header
        string[] lines =
        [
            "\"English\",\"a\",\"Finnish\",\"aa\",\"#x\"",
            "\"English\",\"b\",\"Finnish\",\"bb\",\"#x\""
        ];

        // When: parsing the lines
        var sut = TranslationsParser.ParseTranslationsCsvLines(FiveColumnHeader, lines);

        // Then: both rows are parsed with the languages taken from the first row
        sut.Count.ShouldBe(2);
        sut.VoiceLanguages[0].LanguageName.ShouldBe("English");
        sut.VoiceLanguages[1].LanguageName.ShouldBe("Finnish");
        sut[1][1].Text.ShouldBe("bb");
    }

    /// <summary>
    ///     Verifies that a single data row is enough to resolve the languages and parse the row.
    /// </summary>
    [Fact]
    public void ParseTranslationsCsvLines_SingleDataRow_IsParsed()
    {
        // Given: a five-column file with exactly one data row
        string[] lines = ["\"English\",\"a\",\"Finnish\",\"aa\",\"#x\""];

        // When: parsing the lines
        var sut = TranslationsParser.ParseTranslationsCsvLines(FiveColumnHeader, lines);

        // Then: the row and both languages are resolved
        sut.Count.ShouldBe(1);
        sut.VoiceLanguages[0].LanguageName.ShouldBe("English");
        sut.VoiceLanguages[1].LanguageName.ShouldBe("Finnish");
        sut[0].Count.ShouldBe(3);
    }

    /// <summary>
    ///     Verifies the documented short "Hashtags" header is accepted with any number of rows
    ///     and produces a hashtag entry.
    /// </summary>
    [Fact]
    public void ParseTranslationsCsvLines_DocumentedHashtagsHeader_IsAccepted()
    {
        // Given: the documented header and two data rows
        string[] lines =
        [
            "\"English\",\"a\",\"Finnish\",\"aa\",\"#one\"",
            "\"English\",\"b\",\"Finnish\",\"bb\",\"#two\""
        ];

        // When: parsing the lines
        var sut = TranslationsParser.ParseTranslationsCsvLines(DocumentedHashtagsHeader, lines);

        // Then: both rows are parsed and the hashtag is represented as metadata
        sut.Count.ShouldBe(2);
        sut.IsTranslationEntryTranslations.ShouldBeTrue();
        sut[0].Count.ShouldBe(3);
        sut[0][2].Text.ShouldBe("#one");
        sut[0][2].EntryType.ShouldBe(TextEntryType.Hashtags);
    }

    /// <summary>
    ///     Verifies that hashtag recognition is based on the column name containing "Hashtags"
    ///     (case-insensitive), not on it starting with that literal.
    /// </summary>
    [Theory]
    [InlineData("Context Categorization Hashtags")]
    [InlineData("hashtags")]
    [InlineData("Category HASHTAGS column")]
    public void ParseTranslationsCsvLines_HashtagColumnNameVariants_AreRecognised(string hashtagColumnName)
    {
        // Given: a five-column header whose last column uses the supplied hashtag column name
        var header = "[Source Language],[Source Text],[Target Language],[Target Text],[" + hashtagColumnName + "]";
        string[] lines =
        [
            "\"English\",\"a\",\"Finnish\",\"aa\",\"#one\"",
            "\"English\",\"b\",\"Finnish\",\"bb\",\"#two\""
        ];

        // When: parsing the lines
        var sut = TranslationsParser.ParseTranslationsCsvLines(header, lines);

        // Then: the column is treated as hashtag metadata
        sut[0].Count.ShouldBe(3);
        sut[0][2].EntryType.ShouldBe(TextEntryType.Hashtags);
        sut[0][2].Text.ShouldBe("#one");
    }

    /// <summary>
    ///     Verifies the compact colon header layout ("Source:English, Target:French") is parsed
    ///     as a non-translation-entry list with language names taken from the header.
    /// </summary>
    [Fact]
    public void ParseTranslationsCsvLines_ColonHeader_ParsesLanguagesAndTexts()
    {
        // Given: a compact colon header and two rows
        const string header = "Source:English, Target:French";
        string[] lines = ["\"hello\",\"bonjour\"", "\"world\",\"monde\""];

        // When: parsing the lines
        var sut = TranslationsParser.ParseTranslationsCsvLines(header, lines);

        // Then: the two header languages are detected in order
        sut.IsTranslationEntryTranslations.ShouldBeFalse();
        sut.VoiceLanguages.Count.ShouldBe(2);
        sut.VoiceLanguages[0].LanguageName.ShouldBe("English");
        sut.VoiceLanguages[1].LanguageName.ShouldBe("French");

        // Then: each column maps to the language at the same position
        sut.Count.ShouldBe(2);
        sut[0].Count.ShouldBe(2);
        sut[0][0].Language.LanguageName.ShouldBe("English");
        sut[0][0].Text.ShouldBe("hello");
        sut[0][1].Language.LanguageName.ShouldBe("French");
        sut[0][1].Text.ShouldBe("bonjour");
        sut[1][1].Text.ShouldBe("monde");
    }

    /// <summary>
    ///     Verifies a colon-style header that also uses the long column names parses the declared
    ///     source and target languages without tripping over the columns that carry no value.
    /// </summary>
    [Fact]
    public void ParseTranslationsCsvLines_ColonStyleFiveColumnHeader_ParsesLongLanguageNames()
    {
        // Given: a five-column header expressed with colons and long column names
        const string header =
            "Source Language:English, Source Text, Target Language:Finnish, Target Text, Hashtags";
        string[] lines = ["\"English\",\"a\",\"Finnish\",\"aa\",\"#x\""];

        // When: parsing the lines
        var sut = TranslationsParser.ParseTranslationsCsvLines(header, lines);

        // Then: the declared languages are detected and the row is parsed
        sut.VoiceLanguages.Count.ShouldBe(2);
        sut.VoiceLanguages[0].LanguageName.ShouldBe("English");
        sut.VoiceLanguages[1].LanguageName.ShouldBe("Finnish");
        sut[0].Count.ShouldBe(3);
        sut[0][0].Text.ShouldBe("a");
        sut[0][1].Text.ShouldBe("aa");
        sut[0][2].EntryType.ShouldBe(TextEntryType.Hashtags);
    }

    /// <summary>
    ///     Verifies that columns beyond the header definition are ignored instead of throwing.
    /// </summary>
    [Fact]
    public void ParseTranslationsCsvLines_ExtraDataColumn_IsIgnored()
    {
        // Given: rows with one more column than the header defines
        string[] lines =
        [
            "\"English\",\"a\",\"Finnish\",\"aa\",\"#x\",\"extra\"",
            "\"English\",\"b\",\"Finnish\",\"bb\",\"#x\",\"extra\"",
            "\"English\",\"c\",\"Finnish\",\"cc\",\"#x\",\"extra\""
        ];

        // When: parsing the lines
        var sut = TranslationsParser.ParseTranslationsCsvLines(FiveColumnHeader, lines);

        // Then: the extra column is dropped and the known columns are parsed
        sut.Count.ShouldBe(3);
        sut[0].Count.ShouldBe(3);
        sut[0][0].Text.ShouldBe("a");
        sut[0][1].Text.ShouldBe("aa");
        sut[0][2].Text.ShouldBe("#x");
    }

    /// <summary>
    ///     Verifies that a row with fewer columns than the header produces fewer entries
    ///     instead of throwing.
    /// </summary>
    [Fact]
    public void ParseTranslationsCsvLines_ShortRow_ProducesFewerEntries()
    {
        // Given: a header-defined row set where the middle row lacks the target text
        string[] lines =
        [
            "\"English\",\"a\",\"Finnish\",\"aa\",\"#x\"",
            "\"English\",\"b\"",
            "\"English\",\"c\",\"Finnish\",\"cc\",\"#x\""
        ];

        // When: parsing the lines
        var sut = TranslationsParser.ParseTranslationsCsvLines(FiveColumnHeader, lines);

        // Then: the short row only contributes the source entry
        sut.Count.ShouldBe(3);
        sut[1].Count.ShouldBe(1);
        sut[1][0].Text.ShouldBe("b");
    }

    /// <summary>
    ///     Verifies that embedded commas inside quoted fields survive parsing into entry text.
    /// </summary>
    [Fact]
    public void ParseTranslationsCsvLines_QuotedTextWithCommas_IsPreserved()
    {
        // Given: three rows whose source/target text contains commas (no escaped quotes)
        string[] lines =
        [
            "\"English\",\"one, two\",\"Finnish\",\"yksi, kaksi\",\"#x\"",
            "\"English\",\"one\",\"Finnish\",\"yksi\",\"#x\"",
            "\"English\",\"a, b, c\",\"Finnish\",\"a, b, c\",\"#x\""
        ];

        // When: parsing the lines
        var sut = TranslationsParser.ParseTranslationsCsvLines(FiveColumnHeader, lines);

        // Then: the embedded commas are preserved in the text
        sut[0][0].Text.ShouldBe("one, two");
        sut[0][1].Text.ShouldBe("yksi, kaksi");
        sut[2][1].Text.ShouldBe("a, b, c");
    }

    /// <summary>
    ///     Verifies that a row containing escaped quotes keeps its source and target fields
    ///     with the quotes unescaped. See <see cref="TranslationsParser.SplitCsvLine" />.
    /// </summary>
    [Fact]
    public void ParseTranslationsCsvLines_DoubledQuotes_KeepBothFields()
    {
        // Given: three rows whose text contains escaped quotes in the middle of the value
        string[] lines =
        [
            "\"English\",\"He said \"\"hi\"\" today\",\"Finnish\",\"Hän sanoi \"\"hei\"\" tänään\",\"#x\"",
            "\"English\",\"He said \"\"hi\"\" today\",\"Finnish\",\"Hän sanoi \"\"hei\"\" tänään\",\"#x\"",
            "\"English\",\"He said \"\"hi\"\" today\",\"Finnish\",\"Hän sanoi \"\"hei\"\" tänään\",\"#x\""
        ];

        // When: parsing the lines
        var sut = TranslationsParser.ParseTranslationsCsvLines(FiveColumnHeader, lines);

        // Then: the row keeps its source, target and hashtag entries with the quotes unescaped
        sut[0].Count.ShouldBe(3);
        sut[0][0].Language.LanguageName.ShouldBe("English");
        sut[0][0].Text.ShouldBe("He said \"hi\" today");
        sut[0][1].Language.LanguageName.ShouldBe("Finnish");
        sut[0][1].Text.ShouldBe("Hän sanoi \"hei\" tänään");
    }

    /// <summary>
    ///     Verifies that empty quoted fields become empty entry text.
    /// </summary>
    [Fact]
    public void ParseTranslationsCsvLines_EmptyFields_ProduceEmptyText()
    {
        // Given: three rows with empty source and target text
        string[] lines =
        [
            "\"English\",\"\",\"Finnish\",\"\",\"#x\"",
            "\"English\",\"\",\"Finnish\",\"\",\"#x\"",
            "\"English\",\"\",\"Finnish\",\"\",\"#x\""
        ];

        // When: parsing the lines
        var sut = TranslationsParser.ParseTranslationsCsvLines(FiveColumnHeader, lines);

        // Then: the source and target entries exist but carry empty text
        sut[0].Count.ShouldBe(3);
        sut[0][0].Text.ShouldBeEmpty();
        sut[0][1].Text.ShouldBeEmpty();
        sut[0][2].Text.ShouldBe("#x");
    }

    /// <summary>
    ///     Verifies that whitespace around quoted field values is trimmed from entry text.
    /// </summary>
    [Fact]
    public void ParseTranslationsCsvLines_WhitespaceAroundValues_IsTrimmed()
    {
        // Given: three rows whose text fields contain padding whitespace
        string[] lines =
        [
            "\"English\",\"  abdomen  \",\"Finnish\",\"  vatsa  \",\"#x\"",
            "\"English\",\"  abet  \",\"Finnish\",\"  avustaa  \",\"#x\"",
            "\"English\",\"  ably  \",\"Finnish\",\"  taidokkaasti  \",\"#x\""
        ];

        // When: parsing the lines
        var sut = TranslationsParser.ParseTranslationsCsvLines(FiveColumnHeader, lines);

        // Then: the entry text is trimmed
        sut[0][0].Text.ShouldBe("abdomen");
        sut[0][1].Text.ShouldBe("vatsa");
    }

    /// <summary>
    ///     Verifies that the language values are read with CSV-aware splitting, so a quoted comma
    ///     in an earlier column does not shift the target language value.
    /// </summary>
    [Fact]
    public void ParseTranslationsCsvLines_QuotedCommaInFirstRow_LanguagesStayAligned()
    {
        // Given: a first data row whose source text contains a comma
        string[] lines =
        [
            "\"English\",\"a, b\",\"Finnish\",\"c, d\",\"#x\"",
            "\"English\",\"e\",\"Finnish\",\"f\",\"#y\""
        ];

        // When: parsing the lines
        var sut = TranslationsParser.ParseTranslationsCsvLines(FiveColumnHeader, lines);

        // Then: the target language is still resolved from the correct column
        sut.VoiceLanguages[0].LanguageName.ShouldBe("English");
        sut.VoiceLanguages[1].LanguageName.ShouldBe("Finnish");
        sut[0][1].Text.ShouldBe("c, d");
    }

    /// <summary>
    ///     Verifies that a first data row shorter than the header yields an empty language
    ///     instead of throwing an index error.
    /// </summary>
    [Fact]
    public void ParseTranslationsCsvLines_FirstDataRowShorterThanHeader_YieldsEmptyLanguage()
    {
        // Given: a five-column header but a first data row with only two fields
        string[] lines =
        [
            "\"English\",\"a\"",
            "\"English\",\"b\",\"Finnish\",\"bb\",\"#x\""
        ];

        // When: parsing the lines
        var sut = TranslationsParser.ParseTranslationsCsvLines(FiveColumnHeader, lines);

        // Then: the missing target language column becomes an empty language rather than an error
        sut.Count.ShouldBe(2);
        sut.VoiceLanguages[0].LanguageName.ShouldBe("English");
        sut.VoiceLanguages[1].LanguageName.ShouldBeEmpty();
        sut[0].Count.ShouldBe(1);
    }

    /// <summary>
    ///     Verifies a semantics column produces a semantics entry and does not throw when the
    ///     column carries no language value.
    /// </summary>
    [Fact]
    public void ParseTranslationsCsvLines_SemanticsColumn_ProducesSemanticsEntry()
    {
        // Given: a five-column header whose last column is a semantics column
        const string header =
            "[Source Language],[Source Text],[Target Language],[Target Text],[Semantics]";
        string[] lines =
        [
            "\"English\",\"a\",\"Finnish\",\"aa\",\"category\"",
            "\"English\",\"b\",\"Finnish\",\"bb\",\"category\""
        ];

        // When: parsing the lines
        var sut = TranslationsParser.ParseTranslationsCsvLines(header, lines);

        // Then: the column is represented as a semantics entry without a declared language
        sut[0].Count.ShouldBe(3);
        sut[0][2].Text.ShouldBe("category");
        sut[0][2].EntryType.ShouldBe(TextEntryType.Semantics);
    }

    /// <summary>
    ///     Verifies that non-translation-entry rows leave the entry type at its default.
    /// </summary>
    [Fact]
    public void ParseTranslationsCsvLines_NonTranslationColumns_LeaveEntryTypeNone()
    {
        // Given: a compact colon header (non translation-entry mode)
        string[] lines = ["\"hello\",\"bonjour\""];

        // When: parsing the lines
        var sut = TranslationsParser.ParseTranslationsCsvLines("Source:English, Target:French", lines);

        // Then: the entries keep the default entry type
        sut[0][0].EntryType.ShouldBe(TextEntryType.None);
        sut[0][1].EntryType.ShouldBe(TextEntryType.None);
    }

    /// <summary>
    ///     Verifies that parsing with no CSV lines leaves an already-populated list untouched.
    /// </summary>
    [Fact]
    public void ParseInto_EmptyCsvLines_LeavesEntryListUnchanged()
    {
        // Given: a list with an existing entry and voice language
        var sut = new TranslationEntryList();
        sut.VoiceLanguages.Add(new VoiceLanguage("English", LanguageTypes.Source));
        sut.Add(new TextEntryRow());

        // When: parsing an empty set of lines into it
        TranslationsParser.ParseInto(sut, FiveColumnHeader, []);

        // Then: the early return keeps the existing data
        sut.Count.ShouldBe(1);
        sut.VoiceLanguages.Count.ShouldBe(1);
        sut.VoiceLanguages[0].LanguageName.ShouldBe("English");
    }
}
