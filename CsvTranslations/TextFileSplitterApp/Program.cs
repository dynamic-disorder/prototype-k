using System.ComponentModel;
using System.Text;

using Spectre.Console;
using Spectre.Console.Cli;

namespace TextFileSplitterApp;

internal sealed class Program
{
    public static int Main(string[] args)
    {
        Console.OutputEncoding = Encoding.UTF8;

        var app = new CommandApp<SplitCommand>();
        app.Configure(config =>
        {
            config.SetApplicationName("TextFileSplitter");
        });

        return app.Run(args);
    }
}

public sealed class SplitSettings : CommandSettings
{
    [CommandArgument(0, "<input_file_path>")]
    [Description("Path to the text file to split.")]
    public string InputFilePath { get; init; } = string.Empty;

    [CommandArgument(1, "<max_lines_per_file>")]
    [Description("Maximum number of lines per output file (250-25000).")]
    public int MaxLinesPerFile { get; init; }

    [CommandOption("--csv")]
    [Description("Format split files as CSV translation entries.")]
    public bool FormatAsCsv { get; init; }

    [CommandOption("--hashtags")]
    [Description("Use hashtag headers for CSV output.")]
    public bool Hashtags { get; init; }

    [CommandOption("--semantics")]
    [Description("Use semantics headers for CSV output.")]
    public bool Semantics { get; init; }

    public string HeaderType => Hashtags ? "Hashtags" : Semantics ? "Semantics" : string.Empty;

    public override ValidationResult Validate()
    {
        if (string.IsNullOrWhiteSpace(InputFilePath))
        {
            return ValidationResult.Error("An input file path is required.");
        }

        if (MaxLinesPerFile < TextFileSplitter.MinLinesPerFile || MaxLinesPerFile > TextFileSplitter.MaxLinesPerFile1)
        {
            return ValidationResult.Error($"max_lines_per_file must be between {TextFileSplitter.MinLinesPerFile} and {TextFileSplitter.MaxLinesPerFile1}.");
        }

        if (Hashtags && Semantics)
        {
            return ValidationResult.Error("Use either --hashtags or --semantics, not both.");
        }

        return ValidationResult.Success();
    }
}

public sealed class SplitCommand : AsyncCommand<SplitSettings>
{
    public override async Task<int> ExecuteAsync(CommandContext context, SplitSettings settings)
    {
        var splitter = new TextFileSplitter();
        var splitRequest = await GetSplitRequestAsync(splitter, settings);

        if (!splitRequest.IsValid)
        {
            AnsiConsole.MarkupLine($"[red]Error:[/] File splitting cannot proceed due to error: [grey]{Markup.Escape(splitRequest.Error)}[/]");
            return -1;
        }

        AnsiConsole.MarkupLine($"[cyan]Split information:[/] [grey]{Markup.Escape(splitRequest.ToString())}[/]");

        if (!AnsiConsole.Confirm("Do you want to proceed with splitting the file?"))
        {
            AnsiConsole.MarkupLine("[yellow]Warning:[/] File splitting cancelled by user.");
            return 1;
        }

        var splitResult = await ExecuteSplitAsync(splitter, splitRequest);

        if (splitResult.Succeeded)
        {
            AnsiConsole.MarkupLine("[green]Success:[/] File splitting complete.");
            AnsiConsole.MarkupLine($"[cyan]Details:[/] [grey]{Markup.Escape(splitResult.ToString())}[/]");

            if (settings.FormatAsCsv)
            {
                await FormatSplitFilesAsCsvAsync(splitter, splitResult);
            }

            return 0;
        }

        AnsiConsole.MarkupLine("[red]Error:[/] File splitting failed.");
        return -1;
    }

    private static async Task<SplitRequestInfo> GetSplitRequestAsync(TextFileSplitter splitter, SplitSettings settings)
    {
        return await AnsiConsole.Status()
            .Spinner(Spinner.Known.Dots)
            .StartAsync("Analyzing file...", async _ =>
            {
                var request = await TextFileSplitter.GetSplittingInformation(settings.InputFilePath, settings.MaxLinesPerFile);
                if (request.IsValid)
                {
                    request.HeaderType = settings.HeaderType;
                }

                return request;
            });
    }

    private static async Task<SplitProcessInfo> ExecuteSplitAsync(TextFileSplitter splitter, SplitRequestInfo splitRequest)
    {
        return await AnsiConsole.Status()
            .Spinner(Spinner.Known.Line)
            .StartAsync("Splitting file...", async _ => await TextFileSplitter.SplitFileAsync(splitRequest));
    }

    private static async Task FormatSplitFilesAsCsvAsync(TextFileSplitter splitter, SplitProcessInfo splitResult)
    {
        await AnsiConsole.Status()
            .Spinner(Spinner.Known.Star)
            .StartAsync("Formatting split files as CSV...", async _ =>
            {
                await TextFileSplitter.FormatAsTranslationEntries(splitResult);
            });

        AnsiConsole.MarkupLine("[green]Success:[/] CSV formatting complete.");
    }
}
