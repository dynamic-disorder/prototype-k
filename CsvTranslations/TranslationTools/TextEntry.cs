namespace TranslationTools;

/// <summary>
///     Represents a text entry with the language code.
/// </summary>
public class TextEntry
{
    /// <summary>
    ///     Presents an empty Entry.
    /// </summary>
    public static TextEntry Empty { get; } = new() { Language = VoiceLanguage.Empty, Text = string.Empty };

    /// <summary>
    ///     Language code (e.g., "en-GB")
    /// </summary>
    public VoiceLanguage Language { get; set; } = VoiceLanguage.Empty;

    /// <summary>
    ///     Text content.
    /// </summary>
    public string Text { get; set; } = string.Empty;

    public TextEntryType EntryType { get; set; } = TextEntryType.None;

    /// <summary>
    ///    Returns a string representation of the TextEntry, including the language code and text content. This method provides a convenient way to visualize the contents of a TextEntry instance, making it easier to debug or display the language and text information in a readable format. The output format is "Language: {Language}, Text: {Text}", where {Language} is the language code and {Text} is the associated text content.
    /// </summary>
    /// <returns>A string representation of the TextEntry.</returns>
    public override string ToString()
    {
        var plainString = $"Language: {Language}, Text: {Text}";

        if (EntryType != TextEntryType.None)
        {
            plainString += $", EntryType: {EntryType}";
        }

        return plainString;
    }
}

/// <summary>
/// Describes the type of text entry, such as source text, target translation, semantic information, or hashtags. 
/// This enumeration helps categorize different types of text entries in the translation process, 
/// allowing for better organization and handling of various text components. Each entry type can be used 
/// to identify the role of the text in the translation workflow, making it easier to manage and process translations effectively.
/// </summary>
public enum TextEntryType
{
    None = 0,
    Source = 1,
    Target = 2,
    Semantics = 3,
    Hashtags = 4
}