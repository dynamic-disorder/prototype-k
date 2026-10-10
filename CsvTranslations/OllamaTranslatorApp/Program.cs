using System.ComponentModel;
using System.Linq;
using System.Text;

using OllamaTranslatorApi.Configuration;
using OllamaTranslatorApi.Core;
using OllamaTranslatorApi.Csv;
using OllamaTranslatorApi.Text;

using Spectre.Console;
using Spectre.Console.Cli;

namespace OllamaTranslatorApp;

/// <summary>
///     Entry point and CLI wiring. The testable helpers below are <c>public</c> members of
///     this <c>internal</c> class on purpose: reference assemblies keep public members of
///     internal types but strip <c>internal</c> ones, so <c>internal</c> helpers would be
///     invisible to <c>OllamaTranslatorApp.Tests</c> (granted access via
///     <c>InternalsVisibleTo</c>) even though they exist in the built assembly.
///     The containing type is internal, so nothing is exposed outside the friend assembly.
/// </summary>
internal sealed class Program
{
    public static int Main(string[] args)
    {
        Console.OutputEncoding = Encoding.UTF8;

        var app = new CommandApp<TranslateCommand>();
        app.Configure(config =>
        {
            config.SetApplicationName("OllamaTranslatorApp");
        });

        return app.Run(args);
    }
}

public sealed class TranslateSettings : CommandSettings
{
    [CommandArgument(0, "source file")]
    public string Source { get; init; } = string.Empty;

    [CommandArgument(1, "target file")]
    public string Target { get; init; } = string.Empty;

    [CommandOption("-f|--folder")]
    [Description("Translate all supported files inside the specified folder.")]
    public string? Folder { get; init; }

    public override ValidationResult Validate()
    {
        if (!string.IsNullOrWhiteSpace(Folder))
        {
            return ValidationResult.Success();
        }

        // Source and Target are required CommandArguments, validation is done by Spectre.Console
        return ValidationResult.Success();
    }
}

public sealed class TranslateCommand : AsyncCommand<TranslateSettings>
{
    public override async Task<int> ExecuteAsync(CommandContext context, TranslateSettings settings, CancellationToken cancellationToken)
    {
        var translationRequests = BuildTranslationFileRequests(settings);
        if (translationRequests.Count == 0)
        {
            AnsiConsole.MarkupLine("[red]Error:[/] No valid translation requests found.");
            return -1;
        }

        var settingsPath = Path.Combine(AppContext.BaseDirectory, "ollama-settings.json");
        var settingsModel = OllamaTranslatorSettings.LoadFromFile(settingsPath);
        var aiTranslator = new OllamaTranslator(settings: settingsModel);

        await ProcessTranslationFileRequestsAsync(aiTranslator, translationRequests);

        return 0;
    }

    public static List<TranslationFileRequest> BuildTranslationFileRequests(TranslateSettings settings)
    {
        if (!string.IsNullOrWhiteSpace(settings.Folder))
        {
            var folderPath = settings.Folder;
            if (!Directory.Exists(folderPath))
            {
                AnsiConsole.MarkupLine($"[red]Error:[/] Folder '[grey]{Markup.Escape(folderPath)}[/]' does not exist.");
                return new List<TranslationFileRequest>();
            }

            var textFiles = Directory.GetFiles(folderPath, "*.txt")
                .Concat(Directory.GetFiles(folderPath, "*.md"))
                .Concat(Directory.GetFiles(folderPath, "*.text"))
                .ToList();
            var csvFiles = Directory.GetFiles(folderPath, "*.csv");
            var allFiles = textFiles.Concat(csvFiles).ToList();

            AnsiConsole.MarkupLine($"[cyan]Found {allFiles.Count} files in folder '[grey]{Markup.Escape(folderPath)}[/]' ({csvFiles.Length} CSV, {textFiles.Count} text).[/]");

            return allFiles
                .Select(file => new TranslationFileRequest(file, GenerateTargetFilePath(file)))
                .ToList();
        }

        return new List<TranslationFileRequest>
        {
            new(settings.Source, settings.Target)
        };
    }

    public static string GenerateTargetFilePath(string sourceFilePath)
    {
        var directory = Path.GetDirectoryName(sourceFilePath);
        var filenameWithoutExtension = Path.GetFileNameWithoutExtension(sourceFilePath);
        var extension = Path.GetExtension(sourceFilePath).ToLowerInvariant();
        var targetExtension = extension == ".csv" ? ".translated.csv" : ".translated.txt";
        var targetFilename = $"{filenameWithoutExtension}{targetExtension}";

        return Path.Combine(directory ?? string.Empty, targetFilename);
    }

    private static async Task ProcessTranslationFileRequestsAsync(OllamaTranslator translator, List<TranslationFileRequest> requests)
    {
        await AnsiConsole.Progress()
            .Columns(
                new TaskDescriptionColumn(),
                new ProgressBarColumn(),
                new PercentageColumn(),
                new RemainingTimeColumn(),
                new SpinnerColumn())
            .AutoRefresh(true)
            .StartAsync(async progressContext =>
            {
                var task = progressContext.AddTask("Translating files", maxValue: requests.Count);

                foreach (var request in requests)
                {
                    if (!ValidateTranslationFileRequest(request))
                    {
                        task.Increment(1);
                        continue;
                    }

                    task.Description = $"Translating {Path.GetFileName(request.SourcePath)}";

                    try
                    {
                        var result = await TranslateFileAsync(translator, request.SourcePath, request.TargetPath);
                        AnsiConsole.MarkupLine($"[green]Translated[/] [grey]{Markup.Escape(request.SourcePath)}[/] => [green]{Markup.Escape(request.TargetPath)}[/]: {Markup.Escape(result)}");
                    }
                    catch (Exception ex)
                    {
                        AnsiConsole.MarkupLine($"[red]Error processing[/] [grey]{Markup.Escape(request.SourcePath)}[/]: [red]{Markup.Escape(ex.Message)}[/]");
                    }

                    task.Increment(1);
                }
            });
    }

    public static async Task<string> TranslateFileAsync(OllamaTranslator translator, string sourcePath, string targetPath)
    {
        var extension = Path.GetExtension(sourcePath).ToLowerInvariant();
        if (extension == ".csv")
        {
            var csvTranslator = new CsvFileTranslator(translator);
            return await csvTranslator.TranslateFileAsync(sourcePath, targetPath);
        }

        var textTranslator = new TextFileTranslator(translator, useContext: false);
        return await textTranslator.TranslateFileAsync(sourcePath, targetPath);
    }

    public static bool ValidateTranslationFileRequest(TranslationFileRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.SourcePath) || string.IsNullOrWhiteSpace(request.TargetPath))
        {
            AnsiConsole.MarkupLine("[red]Error:[/] Source or target path is empty.");
            return false;
        }

        if (!File.Exists(request.SourcePath))
        {
            AnsiConsole.MarkupLine($"[red]Error:[/] Source file '[grey]{Markup.Escape(request.SourcePath)}[/]' does not exist.");
            return false;
        }

        var sourceExtension = Path.GetExtension(request.SourcePath).ToLowerInvariant();
        var supportedExtensions = new[] { ".csv", ".txt", ".md", ".text" };
        if (!supportedExtensions.Contains(sourceExtension))
        {
            AnsiConsole.MarkupLine($"[yellow]Warning:[/] Source file '[grey]{Markup.Escape(request.SourcePath)}[/]' has unsupported extension '{Markup.Escape(sourceExtension)}'. Trying anyway...");
        }

        return true;
    }
}

/// <summary>
///     A file-level translation job: a source path to translate and the path to write the
///     translated copy to. Distinct from <c>OllamaTranslatorApi.Models.TranslationRequest</c>,
///     which represents a single text-translation call to the LLM service — the two previously
///     shared the name, which made the tests ambiguous.
/// </summary>
public sealed record TranslationFileRequest(string SourcePath, string TargetPath);
