namespace TranslationTools;

/// <summary>
///   Represents a row of text entries, where each entry corresponds to a specific language. 
///   This class inherits from List<TextEntry>, allowing it to hold multiple TextEntry instances, 
///   each containing a language code and its associated text content. The GetAllAsString method provides a way to retrieve all text entries in the row as a formatted string, making it easier to visualize the contents of the row in a readable format. Each entry is displayed with its language code and text content, separated by new lines for clarity.
/// </summary>
public class TextEntryRow : List<TextEntry>
{
    /// <summary>
    ///   Returns a string representation of all text entries in the row, 
    ///   formatted with each entry's language code and text content. 
    ///   This method provides a convenient way to visualize the contents of the row in
    ///   a readable format, with each entry displayed on a new line.
    /// </summary>
    /// <returns>A string representation of all text entries in the row.</returns>
    public string GetAllAsString()
    {
        return Environment.NewLine + string.Join($"{Environment.NewLine}",
            this.Select(e => $"  {e.Language.LanguageCulture.TwoLetterISOLanguageName}: {e.Text}"));
    }
}