using System.Globalization;
using System.Text;

using OllamaTranslatorApi.Models;

namespace TextFileSplitterApp;

/// <summary>
///   Represents the information and state of the split process for a given split request.
///   This class encapsulates details about the input file, splitting parameters, output files,
///   and any errors or warnings encountered during the splitting process.
/// </summary>
public class SplitProcessInfo
{
    private readonly SplitRequestInfo _requestInfo;

    /// <summary>
    /// The default constructor.
    /// </summary>
    /// <param name="splitRequestInfo">The information about the split request, including input file path and splitting parameters.</param>
    /// <exception cref="ArgumentNullException"></exception>
    public SplitProcessInfo(SplitRequestInfo splitRequestInfo)
    {
        _requestInfo = splitRequestInfo ?? throw new ArgumentNullException(nameof(splitRequestInfo));

        // Copy immutable request values for clarity and testability
        InputFilepath = _requestInfo.InputFilepath;
        SplitLinesPerFile = _requestInfo.SplitLinesPerFile;
        TotalLinesPerFile = _requestInfo.TotalLinesPerFile;
        SplitFilesAmount = _requestInfo.SplitFilesAmount;
        HeaderType = _requestInfo.HeaderType;

        // Initialize mutable state
        ErrorList = new List<string>();
        OutputFiles = new List<string>();
        Warning = new List<string>();

        OutputDirectory = string.Empty;
        FileExtension = string.Empty;
        BaseFileName = string.Empty;
        OutputFileFullPath = string.Empty;
        SplitFilesAmountLength = 0;
        LineNumber = 0;
        FileCount = 0;
    }

    /// <summary>
    /// Gets the input file path from the split request information.
    /// </summary>
    public string InputFilepath { get; }

    /// <summary>
    /// Gets the number of lines to split per file from the split request information.
    /// </summary>
    public int SplitLinesPerFile { get; }

    /// <summary>
    /// Gets the total number of lines in the input file from the split request information.
    /// </summary>
    public int TotalLinesPerFile { get; }

    /// <summary>
    /// Gets the estimated number of files to be created from the split request information.
    /// </summary>
    public int SplitFilesAmount { get; }

    /// <summary>
    /// Gets the list of error messages encountered during the split process.
    /// </summary>
    public List<string> ErrorList { get; internal set; }

    /// <summary>
    /// Gets a value indicating whether the split process succeeded (no errors and at least one output file).
    /// </summary>
    public bool Succeeded => ErrorList.Count == 0 && OutputFiles.Count > 0;

    /// <summary>
    /// Gets the current line number being processed in the split process.
    /// </summary>
    public int LineNumber { get; internal set; }

    /// <summary>
    /// Gets the count of files that have been created so far in the split process.
    /// </summary>
    public int FileCount { get; internal set; }

    /// <summary>
    /// Gets the list of output file paths that have been generated as a result of the split process.
    /// </summary>
    public List<string> OutputFiles { get; internal set; }

    /// <summary>
    /// Gets the output directory where the split files will be saved.
    /// </summary>
    public string? OutputDirectory { get; internal set; }

    /// <summary>
    /// Gets the file extension of the input file.
    /// </summary>
    public string FileExtension { get; internal set; }

    /// <summary>
    /// Gets the base file name of the input file without the extension.
    /// </summary>
    public string BaseFileName { get; internal set; }

    /// <summary>
    /// Gets the list of warning messages encountered during the split process.
    /// </summary>
    public List<string> Warning { get; internal set; }

    /// <summary>
    /// Gets the full path of the current output file being generated in the split process.
    /// </summary>
    public string OutputFileFullPath { get; internal set; }

    /// <summary>
    /// Gets the length in digits of the expected split files amount (used for padding names).
    /// </summary>
    public int SplitFilesAmountLength { get; internal set; }

    /// <summary>
    /// Gets the CSV header line if the input file is a CSV file.
    /// </summary>
    public string? CsvHeaderLine { get; internal set; }

    /// <summary>
    /// Gets the header type to use when CSV file lacks SourceText/TargetText headers.
    /// "Hashtags" or "Semantics" or empty for default behavior.
    /// </summary>
    public string HeaderType { get; }

    /// <summary>
    ///   Initializes the split process information by calculating necessary details such as the base file name, file extension, output directory, and preparing for the splitting process. It also handles any exceptions that may occur during initialization and returns an error message if initialization fails.
    /// </summary>
    /// <returns>A string containing an error message if initialization fails, or an empty string if initialization is successful.</returns>
    public string Initialize()
    {
        try
        {
            SplitFilesAmountLength = SplitFilesAmount.ToString(CultureInfo.InvariantCulture).Length;
            BaseFileName = Path.GetFileNameWithoutExtension(InputFilepath);
            FileExtension = Path.GetExtension(InputFilepath);
            OutputDirectory = Path.GetDirectoryName(InputFilepath);

            if (string.IsNullOrEmpty(OutputDirectory))
            {
                Warning.Add(
                    "Warning: Could not determine output directory from input file path. Using current directory for output files.");
                OutputDirectory = Directory.GetCurrentDirectory();
            }

            if (!Directory.Exists(OutputDirectory))
            {
                Directory.CreateDirectory(OutputDirectory);
            }

            // reset mutable state before a split
            LineNumber = 0;
            FileCount = 0;
            OutputFiles = new List<string>();

            // Read CSV header if file extension is .csv
            if (FileExtension.Equals(".csv", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    using var reader = new StreamReader(InputFilepath);
                    CsvHeaderLine = reader.ReadLine();
                    if (string.IsNullOrEmpty(CsvHeaderLine))
                    {
                        CsvHeaderLine = null;
                        Warning.Add("CSV file appears to be empty or has no header line.");
                    }
                    else
                    {
                        Warning.Add($"CSV header detected and will be included in split files: {CsvHeaderLine}");

                        // Check if header contains SourceText and TargetText
                        var header = CsvHeaderLine.ToLowerInvariant();
                        if (header.Contains(nameof(CsvEntry.SourceText), StringComparison.InvariantCultureIgnoreCase) && header.Contains(nameof(CsvEntry.TargetText), StringComparison.InvariantCultureIgnoreCase))
                        {
                            // CSV header already contains SourceText and TargetText columns.
                            return string.Empty;
                        }

                        // Header missing required columns, generate new header based on HeaderType
                        if (!string.IsNullOrEmpty(HeaderType))
                        {
                            var csvEntry = new CsvEntry();
                            string newHeader;
                            if (HeaderType.Equals(nameof(CsvEntry.Hashtags), StringComparison.OrdinalIgnoreCase))
                            {
                                newHeader = csvEntry.GetCsvHeadersWithHashtags();
                            }
                            else if (HeaderType.Equals(nameof(CsvEntry.Semantics), StringComparison.OrdinalIgnoreCase))
                            {
                                newHeader = csvEntry.GetCsvHeadersWithSemantics();
                            }
                            else
                            {
                                newHeader = csvEntry.GetCsvHeaders(); // default
                            }

                            Warning.Add($"CSV header missing SourceText/TargetText. Generated new header: {newHeader}");
                            CsvHeaderLine = newHeader;
                        }
                        else
                        {
                            Warning.Add("CSV header missing SourceText/TargetText columns. Use --hashtags or --semantics flag to generate appropriate header.");
                        }

                        return string.Empty;
                    }
                }
                catch (Exception ex)
                {
                    Warning.Add($"Failed to read CSV header: {ex.Message}");
                    CsvHeaderLine = null;
                }
            }

            return string.Empty;
        }
        catch (Exception e)
        {
            return e.Message;
        }
    }

    /// <summary>
    ///   Returns a string representation of the split process information, including details about the input file, splitting parameters, estimated number of output files, and any errors encountered during initialization. This method is useful for logging or displaying the current state of the split process in a human-readable format.
    /// </summary>
    /// <returns>A string containing the split process information.</returns>
    public override string ToString()
    {
        var outcomes = new StringBuilder();
        outcomes.Append($"Input file: {InputFilepath}" + Environment.NewLine);
        outcomes.Append($"Total lines in file: {TotalLinesPerFile}" + Environment.NewLine);
        outcomes.Append($"Max lines per file: {SplitLinesPerFile}" + Environment.NewLine);
        outcomes.Append($"Estimated number of files to be created: {SplitFilesAmount}" + Environment.NewLine);

        if (ErrorList.Count > 0)
        {
            outcomes.Append($"ErrorList: {string.Join("; ", ErrorList)}" + Environment.NewLine);
        }

        return outcomes.ToString();
    }

    /// <summary>
    ///   Generates a new output file name for the split process by incrementing the file count and combining it with the base file name and file extension. The method ensures that the generated file name is unique and follows a consistent naming convention based on the original input file. It also adds the generated file path to the list of output files for tracking purposes.
    /// </summary>
    /// <returns>The full path of the newly generated output file.</returns>
    public string GetNewFilename()
    {
        // increment file count and return the new path
        FileCount += 1;

        var paddedFileCount = FileCount.ToString(CultureInfo.InvariantCulture).PadLeft(SplitFilesAmountLength, '0');
#pragma warning disable IDE0045
        if (!string.IsNullOrEmpty(OutputDirectory))
#pragma warning restore IDE0045
        {
            OutputFileFullPath = Path.Combine(OutputDirectory, $"{BaseFileName}_{paddedFileCount}{FileExtension}");
        }
        else
        {
            OutputFileFullPath =
                Path.Combine(Directory.GetCurrentDirectory(), $"{BaseFileName}_{FileCount}{FileExtension}");
        }

        OutputFiles.Add(OutputFileFullPath);

        return OutputFileFullPath;
    }
}