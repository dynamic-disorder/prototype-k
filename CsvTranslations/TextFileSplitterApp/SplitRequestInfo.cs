using System.Text;

namespace TextFileSplitterApp;

/// <summary>
///  Represents the information about a split request, including the input file path, total lines in the file, lines to split per file, estimated number of output files, and any errors encountered during the split request initialization. This class serves as a data container for the parameters and state of a split request, allowing for easy access and manipulation of this information throughout the splitting process.
/// </summary>
public class SplitRequestInfo
{
    /// <summary>
    /// Gets or sets the file path of the input file to be split. This property is essential for identifying the source file that will be processed during the split operation. It is expected to be a valid file path pointing to an existing text file that contains the data to be split into smaller files based on the specified parameters.
    /// </summary>
    public string InputFilepath { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the total number of lines in the input file. This property is used to determine how many lines are present in the original file, which is crucial for calculating how many output files will be created based on the specified number of lines to split per file. It is typically initialized during the split request setup by reading the input file and counting its lines.
    /// </summary>
    public int TotalLinesPerFile { get; set; }

    /// <summary>
    /// Gets or sets the number of lines to be included in each output file after the splitting process. This property defines the size of each split file and is used to calculate how many output files will be generated from the original input file. It is a key parameter for controlling the granularity of the split and can be set based on user input or other configuration settings.
    /// </summary>
    public int SplitLinesPerFile { get; set; }

    /// <summary>
    /// Gets or sets the estimated number of output files that will be created as a result of the splitting process. This property is calculated based on the total number of lines in the input file and the number of lines to split per file. It provides an estimate of how many files will be generated, which can be useful for logging, user feedback, or pre-allocating resources for handling the output files.
    /// </summary>
    public int SplitFilesAmount { get; set; }

    /// <summary>
    /// Gets or sets the header type to use when CSV file lacks SourceText/TargetText headers.
    /// "Hashtags" or "Semantics" or empty for default behavior.
    /// </summary>
    public string HeaderType { get; set; } = string.Empty;

    /// <summary>
    /// Gets any error messages encountered during the initialization of the split request. This property is used to capture and store any issues that arise while setting up the split request, such as invalid file paths, unreadable files, or other exceptions. It allows for error handling and reporting, enabling the application to provide feedback to the user or log errors for troubleshooting purposes.
    /// </summary>
    public List<string> ErrorMessages { get; internal set; } = [];

    /// <summary>
    /// Gets a value indicating whether the split request is valid (no errors).
    /// </summary>
    public bool IsValid => ErrorMessages.Count == 0;

    /// <summary>
    /// Gets a formatted error string combining all error messages.
    /// </summary>
    public string Error => ErrorMessages.Count > 0 ? string.Join("; ", ErrorMessages) : string.Empty;

    /// <summary>
    /// Returns a string representation of the split request information, including details about the input file, total lines, split parameters, estimated output files, and any errors. This method is useful for logging or displaying the current state of the split request in a human-readable format, allowing developers or users to understand the parameters and any issues associated with the split request at a glance.
    /// </summary>
    /// <returns>A string representation of the split request information.</returns>
    public override string ToString()
    {
        var outcomes = new StringBuilder();
        outcomes.Append($"Input file: {InputFilepath}" + Environment.NewLine);
        outcomes.Append($"Total lines in file: {TotalLinesPerFile}" + Environment.NewLine);
        outcomes.Append($"Max lines per file: {SplitLinesPerFile}" + Environment.NewLine);
        outcomes.Append($"Estimated number of files to be created: {SplitFilesAmount}" + Environment.NewLine);

        if (!string.IsNullOrEmpty(HeaderType))
        {
            outcomes.Append($"Header type: {HeaderType}" + Environment.NewLine);
        }

        if (ErrorMessages.Count > 0)
        {
            outcomes.Append($"ErrorList: {Error}" + Environment.NewLine);
        }

        return outcomes.ToString();
    }
}
