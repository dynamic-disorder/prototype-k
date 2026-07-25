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
    public override async Task<int> ExecuteAsync(CommandContext context, TranslateSettings settings)
    {
        var translationRequests = BuildTranslationRequests(settings);
        if (translationRequests.Count == 0)
        {
            AnsiConsole.MarkupLine("[red]Error:[/] No valid translation requests found.");
            return -1;
        }

        var settingsPath = Path.Combine(AppContext.BaseDirectory, "ollama-settings.json");
        var settingsModel = OllamaTranslatorSettings.LoadFromFile(settingsPath);
        var aiTranslator = new OllamaTranslator(settings: settingsModel);

        await ProcessTranslationRequestsAsync(aiTranslator, translationRequests);

        return 0;
    }

    private static List<TranslationRequest> BuildTranslationRequests(TranslateSettings settings)
    {
        if (!string.IsNullOrWhiteSpace(settings.Folder))
        {
            var folderPath = settings.Folder;
            if (!Directory.Exists(folderPath))
            {
                AnsiConsole.MarkupLine($"[red]Error:[/] Folder '[grey]{Markup.Escape(folderPath)}[/]' does not exist.");
                return new List<TranslationRequest>();
            }

            var textFiles = Directory.GetFiles(folderPath, "*.txt")
                .Concat(Directory.GetFiles(folderPath, "*.md"))
                .Concat(Directory.GetFiles(folderPath, "*.text"))
                .ToList();
            var csvFiles = Directory.GetFiles(folderPath, "*.csv");
            var allFiles = textFiles.Concat(csvFiles).ToList();

            AnsiConsole.MarkupLine($"[cyan]Found {allFiles.Count} files in folder '[grey]{Markup.Escape(folderPath)}[/]' ({csvFiles.Length} CSV, {textFiles.Count} text).[/]");

            return allFiles
                .Select(file => new TranslationRequest(file, GenerateTargetFilePath(file)))
                .ToList();
        }

        return new List<TranslationRequest>
        {
            new(settings.Source, settings.Target)
        };
    }

    private static string GenerateTargetFilePath(string sourceFilePath)
    {
        var directory = Path.GetDirectoryName(sourceFilePath);
        var fileNameWithoutExtension = Path.GetFileNameWithoutExtension(sourceFilePath);
        var extension = Path.GetExtension(sourceFilePath).ToLowerInvariant();
        var targetExtension = extension == ".csv" ? ".translated.csv" : ".translated.txt";
        var targetFileName = $"{fileNameWithoutExtension}{targetExtension}";

        return Path.Combine(directory ?? string.Empty, targetFileName);
    }

    private static async Task ProcessTranslationRequestsAsync(OllamaTranslator translator, List<TranslationRequest> requests)
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
                    if (!ValidateTranslationRequest(request))
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

    private static async Task<string> TranslateFileAsync(OllamaTranslator translator, string sourcePath, string targetPath)
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

    private static bool ValidateTranslationRequest(TranslationRequest request)
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

internal sealed record TranslationRequest(string SourcePath, string TargetPath);
