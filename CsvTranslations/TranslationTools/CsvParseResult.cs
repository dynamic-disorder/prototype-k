namespace TranslationTools;

/// <summary>
/// Represents the result of parsing CSV lines from a translations file.
/// </summary>
public class CsvParseResult
{
    /// <summary>
    /// Gets the header line from the CSV file.
    /// </summary>
    public string HeaderLine { get; }

    /// <summary>
    /// Gets the CSV data lines (excluding the header).
    /// </summary>
    public string[] CsvLines { get; }

    /// <summary>
    /// Initializes a new instance of the <see cref="CsvParseResult"/> class.
    /// </summary>
    /// <param name="headerLine">The header line from the CSV file.</param>
    /// <param name="csvLines">The CSV data lines (excluding the header).</param>
    public CsvParseResult(string headerLine, string[] csvLines)
    {
        HeaderLine = headerLine;
        CsvLines = csvLines;
    }

    /// <summary>
    /// Gets a value indicating whether the result contains any CSV lines.
    /// </summary>
    public bool HasLines => CsvLines.Length > 0;

    /// <summary>
    /// Deconstructs the result into a header line and CSV lines.
    /// </summary>
    /// <param name="headerLine">The header line.</param>
    /// <param name="csvLines">The CSV data lines.</param>
    public void Deconstruct(out string headerLine, out string[] csvLines)
    {
        headerLine = HeaderLine;
        csvLines = CsvLines;
    }
}
