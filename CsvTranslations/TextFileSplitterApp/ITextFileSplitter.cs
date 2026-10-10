namespace TextFileSplitterApp;

/// <summary>
/// Defines functionality for splitting and formatting text files
/// for translation workflows.
/// </summary>
public interface ITextFileSplitter
{
    /// <summary>
    /// Formats the specified files as translation entries.
    /// Implementations may update the files in-place or create new output files.
    /// </summary>
    /// <param name="filePaths">A list of file paths to format.</param>
    /// <returns>A task that represents the asynchronous operation.</returns>
    Task FormatAsTranslationEntries(List<string> filePaths);

    /// <summary>
    /// Calculates splitting metadata for the given input file using the
    /// provided maximum lines per file constraint.
    /// </summary>
    /// <param name="filePath">The path to the input file to analyze.</param>
    /// <param name="maxLinesPerFile">The maximum number of lines allowed per split file.</param>
    /// <returns>
    /// A <see cref="SplitRequestInfo"/> instance containing calculated splitting values
    /// or an error message when the operation fails.
    /// </returns>
    Task<SplitRequestInfo> GetSplittingInformation(string filePath, int maxLinesPerFile);

    /// <summary>
    /// Counts the total number of non-empty lines in the specified file.
    /// </summary>
    /// <param name="filePath">The path of the file to count lines in.</param>
    /// <returns>A task that resolves to the total number of lines.</returns>
    Task<int> GetTotalLinesAsync(string filePath);

    /// <summary>
    /// Splits the input file according to the provided <see cref="SplitRequestInfo"/>
    /// and returns a <see cref="SplitProcessInfo"/> with details about the split operation.
    /// </summary>
    /// <param name="splitRequestInfo">Information describing how the file should be split.</param>
    /// <returns>
    /// A task that resolves to a <see cref="SplitProcessInfo"/> containing results,
    /// generated output file paths and any errors encountered.
    /// </returns>
    Task<SplitProcessInfo> SplitFileAsync(SplitRequestInfo splitRequestInfo);
}