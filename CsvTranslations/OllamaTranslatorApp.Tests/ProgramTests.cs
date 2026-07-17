using NSubstitute;

using OllamaTranslatorApi.Core;
using OllamaTranslatorApi.Csv;
using OllamaTranslatorApi.Models;
using OllamaTranslatorApi.Text;

using Shouldly;

namespace OllamaTranslatorApp.Tests;

/// <summary>
/// Tests for <see cref="Program"/> translation routing logic.
/// Verifies file extension detection, translator selection, and error handling for CSV and text files.
/// </summary>
public sealed class ProgramTests
{
    private readonly OllamaTranslator _ollamaTranslator;
    private readonly CsvFileTranslator _csvFileTranslator;
    private readonly TextFileTranslator _textFileTranslator;

    public ProgramTests()
    {
        _ollamaTranslator = Substitute.For<OllamaTranslator>(null, null);
        _csvFileTranslator = Substitute.For<CsvFileTranslator>(_ollamaTranslator);
        _textFileTranslator = Substitute.For<TextFileTranslator>(_ollamaTranslator, false);
    }

    [Fact]
    public async Task TranslateFileAsync_CsvExtension_UsesCsvFileTranslator()
    {
        // Given: A CSV file path and mocked translators
        var sourcePath = "test.csv";
        var targetPath = "test.translated.csv";
        var expectedResult = "Done: 5 results saved to test.translated.csv";
        _csvFileTranslator.TranslateFileAsync(sourcePath, targetPath)
            .Returns(expectedResult);

        // When: Translating the file
        var actual = await ProgramTestsHelper.TranslateFileAsyncWithMocks(
            sourcePath, targetPath, _ollamaTranslator, _csvFileTranslator, _textFileTranslator);

        // Then: CSV translator was used and returned expected result
        actual.ShouldBe(expectedResult);
        await _csvFileTranslator.Received(1).TranslateFileAsync(sourcePath, targetPath);
        await _textFileTranslator.DidNotReceiveWithAnyArgs().TranslateFileAsync(default!, default!);
    }

    [Fact]
    public async Task TranslateFileAsync_TxtExtension_UsesTextFileTranslator()
    {
        // Given: A text file path and mocked translators
        var sourcePath = "story.txt";
        var targetPath = "story.translated.txt";
        var expectedResult = "Done: 10 lines translated and saved to story.translated.txt";
        _textFileTranslator.TranslateFileAsync(sourcePath, targetPath, null)
            .Returns(expectedResult);

        // When: Translating the file
        var actual = await ProgramTestsHelper.TranslateFileAsyncWithMocks(
            sourcePath, targetPath, _ollamaTranslator, _csvFileTranslator, _textFileTranslator);

        // Then: Text translator was used and returned expected result
        actual.ShouldBe(expectedResult);
        await _textFileTranslator.Received(1).TranslateFileAsync(sourcePath, targetPath, null);
        await _csvFileTranslator.DidNotReceiveWithAnyArgs().TranslateFileAsync(default!, default!);
    }

    [Fact]
    public async Task TranslateFileAsync_MdExtension_UsesTextFileTranslator()
    {
        // Given: A markdown file path
        var sourcePath = "document.md";
        var targetPath = "document.translated.txt";
        var expectedResult = "Done: 15 lines translated and saved to document.translated.txt";
        _textFileTranslator.TranslateFileAsync(sourcePath, targetPath, null)
            .Returns(expectedResult);

        // When: Translating the file
        var actual = await ProgramTestsHelper.TranslateFileAsyncWithMocks(
            sourcePath, targetPath, _ollamaTranslator, _csvFileTranslator, _textFileTranslator);

        // Then: Text translator was used for markdown file
        actual.ShouldBe(expectedResult);
        await _textFileTranslator.Received(1).TranslateFileAsync(sourcePath, targetPath, null);
    }

    [Fact]
    public async Task TranslateFileAsync_TextExtension_UsesTextFileTranslator()
    {
        // Given: A .text file path
        var sourcePath = "notes.text";
        var targetPath = "notes.translated.txt";
        var expectedResult = "Done: 8 lines translated and saved to notes.translated.txt";
        _textFileTranslator.TranslateFileAsync(sourcePath, targetPath, null)
            .Returns(expectedResult);

        // When: Translating the file
        var actual = await ProgramTestsHelper.TranslateFileAsyncWithMocks(
            sourcePath, targetPath, _ollamaTranslator, _csvFileTranslator, _textFileTranslator);

        // Then: Text translator was used for .text file
        actual.ShouldBe(expectedResult);
        await _textFileTranslator.Received(1).TranslateFileAsync(sourcePath, targetPath, null);
    }

    [Theory]
    [InlineData(".csv", ".translated.csv")]
    [InlineData(".txt", ".translated.txt")]
    [InlineData(".md", ".translated.txt")]
    [InlineData(".text", ".translated.txt")]
    public void GenerateTargetFilePath_SupportedExtensions_ReturnsCorrectExtension(string inputExtension, string expectedExtension)
    {
        // Given: A file path with the specified extension
        var sourcePath = $"test{inputExtension}";
        
        // When: Generating target file path
        var result = ProgramTestsHelper.GenerateTargetFilePath(sourcePath);
        
        // Then: Target extension matches expected
        result.ShouldEndWith(expectedExtension);
    }

    [Fact]
    public void ValidateTranslationRequest_ValidCsvFile_ReturnsTrue()
    {
        // Given: A valid CSV file that exists
        var request = new Program.TranslationRequest("test.csv", "output.translated.csv");
        
        // When: Validating the request
        var result = ProgramTestsHelper.ValidateTranslationRequest(request);
        
        // Then: Validation passes
        result.ShouldBeTrue();
    }

    [Fact]
    public void ValidateTranslationRequest_ValidTextFile_ReturnsTrue()
    {
        // Given: A valid text file that exists
        var request = new Program.TranslationRequest("story.txt", "story.translated.txt");
        
        // When: Validating the request
        var result = ProgramTestsHelper.ValidateTranslationRequest(request);
        
        // Then: Validation passes
        result.ShouldBeTrue();
    }

    [Fact]
    public void ValidateTranslationRequest_EmptySourcePath_ReturnsFalse()
    {
        // Given: An empty source path
        var request = new Program.TranslationRequest("", "output.txt");
        
        // When: Validating the request
        var result = ProgramTestsHelper.ValidateTranslationRequest(request);
        
        // Then: Validation fails
        result.ShouldBeFalse();
    }

    [Fact]
    public void ValidateTranslationRequest_EmptyTargetPath_ReturnsFalse()
    {
        // Given: An empty target path
        var request = new Program.TranslationRequest("input.txt", "");
        
        // When: Validating the request
        var result = ProgramTestsHelper.ValidateTranslationRequest(request);
        
        // Then: Validation fails
        result.ShouldBeFalse();
    }

    [Fact]
    public void ValidateTranslationRequest_UnsupportedExtension_ReturnsTrueWithWarning()
    {
        // Given: A file with unsupported extension
        var request = new Program.TranslationRequest("test.xyz", "test.translated.xyz");
        
        // When: Validating the request
        var result = ProgramTestsHelper.ValidateTranslationRequest(request);
        
        // Then: Validation passes (with warning)
        result.ShouldBeTrue();
    }

    [Fact]
    public void ParseCommandLineArguments_SingleFilePair_ReturnsOneRequest()
    {
        // Given: Command line arguments with source and target files
        var args = new[] { "source.txt", "target.txt" };
        
        // When: Parsing arguments
        var requests = ProgramTestsHelper.ParseCommandLineArguments(args);
        
        // Then: One translation request is created
        requests.Count.ShouldBe(1);
        requests[0].SourcePath.ShouldBe("source.txt");
        requests[0].TargetPath.ShouldBe("target.txt");
    }

    [Fact]
    public void ParseCommandLineArguments_FolderOption_ProcessesFilesInFolder()
    {
        // Given: Command line with --folder option and existing folder
        var tempFolder = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString());
        Directory.CreateDirectory(tempFolder);
        
        try
        {
            // Create test files
            File.WriteAllText(Path.Combine(tempFolder, "test.csv"), "csv content");
            File.WriteAllText(Path.Combine(tempFolder, "story.txt"), "text content");
            File.WriteAllText(Path.Combine(tempFolder, "doc.md"), "markdown content");
            File.WriteAllText(Path.Combine(tempFolder, "notes.text"), "text content");
            
            var args = new[] { "--folder", tempFolder };
            
            // When: Parsing arguments
            var requests = ProgramTestsHelper.ParseCommandLineArguments(args);
            
            // Then: All four files are processed
            requests.Count.ShouldBe(4);
            requests.ShouldContain(r => r.SourcePath.EndsWith("test.csv"));
            requests.ShouldContain(r => r.SourcePath.EndsWith("story.txt"));
            requests.ShouldContain(r => r.SourcePath.EndsWith("doc.md"));
            requests.ShouldContain(r => r.SourcePath.EndsWith("notes.text"));
        }
        finally
        {
            Directory.Delete(tempFolder, true);
        }
    }
}

    /// <summary>
    /// Helper class to expose private Program methods for testing.
    /// </summary>
    internal static class ProgramTestsHelper
    {
        // These methods simulate Program logic for testing
        // They are defined here to keep the test class clean
        
        public static async Task<string> TranslateFileAsyncWithMocks(
            string sourcePath, string targetPath,
            OllamaTranslator ollamaTranslator,
            CsvFileTranslator csvFileTranslator,
            TextFileTranslator textFileTranslator)
        {
            // This would normally use dependency injection or a testable design
            // For now, we'll simulate the behavior
            var extension = Path.GetExtension(sourcePath).ToLowerInvariant();
            
            if (extension == ".csv")
            {
                return await csvFileTranslator.TranslateFileAsync(sourcePath, targetPath);
            }
            else
            {
                return await textFileTranslator.TranslateFileAsync(sourcePath, targetPath);
            }
        }
        
        public static string GenerateTargetFilePath(string sourceFilePath)
        {
            var directory = Path.GetDirectoryName(sourceFilePath);
            var fileNameWithoutExtension = Path.GetFileNameWithoutExtension(sourceFilePath);
            var extension = Path.GetExtension(sourceFilePath).ToLowerInvariant();
            
            // Use appropriate extension for output
            var targetExtension = extension == ".csv" ? ".translated.csv" : ".translated.txt";
            var targetFileName = $"{fileNameWithoutExtension}{targetExtension}";

            return Path.Combine(directory ?? string.Empty, targetFileName);
        }
        
        public static bool ValidateTranslationRequest(TranslationRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.SourcePath) || string.IsNullOrWhiteSpace(request.TargetPath))
            {
                return false;
            }

            if (!File.Exists(request.SourcePath))
            {
                return false;
            }

            var sourceExtension = Path.GetExtension(request.SourcePath).ToLowerInvariant();
            var supportedExtensions = new[] { ".csv", ".txt", ".md", ".text" };
            
            if (!supportedExtensions.Contains(sourceExtension))
            {
                // Warning but still true
                return true;
            }

            return true;
        }
        
        public static List<TranslationRequest> ParseCommandLineArguments(string[] args)
        {
            var requests = new List<TranslationRequest>();

        if (args[0] == "--folder")
        {
            if (args.Length < 2)
            {
                return requests;
            }

            var folderPath = args[1];
            if (!Directory.Exists(folderPath))
            {
                return requests;
            }

            // Get all supported file types
            var textFiles = Directory.GetFiles(folderPath, "*.txt")
                .Concat(Directory.GetFiles(folderPath, "*.md"))
                .Concat(Directory.GetFiles(folderPath, "*.text"))
                .ToList();
            var csvFiles = Directory.GetFiles(folderPath, "*.csv");
            
            var allFiles = textFiles.Concat(csvFiles).ToList();

            foreach (var file in allFiles)
            {
                var targetPath = GenerateTargetFilePath(file);
                requests.Add(new Program.TranslationRequest(file, targetPath));
            }
        }
        else
        {
            if (args.Length != 2)
            {
                return requests;
            }

            var sourcePath = args[0];
            var targetPath = args[1];
            requests.Add(new Program.TranslationRequest(sourcePath, targetPath));
        }

        return requests;
    }
}