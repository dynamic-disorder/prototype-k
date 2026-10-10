using System.Text;

using OllamaTranslatorApi.Core;
using OllamaTranslatorApi.Models;
using OllamaTranslatorApi.Text;

using Shouldly;

namespace OllamaTranslatorApp.Tests;

/// <summary>
///     Tests for the real <see cref="TextFileTranslator" />: line-by-line translation,
///     empty/missing input handling, context propagation, prompt selection, and output writing.
/// </summary>
/// <remarks>
///     <see cref="OllamaTranslator.BatchTranslateAsync" /> translates entries in parallel, so the
///     order of written lines is not guaranteed. Assertions on output lines are therefore
///     order-insensitive and prompt/semantics checks look entries up by source text.
/// </remarks>
public sealed class TextFileTranslatorTests
{
    private const string CustomPrompt = "Translate: `{text}`. Custom instruction.";

    // ------------------------------------------------------------------------------ happy path

    [Fact]
    public async Task TranslateFileAsync_SimpleTextFile_TranslatesAllLines()
    {
        using var workspace = new TempWorkspace();
        string input = workspace.WriteFile("story.txt", "Hello\nWorld\nTest");
        string output = workspace.Combine("story.out.txt");
        TextFileTranslator sut = CreateSut(new TestTranslationService(), useContext: false);

        string result = await sut.TranslateFileAsync(input, output);

        result.ShouldStartWith("Done: 3 lines translated");
        File.Exists(output).ShouldBeTrue();
        (await File.ReadAllLinesAsync(output, Encoding.UTF8))
            .ShouldBe(["Hola", "Mundo", "Prueba"], ignoreOrder: true);
    }

    [Fact]
    public async Task TranslateFileAsync_OutputDirectoryMissing_CreatesIt()
    {
        using var workspace = new TempWorkspace();
        string input = workspace.WriteFile("story.txt", "Hello");
        string output = workspace.Combine("nested", "deeper", "out.txt");
        TextFileTranslator sut = CreateSut(new TestTranslationService(), useContext: false);

        await sut.TranslateFileAsync(input, output);

        Directory.Exists(Path.GetDirectoryName(output)!).ShouldBeTrue();
        File.Exists(output).ShouldBeTrue();
    }

    // ---------------------------------------------------------------------------- edge / failure

    [Fact]
    public async Task TranslateFileAsync_EmptyFile_ReturnsNoContentMessageAndWritesNothing()
    {
        using var workspace = new TempWorkspace();
        string input = workspace.WriteFile("empty.txt", string.Empty);
        string output = workspace.Combine("empty.translated.txt");
        TextFileTranslator sut = CreateSut(new TestTranslationService(), useContext: false);

        string result = await sut.TranslateFileAsync(input, output);

        result.ShouldContain("No content found");
        File.Exists(output).ShouldBeFalse();
    }

    [Fact]
    public async Task TranslateFileAsync_MissingInput_ThrowsFileNotFound()
    {
        using var workspace = new TempWorkspace();
        TextFileTranslator sut = CreateSut(new TestTranslationService(), useContext: false);

        await Should.ThrowAsync<FileNotFoundException>(
            () => sut.TranslateFileAsync(workspace.Combine("nope.txt"), workspace.Combine("out.txt")));
    }

    [Fact]
    public async Task TranslateFileAsync_TranslationThrows_FallsBackToSourceText()
    {
        using var workspace = new TempWorkspace();
        // TestTranslationService throws NotSupportedException for text it has no translation
        // for ("NotMapped"); the batch translator catches per-entry failures and keeps the
        // original entry, so the fallback writes the source text back out.
        string input = workspace.WriteFile("mixed.txt", "NotMapped\nHello");
        string output = workspace.Combine("mixed.out.txt");
        TextFileTranslator sut = CreateSut(new TestTranslationService(), useContext: false);

        await sut.TranslateFileAsync(input, output);

        (await File.ReadAllLinesAsync(output, Encoding.UTF8))
            .ShouldBe(["NotMapped", "Hola"], ignoreOrder: true);
    }

    // ----------------------------------------------------------------------------------- context

    [Fact]
    public async Task TranslateFileAsync_WithContext_PassesPreviousLineAsSemantics()
    {
        using var workspace = new TempWorkspace();
        string input = workspace.WriteFile("ctx.txt", "First line\nSecond line\nThird line");
        var recording = new RecordingTranslationService();
        TextFileTranslator sut = CreateSut(recording, useContext: true);

        await sut.TranslateFileAsync(input, workspace.Combine("ctx.out.txt"));

        recording.Requests.Count.ShouldBe(3);
        RequestFor(recording, "First line").Semantics.ShouldBeNullOrEmpty();
        RequestFor(recording, "Second line").Semantics.ShouldBe("First line");
        RequestFor(recording, "Third line").Semantics.ShouldBe("Second line");
    }

    [Fact]
    public async Task TranslateFileAsync_WithoutContext_PassesNoSemantics()
    {
        using var workspace = new TempWorkspace();
        string input = workspace.WriteFile("noctx.txt", "Line 1\nLine 2\nLine 3");
        var recording = new RecordingTranslationService();
        TextFileTranslator sut = CreateSut(recording, useContext: false);

        await sut.TranslateFileAsync(input, workspace.Combine("noctx.out.txt"));

        recording.Requests.Count.ShouldBe(3);
        recording.Requests.ShouldAllBe(r => string.IsNullOrEmpty(r.Semantics));
    }

    // ------------------------------------------------------------------------------------ prompts

    [Fact]
    public async Task TranslateFileAsync_CustomPrompt_IsForwardedVerbatim()
    {
        using var workspace = new TempWorkspace();
        string input = workspace.WriteFile("custom.txt", "Test");
        var recording = new RecordingTranslationService();
        TextFileTranslator sut = CreateSut(recording, useContext: false);

        await sut.TranslateFileAsync(input, workspace.Combine("custom.out.txt"), CustomPrompt);

        RequestFor(recording, "Test").Prompt.ShouldBe(CustomPrompt);
    }

    [Fact]
    public async Task TranslateFileAsync_NoCustomPromptWithoutContext_UsesNarrativeSimple()
    {
        using var workspace = new TempWorkspace();
        string input = workspace.WriteFile("simple.txt", "Test");
        var recording = new RecordingTranslationService();
        TextFileTranslator sut = CreateSut(recording, useContext: false);

        await sut.TranslateFileAsync(input, workspace.Combine("simple.out.txt"));

        RequestFor(recording, "Test").Prompt.ShouldBe("NarrativeSimple");
    }

    [Fact]
    public async Task TranslateFileAsync_NoCustomPromptWithContext_UsesNarrativeLineWithContext()
    {
        using var workspace = new TempWorkspace();
        string input = workspace.WriteFile("contextual.txt", "Test");
        var recording = new RecordingTranslationService();
        TextFileTranslator sut = CreateSut(recording, useContext: true);

        await sut.TranslateFileAsync(input, workspace.Combine("contextual.out.txt"));

        RequestFor(recording, "Test").Prompt.ShouldBe("NarrativeLineWithContext");
    }

    // ------------------------------------------------------------------------------------ helpers

    private static TextFileTranslator CreateSut(ITranslationService service, bool useContext)
        => new(new OllamaTranslator(service), useContext);

    private static TranslationRequest RequestFor(RecordingTranslationService recording, string sourceText)
        => recording.Requests.Single(r => r.Text == sourceText);
}
