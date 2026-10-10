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
    ///     Creates three well-formed data rows for the five-column header. Three rows are
    ///     required because the parser reads the target language from the third data row.
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
    ///     Documents the actual (buggy) behaviour of doubled-quote handling. The implementation
    ///     bumps a separate position counter for the lookahead but the foreach loop still visits
    ///     the second quote of the pair, so the quote state drifts and the remainder of the line
    ///     is swallowed into a single field. This test asserts the current output, not the
    ///     documented intent of unescaping "" to ".
    /// </summary>
    [Fact]
    public void SplitCsvLine_DoubledQuotes_AreNotUnescapedCorrectly()
    {
        // Given: a quoted field containing escaped quotes ("" is documented to become one ")
        const string line = "\"He said \"\"hi\"\"\",x";

        // When: splitting the line
        var actual = TranslationsParser.SplitCsvLine(line);

        // Then: the escaped quote pair corrupts the parse and the trailing field is merged in
        actual.ShouldBe(["He said \"hi,x"]);
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
    ///     Verifies the documented five-column layout produces source and target entries.
    /// </summary>
    [Fact]
    public void ParseTranslationsCsvLines_FiveColumnLayout_ParsesSourceAndTargetEntries()
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

        // Then: each row has only the source and target text entries (language/hashtag columns are skipped)
        sut[0].Count.ShouldBe(2);
        sut[0][0].Language.LanguageName.ShouldBe("English");
        sut[0][0].Text.ShouldBe("abdomen");
        sut[0][1].Language.LanguageName.ShouldBe("Finnish");
        sut[0][1].Text.ShouldBe("vatsa/vatsan alue");
        sut[2][1].Text.ShouldBe("taidokkaasti");
    }

    /// <summary>
    ///     Documents the actual behaviour: the target language is read from the third data row
    ///     (csvLines[2]) rather than from the header, so a differing value in that row wins.
    /// </summary>
    [Fact]
    public void ParseTranslationsCsvLines_TargetLanguageComesFromThirdDataRow()
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

        // Then: the detected target language is taken from row 3, column 3
        sut.VoiceLanguages[1].LanguageName.ShouldBe("Swedish");
        sut[0][1].Language.LanguageName.ShouldBe("Swedish");
    }

    /// <summary>
    ///     Documents the actual behaviour: a five-column file needs at least three data rows
    ///     because the parser indexes csvLines[2] while resolving the target language.
    /// </summary>
    [Fact]
    public void ParseTranslationsCsvLines_FewerThanThreeDataRows_ThrowsIndexOutOfRange()
    {
        // Given: only two data rows for the five-column header
        string[] lines =
        [
            "\"English\",\"a\",\"Finnish\",\"aa\",\"#x\"",
            "\"English\",\"b\",\"Finnish\",\"bb\",\"#x\""
        ];

        // When/Then: the parser indexes beyond the supplied rows
        Should.Throw<IndexOutOfRangeException>(() =>
            TranslationsParser.ParseTranslationsCsvLines(FiveColumnHeader, lines));
    }

    /// <summary>
    ///     Verifies the documented short "Hashtags" header is accepted (it needs five data rows
    ///     because the parser indexes csvLines[4] for that column).
    /// </summary>
    [Fact]
    public void ParseTranslationsCsvLines_DocumentedHashtagsHeader_IsAccepted()
    {
        // Given: the documented header and five data rows
        string[] lines =
        [
            "\"English\",\"a\",\"Finnish\",\"aa\",\"#one\"",
            "\"English\",\"b\",\"Finnish\",\"bb\",\"#two\"",
            "\"English\",\"c\",\"Finnish\",\"cc\",\"#three\"",
            "\"English\",\"d\",\"Finnish\",\"dd\",\"#four\"",
            "\"English\",\"e\",\"Finnish\",\"ee\",\"#five\""
        ];

        // When: parsing the lines
        var sut = TranslationsParser.ParseTranslationsCsvLines(DocumentedHashtagsHeader, lines);

        // Then: all rows are parsed and the hashtag column is not part of the entries
        sut.Count.ShouldBe(5);
        sut.IsTranslationEntryTranslations.ShouldBeTrue();
        sut[0].Count.ShouldBe(2);
    }

    /// <summary>
    ///     Documents the actual behaviour: the "Hashtags" column makes the parser read csvLines[4],
    ///     so a four-row file is rejected with an index error.
    /// </summary>
    [Fact]
    public void ParseTranslationsCsvLines_HashtagsHeaderWithFewerThanFiveRows_ThrowsIndexOutOfRange()
    {
        // Given: four data rows for the documented hashtags header
        string[] lines =
        [
            "\"English\",\"a\",\"Finnish\",\"aa\",\"#one\"",
            "\"English\",\"b\",\"Finnish\",\"bb\",\"#two\"",
            "\"English\",\"c\",\"Finnish\",\"cc\",\"#three\"",
            "\"English\",\"d\",\"Finnish\",\"dd\",\"#four\""
        ];

        // When/Then: the parser indexes beyond the supplied rows
        Should.Throw<IndexOutOfRangeException>(() =>
            TranslationsParser.ParseTranslationsCsvLines(DocumentedHashtagsHeader, lines));
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
    ///     Documents the actual (buggy) behaviour: a colon-style header that also uses the long
    ///     column names is cleaned by removing spaces, so the "Source Language"/"Target Language"
    ///     detection fails and the fallback language extractor splits the "SourceText" column on
    ///     a colon that it does not contain.
    /// </summary>
    [Fact]
    public void ParseTranslationsCsvLines_ColonStyleFiveColumnHeader_ThrowsIndexOutOfRange()
    {
        // Given: a five-column header expressed with colons and long column names
        const string header =
            "Source Language:English, Source Text, Target Language:Finnish, Target Text, Hashtags";
        string[] lines = ["\"English\",\"a\",\"Finnish\",\"aa\",\"#x\""];

        // When/Then: space stripping breaks the language detection and the fallback split fails
        Should.Throw<IndexOutOfRangeException>(() =>
            TranslationsParser.ParseTranslationsCsvLines(header, lines));
    }

    /// <summary>
    ///     Verifies that columns beyond the header definition cause an index error.
    /// </summary>
    [Fact]
    public void ParseTranslationsCsvLines_ExtraDataColumn_ThrowsIndexOutOfRange()
    {
        // Given: rows with one more column than the header defines
        string[] lines =
        [
            "\"English\",\"a\",\"Finnish\",\"aa\",\"#x\",\"extra\"",
            "\"English\",\"b\",\"Finnish\",\"bb\",\"#x\",\"extra\"",
            "\"English\",\"c\",\"Finnish\",\"cc\",\"#x\",\"extra\""
        ];

        // When/Then: the parser looks up a header column that does not exist
        Should.Throw<IndexOutOfRangeException>(() =>
            TranslationsParser.ParseTranslationsCsvLines(FiveColumnHeader, lines));
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
    ///     Documents the actual (buggy) behaviour: a row containing escaped quotes is split
    ///     incorrectly, so the source entry absorbs the rest of the line and the target entry
    ///     is lost. See <see cref="TranslationsParser.SplitCsvLine" />.
    /// </summary>
    [Fact]
    public void ParseTranslationsCsvLines_DoubledQuotes_CorruptTheRow()
    {
        // Given: three rows whose text contains escaped quotes
        string[] lines =
        [
            "\"English\",\"He said \"\"hi\"\"\",\"Finnish\",\"Hän sanoi \"\"hei\"\"\",\"#x\"",
            "\"English\",\"He said \"\"hi\"\"\",\"Finnish\",\"Hän sanoi \"\"hei\"\"\",\"#x\"",
            "\"English\",\"He said \"\"hi\"\"\",\"Finnish\",\"Hän sanoi \"\"hei\"\"\",\"#x\""
        ];

        // When: parsing the lines
        var sut = TranslationsParser.ParseTranslationsCsvLines(FiveColumnHeader, lines);

        // Then: the row collapses into one merged source entry and loses the target entry
        sut[0].Count.ShouldBe(1);
        sut[0][0].Language.LanguageName.ShouldBe("English");
        sut[0][0].Text.ShouldBe("He said \"hi,Finnish,Hän sanoi hei,#x");
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

        // Then: the entries exist but carry empty text
        sut[0].Count.ShouldBe(2);
        sut[0][0].Text.ShouldBeEmpty();
        sut[0][1].Text.ShouldBeEmpty();
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
