namespace TextFileSplitterApp;

/// <summary>
/// Formats text files containing translation entries.
/// Reads an input file, transforms each line into a translation entry
/// and writes the formatted results to a new file with the
/// <c>_formatted.txt</c> suffix in the same directory.
/// </summary>
public class TranslationEntryFormatter
{
    /// <summary>
    /// Reads the file at <paramref name="filePath"/>, transforms each non-empty line
    /// into a translation entry (wrapped in an <c>&lt;entry&gt;</c> tag by default),
    /// and writes the formatted lines to a new file named
    /// <c>{originalName}_formatted.txt</c> in the same directory.
    /// </summary>
    /// <param name="filePath">The path to the input file to format.</param>
    /// <returns>A task that represents the asynchronous formatting operation.</returns>
    public static async Task FormatFile(string filePath)
    {
        // Check if the file exists
        if (!File.Exists(filePath))
        {
            Console.WriteLine($"ErrorList: File not found at path: {filePath}");
            return;
        }

        // Define the output file path (same directory, different name)
        var paths = Path.GetDirectoryName(filePath) ?? string.Empty;
        var outputFilePath = Path.Combine(paths, Path.GetFileNameWithoutExtension(filePath) + "_formatted.txt");

        try
        {
            // Read the file line by line
            var lines = await File.ReadAllLinesAsync(filePath);

            // Process each line and format it
            var formattedLines = new List<string>();
            foreach (var line in lines)
            {
                // Example formatting: each line is wrapped in <entry> tags.
                var formattedLine = $"<entry>{line}</entry>";
                formattedLines.Add(formattedLine);
            }

            // Write the formatted lines to the output file
            await File.WriteAllLinesAsync(outputFilePath, formattedLines);

            Console.WriteLine($"File formatted and saved to: {outputFilePath}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"An error occurred while formatting: {ex.Message}");
        }
    }
}