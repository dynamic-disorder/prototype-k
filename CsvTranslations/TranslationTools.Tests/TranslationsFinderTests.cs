using Shouldly;

using TranslationTools;

namespace TranslationTools.Tests;

/// <summary>
///     Tests for <see cref="TranslationsFinder" /> covering path resolution, settings lookup
///     and reading the header/data lines from a translations CSV file.
/// </summary>
public sealed class TranslationsFinderTests : IDisposable
{
    private readonly string _tempDirectory;

    /// <summary>
    ///     Creates an isolated temporary directory for each test run.
    /// </summary>
    public TranslationsFinderTests()
    {
        _tempDirectory = Path.Combine(Path.GetTempPath(), "TranslationToolsFinderTests", Guid.NewGuid().ToString("N"));
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
    ///     Writes a file into the temporary directory and returns its path.
    /// </summary>
    /// <param name="fileName">The file name to create.</param>
    /// <param name="lines">The lines to write.</param>
    /// <returns>The full path of the created file.</returns>
    private string WriteFile(string fileName, params string[] lines)
    {
        var path = Path.Combine(_tempDirectory, fileName);
        File.WriteAllLines(path, lines);
        return path;
    }

    /// <summary>
    ///     Verifies an existing file path is returned unchanged.
    /// </summary>
    [Fact]
    public void FindTranslationsCsvFilepath_ExistingFile_ReturnsSamePath()
    {
        // Given: an existing CSV file
        var path = WriteFile("any-name.csv", "a,b", "1,2");
        var sut = new TranslationsFinder();

        // When: resolving the translations file path
        var actual = sut.FindTranslationsCsvFilepath(path);

        // Then: the path is returned as-is
        actual.ShouldBe(path);
    }

    /// <summary>
    ///     Documents the actual behaviour: a missing path that is not named "translations.csv"
    ///     is returned unchanged without an existence check.
    /// </summary>
    [Fact]
    public void FindTranslationsCsvFilepath_MissingNonTranslationPath_ReturnsPathUnchanged()
    {
        // Given: a path that does not exist and does not contain "translations.csv"
        var path = Path.Combine(_tempDirectory, "absent.csv");
        var sut = new TranslationsFinder();

        // When: resolving the translations file path
        var actual = sut.FindTranslationsCsvFilepath(path);

        // Then: the non-existent path is echoed back
        File.Exists(path).ShouldBeFalse();
        actual.ShouldBe(path);
    }

    /// <summary>
    ///     Verifies that reading a missing file yields an empty parse result.
    /// </summary>
    [Fact]
    public void GetTranslationsLines_MissingFile_ReturnsEmptyResult()
    {
        // Given: a path that does not exist
        var path = Path.Combine(_tempDirectory, "absent.csv");

        // When: reading the translations lines
        var actual = TranslationsFinder.GetTranslationsLines(path);

        // Then: the result is empty
        actual.HeaderLine.ShouldBeEmpty();
        actual.CsvLines.ShouldBeEmpty();
        actual.HasLines.ShouldBeFalse();
    }

    /// <summary>
    ///     Verifies that by default the header is separated from the data lines.
    /// </summary>
    [Fact]
    public void GetTranslationsLines_DefaultStartingLine_ReturnsHeaderAndAllDataLines()
    {
        // Given: a file with one header and three data lines
        var path = WriteFile("data.csv", "header", "one", "two", "three");

        // When: reading the translations lines with the default starting line
        var actual = TranslationsFinder.GetTranslationsLines(path);

        // Then: the header is isolated from the data
        actual.HeaderLine.ShouldBe("header");
        actual.CsvLines.ShouldBe(["one", "two", "three"]);
        actual.HasLines.ShouldBeTrue();
    }

    /// <summary>
    ///     Verifies that a positive starting line number skips the preceding lines while
    ///     keeping the original header.
    /// </summary>
    [Fact]
    public void GetTranslationsLines_PositiveStartingLine_SkipsEarlierLinesButKeepsHeader()
    {
        // Given: a file with one header and three data lines
        var path = WriteFile("data.csv", "header", "one", "two", "three");

        // When: starting from absolute line number two
        var actual = TranslationsFinder.GetTranslationsLines(path, 2);

        // Then: only the lines from index two onwards are returned
        actual.HeaderLine.ShouldBe("header");
        actual.CsvLines.ShouldBe(["two", "three"]);
    }

    /// <summary>
    ///     Verifies that a starting line beyond the end of the file falls back to all lines.
    /// </summary>
    [Fact]
    public void GetTranslationsLines_StartingLineBeyondEnd_ReturnsAllLines()
    {
        // Given: a file with one header and three data lines
        var path = WriteFile("data.csv", "header", "one", "two", "three");

        // When: asking for a line number past the end of the file
        var actual = TranslationsFinder.GetTranslationsLines(path, 99);

        // Then: the fallback returns the header plus every data line
        actual.HeaderLine.ShouldBe("header");
        actual.CsvLines.ShouldBe(["one", "two", "three"]);
    }

    /// <summary>
    ///     Verifies that an empty file yields an empty parse result.
    /// </summary>
    [Fact]
    public void GetTranslationsLines_EmptyFile_ReturnsEmptyResult()
    {
        // Given: an empty file
        var path = WriteFile("empty.csv");

        // When: reading the translations lines
        var actual = TranslationsFinder.GetTranslationsLines(path);

        // Then: no header or data lines are reported
        actual.HeaderLine.ShouldBeEmpty();
        actual.CsvLines.ShouldBeEmpty();
        actual.HasLines.ShouldBeFalse();
    }
}
