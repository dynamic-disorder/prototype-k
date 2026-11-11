using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;

using FakeItEasy;

using OllamaTranslatorApi.Configuration;
using OllamaTranslatorApi.Core;
using OllamaTranslatorApi.Models;

using Shouldly;

namespace OllamaTranslatorApi.Tests;

/// <summary>
///     Tests for <see cref="OllamaTranslator" />: prompt selection, single and batch
///     translation, order preservation under parallelism, and CSV file processing.
/// </summary>
public sealed class OllamaTranslatorTests
{
    private readonly ITranslationService _translationService;
    private readonly OllamaTranslator _sut;

    public OllamaTranslatorTests()
    {
        _translationService = A.Fake<ITranslationService>();
        A.CallTo(() => _translationService.GetLlmModelName()).Returns("TestModel");
        _sut = new OllamaTranslator(_translationService);
    }

    // -------------------------------------------------------------------------
    // TestTranslationService contract
    // -------------------------------------------------------------------------

    /// <summary>
    ///     Verifies the hand-written test service maps a known word to its fixed translation, so the other
    ///     tests rest on a sound stub.
    /// </summary>
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

    /// <summary>
    ///     Verifies the test service marks its special sentinel text with a mock translation prefix.
    /// </summary>
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

    /// <summary>
    ///     Verifies a translator built without settings points at the stock local Ollama endpoint.
    /// </summary>
    [Fact]
    public void OllamaUrl_DefaultSettings_ReturnsDefaultApiUrl()
    {
        // Given: a translator constructed with default settings (no explicit settings provided)

        // When: reading the API URL
        var url = _sut.OllamaUrl;

        // Then: the default Ollama endpoint is returned
        url.ShouldBe("http://localhost:11434/api/generate");
    }

    /// <summary>
    ///     Verifies the API URL from settings is exposed unchanged.
    /// </summary>
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

    /// <summary>
    ///     Verifies the model name comes from the translation service rather than being cached locally.
    /// </summary>
    [Fact]
    public void OllamaLlmModelName_WithService_DelegatesGetLlmModelNameToService()
    {
        // Given: a service configured to return a specific model name
        A.CallTo(() => _translationService.GetLlmModelName()).Returns("my-model:7b");

        // When: reading the model name from the translator
        var modelName = _sut.OllamaLlmModelName;

        // Then: the service's model name is returned
        modelName.ShouldBe("my-model:7b");
    }

    // -------------------------------------------------------------------------
    // TranslateAsync
    // -------------------------------------------------------------------------

    /// <summary>
    ///     Verifies a plain response becomes an entry that keeps the source text and carries the
    ///     translation.
    /// </summary>
    [Fact]
    public async Task TranslateAsync_KnownText_ReturnsEntryWithTargetText()
    {
        // Given: a service that returns a plain translation response
        A.CallTo(() => _translationService.TranslateAsync(A<TranslationRequest>.Ignored))
            .Returns(Task.FromResult(new TranslationResponse("Hola")));

        // When: translating a single word
        var result = await _sut.TranslateAsync("Hello");

        // Then: the entry contains the translated text and the original source
        result.ShouldNotBeNull();
        result.SourceText.ShouldBe("Hello");
        result.TargetText.ShouldBe("Hola");
    }

    /// <summary>
    ///     Verifies a response carrying hashtags is split on the pipe into target text and hashtag parts.
    /// </summary>
    [Fact]
    public async Task TranslateAsync_ResponseWithHashtags_PopulatesBothTargetTextAndHashtags()
    {
        // Given: a service that returns a structured response with translation and hashtags
        A.CallTo(() => _translationService.TranslateAsync(A<TranslationRequest>.Ignored))
            .Returns(Task.FromResult(new TranslationResponse("koira", "#noun #animal")));

        // When: translating
        var result = await _sut.TranslateAsync("dog");

        // Then: the pipe is used as a delimiter and both parts are stored separately
        result.TargetText.ShouldBe("koira");
        result.Hashtags.ShouldBe("#noun #animal");
    }

    /// <summary>
    ///     Verifies an empty service response yields an entry with no target text instead of throwing.
    /// </summary>
    [Fact]
    public async Task TranslateAsync_EmptyServiceResponse_ReturnsEntryWithEmptyTargetText()
    {
        // Given: a service that returns an empty response (e.g. after a failed HTTP call)
        A.CallTo(() => _translationService.TranslateAsync(A<TranslationRequest>.Ignored))
            .Returns(Task.FromResult(TranslationResponse.Empty));

        // When: translating
        var result = await _sut.TranslateAsync("Hello");

        // Then: the entry is returned unchanged with no TargetText applied
        result.TargetText.ShouldBe(string.Empty);
    }

    /// <summary>
    ///     Verifies a per-call prompt reaches the service unchanged alongside the source text.
    /// </summary>
    [Fact]
    public async Task TranslateAsync_CustomPromptOverride_ForwardsPromptToService()
    {
        // Given: a custom prompt template
        const string customPrompt = "Translate '{text}' to German. Return only the word.";
        A.CallTo(() => _translationService.TranslateAsync(A<TranslationRequest>.Ignored))
            .Returns(Task.FromResult(new TranslationResponse("Hallo")));

        // When: translating with the custom prompt
        await _sut.TranslateAsync("Hello", customPrompt);

        // Then: the prompt is forwarded to the service exactly as provided
        A.CallTo(() => _translationService.TranslateAsync(
            A<TranslationRequest>.That.Matches(r => r.Text == "Hello" && r.Prompt == customPrompt)))
            .MustHaveHappenedOnceExactly();
    }

    /// <summary>
    ///     Verifies the prompt configured in settings is used when the call supplies none.
    /// </summary>
    [Fact]
    public async Task TranslateAsync_DefaultPromptFromSettings_UsedWhenNoPromptProvided()
    {
        // Given: a translator configured with a default prompt in settings
        const string defaultPrompt = "Translate '{text}' to French.";
        var settings = new OllamaTranslatorSettings { Prompt = defaultPrompt };
        var sut = new OllamaTranslator(_translationService, settings);
        A.CallTo(() => _translationService.TranslateAsync(A<TranslationRequest>.Ignored))
            .Returns(Task.FromResult(new TranslationResponse("Bonjour")));

        // When: translating without an explicit per-call prompt
        await sut.TranslateAsync("Hello");

        // Then: the settings prompt is forwarded to the service
        A.CallTo(() => _translationService.TranslateAsync(
            A<TranslationRequest>.That.Matches(r => r.Prompt == defaultPrompt)))
            .MustHaveHappenedOnceExactly();
    }

    // -------------------------------------------------------------------------
    // BatchTranslateAsync
    // -------------------------------------------------------------------------

    /// <summary>
    ///     Verifies an empty batch returns an empty list and never calls the service.
    /// </summary>
    [Fact]
    public async Task BatchTranslateAsync_EmptyList_ReturnsEmptyListWithoutCallingService()
    {
        // Given: an empty list of entries

        // When: batch translating
        var result = await _sut.BatchTranslateAsync([]);

        // Then: the result is empty and no service calls were made
        result.ShouldNotBeNull();
        result.ShouldBeEmpty();
        A.CallTo(() => _translationService.TranslateAsync(A<TranslationRequest>.Ignored)).MustNotHaveHappened();
    }

    /// <summary>
    ///     Verifies every entry in a batch is translated and returned in the caller's order.
    /// </summary>
    [Fact]
    public async Task BatchTranslateAsync_MultipleEntries_TranslatesAll()
    {
        // Given: entries with per-text service stubs
        A.CallTo(() => _translationService.TranslateAsync(A<TranslationRequest>.That.Matches(r => r.Text == "Hello")))
            .Returns(Task.FromResult(new TranslationResponse("Hola")));
        A.CallTo(() => _translationService.TranslateAsync(A<TranslationRequest>.That.Matches(r => r.Text == "World")))
            .Returns(Task.FromResult(new TranslationResponse("Mundo")));
        A.CallTo(() => _translationService.TranslateAsync(A<TranslationRequest>.That.Matches(r => r.Text == "Test")))
            .Returns(Task.FromResult(new TranslationResponse("Prueba")));
        var entries = new List<CsvEntry>
        {
            new() { SourceText = "Hello" },
            new() { SourceText = "World" },
            new() { SourceText = "Test" }
        };

        // When: batch translating
        var translated = await _sut.BatchTranslateAsync(entries);

        // Then: all entries are translated, in the caller's order
        translated.ShouldNotBeNull();
        translated.Count.ShouldBe(3);
        translated.Select(e => e.SourceText).ShouldBe(["Hello", "World", "Test"]);
        translated.ShouldContain(e => e.SourceText == "Hello" && e.TargetText == "Hola");
        translated.ShouldContain(e => e.SourceText == "World" && e.TargetText == "Mundo");
        translated.ShouldContain(e => e.SourceText == "Test" && e.TargetText == "Prueba");
    }

    /// <summary>
    ///     Verifies results keep the input order even when the first entry is the slowest translation.
    /// </summary>
    [Fact]
    public async Task BatchTranslateAsync_TranslationsFinishOutOfOrder_StillPreservesInputOrder()
    {
        // Given: entries whose translations complete in reverse order -- the first entry is
        // the slowest. Appending results as they complete (the old behaviour) returned the
        // list backwards, which reordered the lines of multi-line files.
        var service = new DelayAwareTranslationService(new Dictionary<string, (int DelayMs, string Translation)>
        {
            ["First"] = (300, "Ensimmäinen"),
            ["Second"] = (200, "Toinen"),
            ["Third"] = (100, "Kolmas")
        });
        var sut = new OllamaTranslator(service);
        var entries = new List<CsvEntry>
        {
            new() { SourceText = "First" },
            new() { SourceText = "Second" },
            new() { SourceText = "Third" }
        };

        // When: batch translating all three in parallel
        var translated = await sut.BatchTranslateAsync(entries);

        // Then: the result order matches the input order, not the completion order
        translated.Select(e => e.SourceText).ShouldBe(["First", "Second", "Third"]);
        translated.Select(e => e.TargetText).ShouldBe(["Ensimmäinen", "Toinen", "Kolmas"]);
    }

    /// <summary>
    ///     Verifies the input order survives when a batch exceeds the parallelism limit and completes in
    ///     waves.
    /// </summary>
    [Fact]
    public async Task BatchTranslateAsync_ManyEntries_PreservesInputOrder()
    {
        // Given: more entries than the parallelism limit, so batches complete at different times
        var service = new DelayAwareTranslationService(
            Enumerable.Range(1, 20).ToDictionary(i => $"Text {i}", i => (DelayMs: (20 - i) * 10, Translation: $"käännös {i}")));
        var sut = new OllamaTranslator(service);
        var entries = Enumerable.Range(1, 20)
            .Select(i => new CsvEntry { SourceText = $"Text {i}" })
            .ToList();

        // When: translating with the default parallelism
        var translated = await sut.BatchTranslateAsync(entries);

        // Then: the entries come back in the original order
        translated.Select(e => e.SourceText).ShouldBe(entries.Select(e => e.SourceText));
    }

    /// <summary>
    ///     Verifies one failing entry keeps its empty target text without losing the other translations.
    /// </summary>
    [Fact]
    public async Task BatchTranslateAsync_ServiceThrowsForOneEntry_OtherEntriesStillTranslated()
    {
        // Given: a service that returns normally for one entry but throws for another
        A.CallTo(() => _translationService.TranslateAsync(A<TranslationRequest>.That.Matches(r => r.Text == "Hello")))
            .Returns(Task.FromResult(new TranslationResponse("Hola")));
        A.CallTo(() => _translationService.TranslateAsync(A<TranslationRequest>.That.Matches(r => r.Text == "Bad")))
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

    /// <summary>
    ///     Verifies a reduced parallelism limit still translates every entry.
    /// </summary>
    [Fact]
    public async Task BatchTranslateAsync_WithMaxParallelism_AllEntriesTranslated()
    {
        // Given: 10 entries and a service that handles any request
        A.CallTo(() => _translationService.TranslateAsync(A<TranslationRequest>.Ignored))
            .Returns(Task.FromResult(new TranslationResponse("käännös")));
        var entries = Enumerable.Range(1, 10)
            .Select(i => new CsvEntry { SourceText = $"Text {i}" })
            .ToList();

        // When: translating with reduced max parallelism
        var translated = await _sut.BatchTranslateAsync(entries, maxParallelTasks: 3);

        // Then: all 10 entries are present with translations
        translated.Count.ShouldBe(10);
        translated.ShouldAllBe(e => e.TargetText == "käännös");
    }

    /// <summary>
    ///     Verifies a batch holding one entry translates that entry.
    /// </summary>
    [Fact]
    public async Task BatchTranslateAsync_SingleEntry_TranslatesEntry()
    {
        // Given: a single entry
        A.CallTo(() => _translationService.TranslateAsync(A<TranslationRequest>.Ignored))
            .Returns(Task.FromResult(new TranslationResponse("kissa")));
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

    /// <summary>
    ///     Verifies processing a CSV file writes an output file holding the translated rows.
    /// </summary>
    [Fact]
    public async Task ProcessCsvAsync_ValidCsvFile_CreatesOutputWithTranslatedContent()
    {
        // Given: a mock service and a temp CSV with two source texts
        A.CallTo(() => _translationService.TranslateAsync(A<TranslationRequest>.Ignored))
            .Returns(Task.FromResult(new TranslationResponse("käännös")));
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

    /// <summary>
    ///     Verifies an empty input creates the output file and triggers no translation calls.
    /// </summary>
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
            A.CallTo(() => _translationService.TranslateAsync(A<TranslationRequest>.Ignored)).MustNotHaveHappened();
        }
        finally
        {
            DeleteIfExists(emptyInput);
            DeleteIfExists(emptyOutput);
        }
    }

    /// <summary>
    ///     Verifies a missing input path is reported with the path that was looked for.
    /// </summary>
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

    /// <summary>
    ///     A translation service that delays each response by a per-text amount, so a test can
    ///     force translations to complete in an order different from the input order.
    /// </summary>
    private sealed class DelayAwareTranslationService : ITranslationService
    {
        private readonly Dictionary<string, (int DelayMs, string Translation)> _behaviour;

        public DelayAwareTranslationService(Dictionary<string, (int DelayMs, string Translation)> behaviour)
        {
            _behaviour = behaviour;
        }

        public async Task<TranslationResponse> TranslateAsync(TranslationRequest request)
        {
            (int delayMs, string translation) = _behaviour[request.Text];
            await Task.Delay(delayMs);
            return new TranslationResponse(translation);
        }

        public string GetLlmModelName() => "DelayAware";
    }
}
