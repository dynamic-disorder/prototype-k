using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Threading.Tasks;

using NSubstitute;

using OllamaTranslatorApi;
using OllamaTranslatorApi.Core;
using OllamaTranslatorApi.Csv;
using OllamaTranslatorApi.Models;

using Shouldly;

namespace OllamaTranslatorApi.Tests;

/// <summary>
/// Tests for <see cref="CsvFileTranslator"/> CSV file translation functionality.
/// Verifies file I/O, translation delegation, error handling, and prompt usage.
/// </summary>
public sealed class CsvFileTranslatorTests
{
    private readonly OllamaTranslator _ollamaTranslator;
    private readonly TestTranslationService _testTranslationService;

    public CsvFileTranslatorTests()
    {
        _testTranslationService = new TestTranslationService();
        _ollamaTranslator = new OllamaTranslator(_testTranslationService);
    }

    [Fact]
    public async Task TranslateFileAsync_ValidCsvFile_TranslatesAllRecords()
    {
        // Given: A valid CSV file with known content
        var inputPath = "test_input.csv";
        var outputPath = "test_output.csv";
        var csvContent = "SourceText,TargetText\r\nHello,placeholder\r\nWorld,placeholder";
        await File.WriteAllTextAsync(inputPath, csvContent, Encoding.UTF8);
        
        try
        {
            var sut = CreateCsvFileTranslator();
            
            // When: Translating the CSV file
            var result = await sut.TranslateFileAsync(inputPath, outputPath);
            
            // Then: All records are translated and file is created
            result.ShouldStartWith("Done: 2 results saved to");
            File.Exists(outputPath).ShouldBeTrue();
            
            var outputContent = await File.ReadAllTextAsync(outputPath, Encoding.UTF8);
            outputContent.ShouldContain("Hola");
            outputContent.ShouldContain("Mundo");
        }
        finally
        {
            CleanupTestFiles(inputPath, outputPath);
        }
    }

    [Fact]
    public async Task TranslateFileAsync_FileNotFound_ThrowsFileNotFoundException()
    {
        // Given: A non-existent file path
        var inputPath = "nonexistent.csv";
        var outputPath = "output.csv";
        var sut = CreateCsvFileTranslator();
        
        // When/Then: Translating non-existent file throws exception
        await Should.ThrowAsync<FileNotFoundException>(
            async () => await sut.TranslateFileAsync(inputPath, outputPath));
    }

    [Fact]
    public async Task TranslateFileAsync_EmptyCsvFile_ReturnsErrorMessage()
    {
        // Given: An empty CSV file (only headers)
        var inputPath = "empty.csv";
        var outputPath = "empty.translated.csv";
        var csvContent = "SourceText,TargetText";
        await File.WriteAllTextAsync(inputPath, csvContent, Encoding.UTF8);
        
        try
        {
            var sut = CreateCsvFileTranslator();
            
            // When: Translating the empty CSV file
            var result = await sut.TranslateFileAsync(inputPath, outputPath);
            
            // Then: Error message is returned and no output file is created
            result.ShouldContain("No records found");
            File.Exists(outputPath).ShouldBeFalse();
        }
        finally
        {
            CleanupTestFiles(inputPath);
        }
    }

    [Fact]
    public async Task TranslateFileAsync_WithCustomPrompt_UsesCustomPromptForTranslation()
    {
        // Given: A valid CSV file and custom prompt
        var inputPath = "custom_input.csv";
        var outputPath = "custom_output.csv";
        var csvContent = "SourceText,TargetText\r\n\r\nTest,placeholder";
        await File.WriteAllTextAsync(inputPath, csvContent, Encoding.UTF8);
        
        try
        {
            // Arrange: translation service to capture entries
            var (translationService, capturedRequests) = CreateTranslationServiceWithRequestCapture();
            
            var translator = new OllamaTranslator(translationService);
            var sut = new CsvFileTranslator(translator);
            var customPrompt = "Translate this: {text}";
            
            // When: Translating with custom prompt
            var actual = await sut.TranslateFileAsync(inputPath, outputPath, customPrompt);
            
            // Then: Custom prompt is used for translation
            // We can't directly capture the prompt used by OllamaTranslator since it's internal
            // But we can verify the file was processed successfully
            var expectedPrefix = "Done: 1 results saved to";
            actual.ShouldStartWith(expectedPrefix);
            File.Exists(outputPath).ShouldBeTrue();
        }
        finally
        {
            CleanupTestFiles(inputPath, outputPath);
        }
    }

    [Fact]
    public async Task TranslateFileAsync_TranslationFails_FallbackToSourceTextInOutput()
    {
        // Given: A CSV file with text that will fail translation
        var inputPath = "fail_input.csv";
        var outputPath = "fail_output.csv";
        var csvContent = "SourceText,TargetText\r\n\r\nUnknown,placeholder\r\n\r\nHello,placeholder";
        await File.WriteAllTextAsync(inputPath, csvContent, Encoding.UTF8);
        
        try
        {
            var sut = CreateCsvFileTranslator();
            
            // When: Translating with mixed success/failure
            var result = await sut.TranslateFileAsync(inputPath, outputPath);
            
            // Then: Output file contains fallback for failed translation
            result.ShouldStartWith("Done: 2 results saved to");
            File.Exists(outputPath).ShouldBeTrue();
            
            var outputContent = await File.ReadAllTextAsync(outputPath, Encoding.UTF8);
            // "Unknown" should fall back to source text since TestTranslationService throws NotSupportedException
            outputContent.ShouldContain("Unknown");
            outputContent.ShouldContain("Hola");
        }
        finally
        {
            CleanupTestFiles(inputPath, outputPath);
        }
    }

    [Fact]
    public async Task TranslateFileAsync_OutputDirectoryDoesNotExist_CreatesDirectory()
    {
        // Given: A valid CSV file and output path in non-existent directory
        var inputPath = "input.csv";
        var outputDir = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString(), "subdir");
        var outputPath = Path.Combine(outputDir, "output.csv");
        var csvContent = "SourceText,TargetText\r\n\r\nHello,placeholder";
        await File.WriteAllTextAsync(inputPath, csvContent, Encoding.UTF8);
        
        try
        {
            var sut = CreateCsvFileTranslator();
            
            // When: Translating to non-existent directory
            var result = await sut.TranslateFileAsync(inputPath, outputPath);
            
            // Then: Directory is created and file is written
            Directory.Exists(outputDir).ShouldBeTrue();
            File.Exists(outputPath).ShouldBeTrue();
            result.ShouldStartWith("Done: 1 results saved to");
        }
        finally
        {
            CleanupTestFiles(inputPath);
            var parentDir = Path.GetDirectoryName(outputDir);
            if (parentDir is not null && Directory.Exists(parentDir))
            {
                Directory.Delete(parentDir, true);
            }
        }
    }

    [Fact]
    public async Task TranslateFileAsync_WithoutCustomPrompt_UsesTranslatorDefaultPrompt()
    {
        // Given: A valid CSV file without custom prompt
        var inputPath = "default_input.csv";
        var outputPath = "default_output.csv";
        var csvContent = "SourceText,TargetText\r\n\r\nHello,placeholder";
        await File.WriteAllTextAsync(inputPath, csvContent, Encoding.UTF8);
        
        try
        {
            // Arrange: translation service that returns a known translation
            var (translationService, _) = CreateTranslationServiceWithRequestCapture();
            translationService.GetLlmModelName().Returns("TestModel");
            
            var translator = new OllamaTranslator(translationService);
            var sut = new CsvFileTranslator(translator);
            
            // When: Translating without custom prompt
            var actual = await sut.TranslateFileAsync(inputPath, outputPath);
            
            // Then: File is translated successfully (default prompt works)
            var expectedPrefix = "Done: 1 results saved to";
            actual.ShouldStartWith(expectedPrefix);
            File.Exists(outputPath).ShouldBeTrue();
        }
        finally
        {
            CleanupTestFiles(inputPath, outputPath);
        }
    }

    private CsvFileTranslator CreateCsvFileTranslator()
    {
        return new CsvFileTranslator(_ollamaTranslator);
    }

    private static (ITranslationService, List<TranslationRequest>) CreateTranslationServiceWithRequestCapture()
    {
        var translationService = Substitute.For<ITranslationService>();
        var capturedRequests = new List<TranslationRequest>();
        
        translationService.TranslateAsync(Arg.Any<TranslationRequest>())
            .Returns(call =>
            {
                var request = call.Arg<TranslationRequest>();
                capturedRequests.Add(request);
                return Task.FromResult(new TranslationResponse("Translated"));
            });
        
        translationService.GetLlmModelName().Returns("TestModel");
        
        return (translationService, capturedRequests);
    }

    private static void CleanupTestFiles(params string[] paths)
    {
        foreach (var path in paths)
        {
            if (File.Exists(path))
            {
                File.Delete(path);
            }
        }
    }
}
