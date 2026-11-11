using OllamaTranslatorApi.Core;

using Shouldly;
using Spectre.Console;

namespace OllamaTranslatorApp.Tests;

/// <summary>
///     Tests for the real <see cref="Program" /> helpers: target-path generation, request
///     validation, source/folder expansion, and CSV-vs-text routing.
/// </summary>
/// <remarks>
///     These helpers were previously exercised only by a hand-copied duplicate of their
///     logic. They are <c>internal static</c> so the tests can call the actual code;
///     <c>OllamaTranslatorApp.csproj</c> exposes internals to this assembly.
/// </remarks>
public sealed class ProgramTests
{
    // ---------------------------------------------------------------- GenerateTargetFilePath

    /// <summary>
    ///     Verifies CSV keeps its own extension while every text extension, in any casing, becomes
    ///     .translated.txt.
    /// </summary>
    [Theory]
    [InlineData("test.csv", ".translated.csv")]
    [InlineData("test.txt", ".translated.txt")]
    [InlineData("test.md", ".translated.txt")]
    [InlineData("test.text", ".translated.txt")]
    [InlineData("test.TXT", ".translated.txt")]
    public void GenerateTargetFilePath_SupportedExtensions_ReturnsCorrectExtension(string inputName, string expectedSuffix)
    {
        string result = TranslateCommand.GenerateTargetFilePath(inputName);

        Path.GetFileName(result).ShouldBe(Path.GetFileNameWithoutExtension(inputName) + expectedSuffix);
    }

    /// <summary>
    ///     Verifies the generated target path stays in the source file's directory.
    /// </summary>
    [Fact]
    public void GenerateTargetFilePath_WithDirectory_PreservesDirectory()
    {
        string source = Path.Combine("some", "dir", "story.txt");

        string result = TranslateCommand.GenerateTargetFilePath(source);

        result.ShouldBe(Path.Combine("some", "dir", "story.translated.txt"));
    }

    /// <summary>
    ///     Verifies a CSV file inside a directory keeps the .translated.csv suffix.
    /// </summary>
    [Fact]
    public void GenerateTargetFilePath_CsvInDirectory_KeepsCsvSuffix()
    {
        string source = Path.Combine("data", "words.csv");

        string result = TranslateCommand.GenerateTargetFilePath(source);

        result.ShouldBe(Path.Combine("data", "words.translated.csv"));
    }

    // ------------------------------------------------------------- ValidateTranslationFileRequest

    /// <summary>
    ///     Verifies an existing file with a supported extension passes validation.
    /// </summary>
    [Fact]
    public void ValidateTranslationFileRequest_ExistingSupportedFile_ReturnsTrue()
    {
        using var workspace = new TempWorkspace();
        string source = workspace.WriteFile("story.txt", "Hello");

        TranslateCommand.ValidateTranslationFileRequest(new TranslationFileRequest(source, workspace.Combine("out.txt")))
            .ShouldBeTrue();
    }

    /// <summary>
    ///     Verifies an existing file with an unknown extension is accepted with a warning rather than
    ///     rejected.
    /// </summary>
    [Fact]
    public void ValidateTranslationFileRequest_ExistingUnknownExtension_ReturnsTrueWithWarning()
    {
        using var workspace = new TempWorkspace();
        string source = workspace.WriteFile("story.xyz", "Hello");

        TranslateCommand.ValidateTranslationFileRequest(new TranslationFileRequest(source, workspace.Combine("out.xyz")))
            .ShouldBeTrue();
    }

    /// <summary>
    ///     Verifies a request whose source file does not exist is rejected.
    /// </summary>
    [Fact]
    public void ValidateTranslationFileRequest_MissingSourceFile_ReturnsFalse()
    {
        using var workspace = new TempWorkspace();

        TranslateCommand.ValidateTranslationFileRequest(new TranslationFileRequest(workspace.Combine("nope.txt"), "out.txt"))
            .ShouldBeFalse();
    }

    /// <summary>
    ///     Verifies a request with a blank source or target path is rejected.
    /// </summary>
    [Theory]
    [InlineData("", "out.txt")]
    [InlineData("   ", "out.txt")]
    [InlineData("in.txt", "")]
    [InlineData("in.txt", "   ")]
    public void ValidateTranslationFileRequest_BlankPath_ReturnsFalse(string sourcePath, string targetPath)
    {
        TranslateCommand.ValidateTranslationFileRequest(new TranslationFileRequest(sourcePath, targetPath))
            .ShouldBeFalse();
    }

    // ---------------------------------------------------------------- BuildTranslationFileRequests

    /// <summary>
    ///     Verifies a positional source and target pair becomes exactly one request with both paths
    ///     unchanged.
    /// </summary>
    [Fact]
    public void BuildTranslationFileRequests_SingleFilePair_ReturnsOneRequest()
    {
        var settings = new TranslateSettings { Source = "source.txt", Target = "target.txt" };

        List<TranslationFileRequest> requests = TranslateCommand.BuildTranslationFileRequests(settings);

        requests.Count.ShouldBe(1);
        requests[0].SourcePath.ShouldBe("source.txt");
        requests[0].TargetPath.ShouldBe("target.txt");
    }

    /// <summary>
    ///     Verifies folder mode picks up only the supported file types and skips the rest.
    /// </summary>
    [Fact]
    public void BuildTranslationFileRequests_Folder_ExpandsSupportedFilesOnly()
    {
        using var workspace = new TempWorkspace();
        workspace.WriteFile("words.csv", "a,b");
        workspace.WriteFile("story.txt", "a");
        workspace.WriteFile("doc.md", "a");
        workspace.WriteFile("notes.text", "a");
        workspace.WriteFile("ignored.json", "{}");

        List<TranslationFileRequest> requests = TranslateCommand.BuildTranslationFileRequests(
            new TranslateSettings { Folder = workspace.Path });

        requests.Count.ShouldBe(4);
        requests.ShouldContain(r => r.SourcePath.EndsWith("words.csv", StringComparison.Ordinal));
        requests.ShouldContain(r => r.SourcePath.EndsWith("story.txt", StringComparison.Ordinal));
        requests.ShouldContain(r => r.SourcePath.EndsWith("doc.md", StringComparison.Ordinal));
        requests.ShouldContain(r => r.SourcePath.EndsWith("notes.text", StringComparison.Ordinal));
    }

    /// <summary>
    ///     Verifies folder mode derives each target path beside its source file.
    /// </summary>
    [Fact]
    public void BuildTranslationFileRequests_Folder_GeneratesTargetPathsBesideSources()
    {
        using var workspace = new TempWorkspace();
        workspace.WriteFile("story.txt", "a");

        TranslationFileRequest request = TranslateCommand.BuildTranslationFileRequests(
            new TranslateSettings { Folder = workspace.Path }).Single();

        request.TargetPath.ShouldBe(workspace.Combine("story.translated.txt"));
    }

    /// <summary>
    ///     Verifies a folder that does not exist yields no requests.
    /// </summary>
    [Fact]
    public void BuildTranslationFileRequests_MissingFolder_ReturnsEmpty()
    {
        using var workspace = new TempWorkspace();

        List<TranslationFileRequest> requests = TranslateCommand.BuildTranslationFileRequests(
            new TranslateSettings { Folder = workspace.Combine("does-not-exist") });

        requests.ShouldBeEmpty();
    }

    // ------------------------------------------------------------------ TranslateSettings.Validate

    /// <summary>
    ///     Verifies a complete source and target pair is accepted.
    /// </summary>
    [Fact]
    public void Validate_SourceAndTargetProvided_ReturnsSuccess()
    {
        // Given: a complete source/target pair and no folder
        var sut = new TranslateSettings { Source = "input.csv", Target = "output.csv" };

        // When: the settings validate themselves
        ValidationResult result = sut.Validate();

        // Then: the pair is accepted
        result.Successful.ShouldBeTrue();
    }

    /// <summary>
    ///     Verifies folder mode alone is accepted without positional file arguments.
    /// </summary>
    [Fact]
    public void Validate_FolderProvidedAlone_ReturnsSuccess()
    {
        // Given: a folder and no positional file pair
        var sut = new TranslateSettings { Folder = "some-folder" };

        // When: the settings validate themselves
        ValidationResult result = sut.Validate();

        // Then: folder mode is accepted
        result.Successful.ShouldBeTrue();
    }

    /// <summary>
    ///     Verifies missing or half-supplied file arguments produce an actionable error.
    /// </summary>
    [Theory]
    [InlineData("", "", null)]
    [InlineData("only-source.csv", "", null)]
    [InlineData("", "only-target.csv", null)]
    [InlineData("", "", "")]
    [InlineData("", "", "   ")]
    public void Validate_NoFolderAndIncompleteFilePair_ReturnsError(string source, string target, string? folder)
    {
        // Given: neither a folder nor a complete source/target pair
        var sut = new TranslateSettings { Source = source, Target = target, Folder = folder };

        // When: the settings validate themselves
        ValidationResult result = sut.Validate();

        // Then: the parameters are rejected with an actionable message
        result.Successful.ShouldBeFalse();
        result.Message.ShouldNotBeNullOrWhiteSpace();
    }

    /// <summary>
    ///     Verifies combining a folder with positional file arguments is rejected as ambiguous.
    /// </summary>
    [Theory]
    [InlineData("source.csv", "")]
    [InlineData("", "target.csv")]
    [InlineData("source.csv", "target.csv")]
    public void Validate_FolderAndFileArgumentsTogether_ReturnsError(string source, string target)
    {
        // Given: a folder combined with positional file arguments
        var sut = new TranslateSettings { Source = source, Target = target, Folder = "some-folder" };

        // When: the settings validate themselves
        ValidationResult result = sut.Validate();

        // Then: the ambiguous combination is rejected
        result.Successful.ShouldBeFalse();
        result.Message.ShouldNotBeNullOrWhiteSpace();
    }

    // ------------------------------------------------------------------------ TranslateFileAsync

    /// <summary>
    ///     Verifies a .txt file is translated line by line through the text translator.
    /// </summary>
    [Fact]
    public async Task TranslateFileAsync_TextFile_RoutesToTextTranslator()
    {
        using var workspace = new TempWorkspace();
        string source = workspace.WriteFile("story.txt", "Hello\nWorld");
        string target = workspace.Combine("story.translated.txt");
        var translator = new OllamaTranslator(new TestTranslationService());

        string result = await TranslateCommand.TranslateFileAsync(translator, source, target);

        result.ShouldContain("lines translated");
        File.Exists(target).ShouldBeTrue();

        string[] lines = await File.ReadAllLinesAsync(target);
        lines.ShouldBe(["Hola", "Mundo"], ignoreOrder: true);
    }

    /// <summary>
    ///     Verifies a .csv file is translated through the CSV translator and both rows keep their
    ///     translations.
    /// </summary>
    [Fact]
    public async Task TranslateFileAsync_CsvFile_RoutesToCsvTranslator()
    {
        using var workspace = new TempWorkspace();
        // CSV fixtures need CRLF: CsvHelper is configured with NewLine = "\r\n".
        string source = workspace.WriteFile(
            "input.csv",
            "\"SourceText\",\"TargetText\"\n\"Hello\",\"\"\n\"World\",\"\"\n",
            newLine: "\r\n");
        string target = workspace.Combine("input.translated.csv");
        var translator = new OllamaTranslator(new TestTranslationService());

        string result = await TranslateCommand.TranslateFileAsync(translator, source, target);

        result.ShouldContain("results saved");
        File.Exists(target).ShouldBeTrue();

        string written = await File.ReadAllTextAsync(target);
        written.ShouldContain("Hola");
        written.ShouldContain("Mundo");
    }

    /// <summary>
    ///     Verifies a .md file takes the text route and writes the translated line.
    /// </summary>
    [Fact]
    public async Task TranslateFileAsync_MarkdownFile_RoutesToTextTranslator()
    {
        using var workspace = new TempWorkspace();
        string source = workspace.WriteFile("doc.md", "Hello");
        string target = workspace.Combine("doc.translated.txt");
        var translator = new OllamaTranslator(new TestTranslationService());

        string result = await TranslateCommand.TranslateFileAsync(translator, source, target);

        result.ShouldContain("lines translated");
        (await File.ReadAllTextAsync(target)).Trim().ShouldBe("Hola");
    }
}
