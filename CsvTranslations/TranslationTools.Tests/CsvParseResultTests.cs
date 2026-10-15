using Shouldly;

using TranslationTools;

namespace TranslationTools.Tests;

/// <summary>
///     Tests for <see cref="CsvParseResult" /> covering the stored values, HasLines and deconstruction.
/// </summary>
public sealed class CsvParseResultTests
{
    /// <summary>
    ///     Verifies the constructor stores the header and lines and reports them via HasLines.
    /// </summary>
    [Fact]
    public void Constructor_WithLines_ExposesHeaderAndLines()
    {
        // Given/When: a result with a header and two lines
        var sut = new CsvParseResult("header", ["one", "two"]);

        // Then: the values are exposed unchanged
        sut.HeaderLine.ShouldBe("header");
        sut.CsvLines.ShouldBe(["one", "two"]);
        sut.HasLines.ShouldBeTrue();
    }

    /// <summary>
    ///     Verifies an empty result reports HasLines as false.
    /// </summary>
    [Fact]
    public void Constructor_WithoutLines_ReportsNoLines()
    {
        // Given/When: a result with no lines
        var sut = new CsvParseResult(string.Empty, []);

        // Then: the emptiness is reported
        sut.HeaderLine.ShouldBeEmpty();
        sut.CsvLines.ShouldBeEmpty();
        sut.HasLines.ShouldBeFalse();
    }

    /// <summary>
    ///     Verifies deconstruction yields the header and the lines.
    /// </summary>
    [Fact]
    public void Deconstruct_ReturnsHeaderAndLines()
    {
        // Given: a populated result
        var sut = new CsvParseResult("header", ["one"]);

        // When: deconstructing it
        var (headerLine, csvLines) = sut;

        // Then: both components match the stored values
        headerLine.ShouldBe("header");
        csvLines.ShouldBe(["one"]);
    }
}

/// <summary>
///     Tests for <see cref="LanguageExtractionResult" /> covering the stored language arrays.
/// </summary>
public sealed class LanguageExtractionResultTests
{
    /// <summary>
    ///     Verifies the constructor stores the source and target language arrays.
    /// </summary>
    [Fact]
    public void Constructor_StoresSourceAndTargetLanguages()
    {
        // Given/When: a result built from source and target arrays
        var sut = new LanguageExtractionResult(["English"], ["Finnish", "Swedish"]);

        // Then: both arrays are exposed unchanged
        sut.SourceLanguages.ShouldBe(["English"]);
        sut.TargetLanguages.ShouldBe(["Finnish", "Swedish"]);
    }
}
