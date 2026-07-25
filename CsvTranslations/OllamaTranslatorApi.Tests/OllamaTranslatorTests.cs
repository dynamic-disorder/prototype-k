using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;

using NSubstitute;

using OllamaTranslatorApi.Configuration;
using OllamaTranslatorApi.Core;
using OllamaTranslatorApi.Models;

using Shouldly;

namespace OllamaTranslatorApi.Tests;

public sealed class OllamaTranslatorTests
{
    private readonly ITranslationService _translationService;
    private readonly OllamaTranslator _sut;

    public OllamaTranslatorTests()
    {
        _translationService = Substitute.For<ITranslationService>();
        _translationService.GetLlmModelName().Returns("TestModel");
        _sut = new OllamaTranslator(_translationService);
    }

    // -------------------------------------------------------------------------
    // TestTranslationService contract
    // -------------------------------------------------------------------------

    [Fact]
    public async Task TranslationService_KnownText_ReturnsExpectedTranslation()
    {
        // Given: a hand-written test fake
        var service = new TestTranslationService();

        // When: translating a known word
        var result = await service.TranslateAsync(new TranslationRequest("Hello"));

        // Then: the predefined translation is returned
        result.TranslatedText.ShouldBe("Hola");
    }

    [Fact]
    public async Task TranslationService_SpecialCaseText_ReturnsMockIndicator()
    {
        // Given: a hand-written test fake
        var service = new TestTranslationService();

        // When: translating the special "Unknown" sentinel
        var result = await service.TranslateAsync(new TranslationRequest("Unknown"));

        // Then: the mock indicator is returned
        result.TranslatedText.ShouldBe("MockTranslation:Unknown");
    }

    // -------------------------------------------------------------------------
    // OllamaUrl
    // -------------------------------------------------------------------------

    [Fact]
    public void OllamaUrl_DefaultSettings_ReturnsDefaultApiUrl()
    {
        // Given: a translator constructed with default settings (no explicit settings provided)

        // When: reading the API URL
        var url = _sut.OllamaUrl;

        // Then: the default Ollama endpoint is returned
        url.ShouldBe("http://localhost:11434/api/generate");
    }

    [Fact]
    public void OllamaUrl_CustomSettings_ReturnsConfiguredUrl()
    {
        // Given: settings with a custom API URL
        var settings = new OllamaTranslatorSettings { ApiUrl = "http://custom-host:5000/api/generate" };
        var sut = new OllamaTranslator(_translationService, settings);

        // When: reading the API URL
        var url = sut.OllamaUrl;

        // Then: the configured URL is returned
        url.ShouldBe("http://custom-host:5000/api/generate");
    }

    // -------------------------------------------------------------------------
    // OllamaLlmModelName
    // -------------------------------------------------------------------------

    [Fact]
    public void OllamaLlmModelName_WithService_DelegatesGetLlmModelNameToService()
    {
        // Given: a service configured to return a specific model name
        _translationService.GetLlmModelName().Returns("my-model:7b");

        // When: reading the model name from the translator
        var modelName = _sut.OllamaLlmModelName;

        // Then: the service's model name is returned
        modelName.ShouldBe("my-model:7b");
    }

    // -------------------------------------------------------------------------
    // TranslateAsync
    // -------------------------------------------------------------------------

    [Fact]
    public async Task TranslateAsync_KnownText_ReturnsEntryWithTargetText()
    {
        // Given: a service that returns a plain translation response
        _translationService.TranslateAsync(Arg.Any<TranslationRequest>()).Returns(new TranslationResponse("Hola"));

        // When: translating a single word
        var result = await _sut.TranslateAsync("Hello");

        // Then: the entry contains the translated text and the original source
        result.ShouldNotBeNull();
        result.SourceText.ShouldBe("Hello");
        result.TargetText.ShouldBe("Hola");
    }

    [Fact]
    public async Task TranslateAsync_ResponseWithHashtags_PopulatesBothTargetTextAndHashtags()
    {
        // Given: a service that returns a structured response with translation and hashtags
        _translationService.TranslateAsync(Arg.Any<TranslationRequest>()).Returns(new TranslationResponse("koira", "#noun #animal"));

        // When: translating
        var result = await _sut.TranslateAsync("dog");

        // Then: the pipe is used as a delimiter and both parts are stored separately
        result.TargetText.ShouldBe("koira");
        result.Hashtags.ShouldBe("#noun #animal");
    }

    [Fact]
    public async Task TranslateAsync_EmptyServiceResponse_ReturnsEntryWithEmptyTargetText()
    {
        // Given: a service that returns an empty response (e.g. after a failed HTTP call)
        _translationService.TranslateAsync(Arg.Any<TranslationRequest>()).Returns(TranslationResponse.Empty);

        // When: translating
        var result = await _sut.TranslateAsync("Hello");

        // Then: the entry is returned unchanged with no TargetText applied
        result.TargetText.ShouldBe(string.Empty);
    }

    [Fact]
    public async Task TranslateAsync_CustomPromptOverride_ForwardsPromptToService()
    {
        // Given: a custom prompt template
        const string customPrompt = "Translate '{text}' to German. Return only the word.";
        _translationService.TranslateAsync(Arg.Any<TranslationRequest>()).Returns(new TranslationResponse("Hallo"));

        // When: translating with the custom prompt
        await _sut.TranslateAsync("Hello", customPrompt);

        // Then: the prompt is forwarded to the service exactly as provided
        await _translationService.Received(1).TranslateAsync(
            Arg.Is<TranslationRequest>(r => r.Text == "Hello" && r.Prompt == customPrompt));
    }

    [Fact]
    public async Task TranslateAsync_DefaultPromptFromSettings_UsedWhenNoPromptProvided()
    {
        // Given: a translator configured with a default prompt in settings
        const string defaultPrompt = "Translate '{text}' to French.";
        var settings = new OllamaTranslatorSettings { Prompt = defaultPrompt };
        var sut = new OllamaTranslator(_translationService, settings);
        _translationService.TranslateAsync(Arg.Any<TranslationRequest>()).Returns(new TranslationResponse("Bonjour"));

        // When: translating without an explicit per-call prompt
        await sut.TranslateAsync("Hello");

        // Then: the settings prompt is forwarded to the service
        await _translationService.Received(1).TranslateAsync(
            Arg.Is<TranslationRequest>(r => r.Prompt == defaultPrompt));
    }

    // -------------------------------------------------------------------------
    // BatchTranslateAsync
    // -------------------------------------------------------------------------

    [Fact]
    public async Task BatchTranslateAsync_EmptyList_ReturnsEmptyListWithoutCallingService()
    {
        // Given: an empty list of entries

        // When: batch translating
        var result = await _sut.BatchTranslateAsync([]);

        // Then: the result is empty and no service calls were made
        result.ShouldNotBeNull();
        result.ShouldBeEmpty();
        _ = _translationService.DidNotReceive().TranslateAsync(Arg.Any<TranslationRequest>());
    }

    [Fact]
    public async Task BatchTranslateAsync_MultipleEntries_TranslatesAll()
    {
        // Given: entries with per-text service stubs
        _translationService.TranslateAsync(Arg.Is<TranslationRequest>(r => r.Text == "Hello")).Returns(new TranslationResponse("Hola"));
        _translationService.TranslateAsync(Arg.Is<TranslationRequest>(r => r.Text == "World")).Returns(new TranslationResponse("Mundo"));
        _translationService.TranslateAsync(Arg.Is<TranslationRequest>(r => r.Text == "Test")).Returns(new TranslationResponse("Prueba"));
        var entries = new List<CsvEntry>
        {
            new() { SourceText = "Hello" },
            new() { SourceText = "World" },
            new() { SourceText = "Test" }
        };

        // When: batch translating
        var translated = await _sut.BatchTranslateAsync(entries);

        // Then: all entries are translated (order not guaranteed with parallel execution)
        translated.ShouldNotBeNull();
        translated.Count.ShouldBe(3);
        translated.ShouldContain(e => e.SourceText == "Hello" && e.TargetText == "Hola");
        translated.ShouldContain(e => e.SourceText == "World" && e.TargetText == "Mundo");
        translated.ShouldContain(e => e.SourceText == "Test" && e.TargetText == "Prueba");
    }

    [Fact]
    public async Task BatchTranslateAsync_ServiceThrowsForOneEntry_OtherEntriesStillTranslated()
    {
        // Given: a service that returns normally for one entry but throws for another
        _translationService.TranslateAsync(Arg.Is<TranslationRequest>(r => r.Text == "Hello")).Returns(new TranslationResponse("Hola"));
        _translationService.TranslateAsync(Arg.Is<TranslationRequest>(r => r.Text == "Bad"))
            .Returns(Task.FromException<TranslationResponse>(new HttpRequestException("Connection refused")));
        var entries = new List<CsvEntry>
        {
            new() { SourceText = "Hello" },
            new() { SourceText = "Bad" }
        };

        // When: batch translating
        var result = await _sut.BatchTranslateAsync(entries);

        // Then: both entries are included; the failed entry retains its original empty TargetText
        result.Count.ShouldBe(2);
        result.ShouldContain(e => e.SourceText == "Hello" && e.TargetText == "Hola");
        result.ShouldContain(e => e.SourceText == "Bad" && e.TargetText == string.Empty);
    }

    [Fact]
    public async Task BatchTranslateAsync_WithMaxParallelism_AllEntriesTranslated()
    {
        // Given: 10 entries and a service that handles any request
        _translationService.TranslateAsync(Arg.Any<TranslationRequest>()).Returns(new TranslationResponse("käännös"));
        var entries = Enumerable.Range(1, 10)
            .Select(i => new CsvEntry { SourceText = $"Text {i}" })
            .ToList();

        // When: translating with reduced max parallelism
        var translated = await _sut.BatchTranslateAsync(entries, maxParallelTasks: 3);

        // Then: all 10 entries are present with translations
        translated.Count.ShouldBe(10);
        translated.ShouldAllBe(e => e.TargetText == "käännös");
    }

    [Fact]
    public async Task BatchTranslateAsync_SingleEntry_TranslatesEntry()
    {
        // Given: a single entry
        _translationService.TranslateAsync(Arg.Any<TranslationRequest>()).Returns(new TranslationResponse("kissa"));
        var entries = new List<CsvEntry> { new() { SourceText = "cat" } };

        // When: batch translating
        var translated = await _sut.BatchTranslateAsync(entries);

        // Then: the single entry is translated
        translated.Count.ShouldBe(1);
        translated[0].TargetText.ShouldBe("kissa");
    }

    // -------------------------------------------------------------------------
    // ProcessCsvAsync
    // -------------------------------------------------------------------------

    [Fact]
    public async Task ProcessCsvAsync_ValidCsvFile_CreatesOutputWithTranslatedContent()
    {
        // Given: a mock service and a temp CSV with two source texts
        _translationService.TranslateAsync(Arg.Any<TranslationRequest>()).Returns(new TranslationResponse("käännös"));
        var (testInput, testOutput) = CreateTempInputOutputCsv("SourceText,TargetText,Hashtags\r\n\r\nhello,,\r\n\r\nworld,,\r\n\r\n");

        try
        {
            // When: processing the CSV
            await _sut.ProcessCsvAsync(testInput, testOutput);

            // Then: the output file is created and contains the source texts
            File.Exists(testOutput).ShouldBeTrue();
            var outputContent = await File.ReadAllTextAsync(testOutput);
            outputContent.ShouldContain("hello");
            outputContent.ShouldContain("world");
        }
        finally
        {
            DeleteIfExists(testInput);
            DeleteIfExists(testOutput);
        }
    }

    [Fact]
    public async Task ProcessCsvAsync_EmptyInputFile_CreatesEmptyOutputWithoutTranslating()
    {
        // Given: an empty input file (no CSV rows)
        var emptyInput = CreateTempEmptyFile();
        var emptyOutput = GetPathForFile($"empty_output_{Guid.NewGuid()}.csv");

        try
        {
            // When: processing the empty file
            await Should.NotThrowAsync(() => _sut.ProcessCsvAsync(emptyInput, emptyOutput));

            // Then: an output file is still created; no translation service calls were made
            File.Exists(emptyOutput).ShouldBeTrue();
            _ = _translationService.DidNotReceive().TranslateAsync(Arg.Any<TranslationRequest>());
        }
        finally
        {
            DeleteIfExists(emptyInput);
            DeleteIfExists(emptyOutput);
        }
    }

    [Fact]
    public async Task ProcessCsvAsync_NonExistentInput_ThrowsFileNotFoundException()
    {
        // Given: a path that does not exist on disk
        var nonExistentPath = GetPathForFile("DefinitelyNonexistentFile12345.csv");

        // When: processing the non-existent file
        var exception = await Should.ThrowAsync<FileNotFoundException>(
            () => _sut.ProcessCsvAsync(nonExistentPath, GetPathForFile("output.csv")));

        // Then: the exception message references the missing path
        exception.Message.ShouldContain(nonExistentPath);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private static (string inputPath, string outputPath) CreateTempInputOutputCsv(string content)
    {
        var input = GetPathForFile($"test_input_{Guid.NewGuid()}.csv");
        var output = GetPathForFile($"test_output_{Guid.NewGuid()}.csv");
        File.WriteAllText(input, content);
        return (input, output);
    }

    private static string GetPathForFile(string filename)
    {
        return Path.Combine(Path.GetTempPath(), filename);
    }

    private static string CreateTempEmptyFile()
    {
        var path = GetPathForFile($"empty_input_{Guid.NewGuid()}.csv");
        File.WriteAllText(path, string.Empty);
        return path;
    }

    private static void DeleteIfExists(string path)
    {
        try
        {
            if (File.Exists(path))
            {
                File.Delete(path);
            }
        }
        catch
        {
            // ignore cleanup failures in tests
        }
    }
}
