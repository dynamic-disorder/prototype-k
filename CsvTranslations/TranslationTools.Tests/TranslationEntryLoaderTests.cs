using Shouldly;

using TranslationTools;

namespace TranslationTools.Tests;

/// <summary>
///     Tests for <see cref="TranslationEntryLoader" /> using real CSV files written to a
///     temporary directory. The loader resolves existing file paths directly and then parses
///     the header plus data lines.
/// </summary>
public sealed class TranslationEntryLoaderTests : IDisposable
{
    private const string FiveColumnHeader =
        "[Source Language],[Source Text],[Target Language],[Target Text],[Context Categorization Hashtags]";

    private readonly string _tempDirectory;

    /// <summary>
    ///     Creates an isolated temporary directory for each test run.
    /// </summary>
    public TranslationEntryLoaderTests()
    {
        _tempDirectory = Path.Combine(Path.GetTempPath(), "TranslationToolsTests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_tempDirectory);
    }

    /// <summary>
    ///     Removes the temporary directory created for the test.
    /// </summary>
    public void Dispose()
    {
        if (Directory.Exists(_tempDirectory))
        {
            Directory.Delete(_tempDirectory, true);
        }
    }

    /// <summary>
    ///     Writes a CSV file into the temporary directory and returns its path.
    /// </summary>
    /// <param name="fileName">The file name to create.</param>
    /// <param name="lines">The lines to write.</param>
    /// <returns>The full path of the created file.</returns>
    private string WriteCsv(string fileName, params string[] lines)
    {
        var path = Path.Combine(_tempDirectory, fileName);
        File.WriteAllLines(path, lines);
        return path;
    }

    /// <summary>
    ///     Builds a data row for the five-column header.
    /// </summary>
    /// <param name="sourceText">The English source text.</param>
    /// <param name="targetText">The Finnish target text.</param>
    /// <param name="hashtag">The hashtag column value.</param>
    /// <returns>A quoted CSV row.</returns>
    private static string FiveColumnRow(string sourceText, string targetText, string hashtag = "#x")
    {
        return $"\"English\",\"{sourceText}\",\"Finnish\",\"{targetText}\",\"{hashtag}\"";
    }

    /// <summary>
    ///     Verifies a well-formed five-column translations file is loaded with entries and languages.
    /// </summary>
    [Fact]
    public void LoadTranslationEntriesFromCsv_FiveColumnFile_ReturnsParsedEntries()
    {
        // Given: a five-column CSV file with three data rows
        var path = WriteCsv(
            "translations.csv",
            FiveColumnHeader,
            FiveColumnRow("abdomen", "vatsa/vatsan alue", "#anatomy"),
            FiveColumnRow("abet", "avustaa", "#action"),
            FiveColumnRow("ably", "taidokkaasti", "#adverb"));

        // When: loading the entries
        var sut = TranslationEntryLoader.LoadTranslationEntriesFromCsv(path);

        // Then: all rows and both languages are present
        sut.Count.ShouldBe(3);
        sut.IsTranslationEntryTranslations.ShouldBeTrue();
        sut.VoiceLanguages.Count.ShouldBe(2);
        sut.VoiceLanguages[0].LanguageName.ShouldBe("English");
        sut.VoiceLanguages[1].LanguageName.ShouldBe("Finnish");
        sut[0][0].Text.ShouldBe("abdomen");
        sut[0][1].Text.ShouldBe("vatsa/vatsan alue");
        sut[2][1].Text.ShouldBe("taidokkaasti");
    }

    /// <summary>
    ///     Verifies that a file containing only a header yields an empty entry list.
    /// </summary>
    [Fact]
    public void LoadTranslationEntriesFromCsv_HeaderOnlyFile_ReturnsEmptyList()
    {
        // Given: a CSV file that only contains the header
        var path = WriteCsv("translations.csv", FiveColumnHeader);

        // When: loading the entries
        var sut = TranslationEntryLoader.LoadTranslationEntriesFromCsv(path);

        // Then: no entries and no voice languages are reported
        sut.Count.ShouldBe(0);
        sut.VoiceLanguages.Count.ShouldBe(0);
    }

    /// <summary>
    ///     Verifies that a missing file (whose name cannot be resolved by the finder) yields an empty list.
    /// </summary>
    [Fact]
    public void LoadTranslationEntriesFromCsv_MissingFile_ReturnsEmptyList()
    {
        // Given: a path that does not exist and is not named "translations.csv"
        var path = Path.Combine(_tempDirectory, "missing.csv");

        // When: loading the entries
        var sut = TranslationEntryLoader.LoadTranslationEntriesFromCsv(path);

        // Then: the loader returns an empty list rather than throwing
        sut.Count.ShouldBe(0);
        sut.VoiceLanguages.Count.ShouldBe(0);
    }

    /// <summary>
    ///     Verifies that a positive starting line number skips the earlier rows.
    /// </summary>
    [Fact]
    public void LoadTranslationEntriesFromCsv_StartingLineNumber_SkipsEarlierRows()
    {
        // Given: a header plus six data rows
        var path = WriteCsv(
            "translations.csv",
            FiveColumnHeader,
            FiveColumnRow("w1", "s1"),
            FiveColumnRow("w2", "s2"),
            FiveColumnRow("w3", "s3"),
            FiveColumnRow("w4", "s4"),
            FiveColumnRow("w5", "s5"),
            FiveColumnRow("w6", "s6"));

        // When: starting from line number three (absolute, header excluded from the result)
        var sut = TranslationEntryLoader.LoadTranslationEntriesFromCsv(path, 3);

        // Then: the first three rows are skipped
        sut.Count.ShouldBe(4);
        sut[0][0].Text.ShouldBe("w3");
        sut[3][1].Text.ShouldBe("s6");
    }

    /// <summary>
    ///     Verifies that the compact colon header layout loads even with a single data row.
    /// </summary>
    [Fact]
    public void LoadTranslationEntriesFromCsv_ColonHeaderSingleRow_ReturnsOneEntry()
    {
        // Given: a compact two-column file with a single data row
        var path = WriteCsv("compact.csv", "Source:English, Target:French", "\"hello\",\"bonjour\"");

        // When: loading the entries
        var sut = TranslationEntryLoader.LoadTranslationEntriesFromCsv(path);

        // Then: one row with the two header languages is produced
        sut.Count.ShouldBe(1);
        sut.IsTranslationEntryTranslations.ShouldBeFalse();
        sut[0][0].Language.LanguageName.ShouldBe("English");
        sut[0][0].Text.ShouldBe("hello");
        sut[0][1].Language.LanguageName.ShouldBe("French");
        sut[0][1].Text.ShouldBe("bonjour");
    }
}
