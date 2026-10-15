namespace TranslationTools;

/// <summary>
/// Represents a collection of translation entries together with
/// the associated voice languages.
/// </summary>
public class TranslationEntryList
{
    /// <summary>
    /// Gets or sets the list of available voice languages for the entries.
    /// </summary>
    public VoiceLanguageList VoiceLanguages { get; set; } = [];

    /// <summary>
    /// Gets the number of entries in the list.
    /// </summary>
    public int Count
    {
        get
        {
            return Entries.Count;
        }
    }

    /// <summary>
    /// Gets or sets the list of text entry rows contained in this collection.
    /// </summary>
    public List<TextEntryRow> Entries { get; set; } = new();

    /// <summary>
    /// Gets a value indicating whether the list contains a single voice language.
    /// </summary>
    public bool IsSingleLanguage
    {
        get
        {
            var isSourceOnly = VoiceLanguages.Count == 1;
            return isSourceOnly;
        }
    }

    /// <summary>
    /// Gets or sets a value indicating whether these entries are translation-entry translations.
    /// The setter is internal and intended for use within the assembly.
    /// </summary>
    public bool IsTranslationEntryTranslations { get; internal set; }

    /// <summary>
    /// Gets the <see cref="TextEntryRow"/> at the specified index.
    /// </summary>
    /// <param name="index">The zero-based index of the entry to get.</param>
    /// <returns>The <see cref="TextEntryRow"/> at the specified index.</returns>
    public TextEntryRow this[int index]
    {
        get
        {
            return Entries[index];
        }
    }

    /// <summary>
    /// Adds a <see cref="TextEntryRow"/> to the end of the list.
    /// </summary>
    /// <param name="entryRow">The entry row to add.</param>
    public void Add(TextEntryRow entryRow)
    {
        Entries.Add(entryRow);
    }

    /// <summary>
    /// Loads translation entries from CSV lines using the provided header line.
    /// This method uses the <see cref="TranslationsParser"/> to parse the CSV data
    /// and populate this list's voice languages and entries.
    /// </summary>
    /// <param name="headerLine">The header line from the CSV file</param>
    /// <param name="csvLines">The CSV data lines (excluding the header)</param>
    public void LoadFromCsvLines(string headerLine, string[] csvLines)
    {
        TranslationsParser.ParseInto(this, headerLine, csvLines);
    }
}
