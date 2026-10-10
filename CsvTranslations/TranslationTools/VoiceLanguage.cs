using System.Globalization;

namespace TranslationTools;

/// <summary>
/// Represents a voice language used by the translation tools.
/// </summary>
/// <param name="englishLanguageName">The English name of the language (e.g. "English", "Spanish").</param>
/// <param name="languageType">The <see cref="LanguageTypes"/> classification for the language.</param>
public class VoiceLanguage(string englishLanguageName, LanguageTypes languageType)
{
    private static VoiceLanguage? _emptyVoiceLanguage;
    private static VoiceLanguage? _systemVoiceLanguage;

    /// <summary>
    /// Gets the English display name of the language.
    /// </summary>
    public string LanguageName { get; } = englishLanguageName;

    //TODO: use LanguageType
    /// <summary>
    /// Gets the language classification for this voice language.
    /// </summary>
    public LanguageTypes LanguageType { get; } = languageType;

    /// <summary>
    /// Gets the <see cref="CultureInfo"/> associated with this language.
    /// Returns a specific culture created from the neutral culture matched by <see cref="LanguageName"/>,
    /// or the current culture as a fallback.
    /// </summary>
    public CultureInfo LanguageCulture { get; } = GetNeutralCulture(englishLanguageName);

    public static VoiceLanguage Empty
    {
        get
        {
            if (_emptyVoiceLanguage != null)
            {
                return _emptyVoiceLanguage;
            }
            _emptyVoiceLanguage = new VoiceLanguage(string.Empty, LanguageTypes.None);
            return _emptyVoiceLanguage;
        }
    }

    public static VoiceLanguage System
    {
        get
        {
            if (_systemVoiceLanguage != null)
            {
                return _systemVoiceLanguage;
            }
            var englishName = CultureInfo.CurrentCulture.EnglishName.Split(' ')[0];
            _systemVoiceLanguage = new VoiceLanguage(englishName, LanguageTypes.System);
            return _systemVoiceLanguage;
        }
    }

    /// <summary>
    /// Attempts to find a neutral <see cref="CultureInfo"/> whose English name matches
    /// the provided <paramref name="languageName"/> (case-insensitive). If no match is found,
    /// the current culture is returned as a fallback. When a neutral culture is found,
    /// a specific culture is created and returned.
    /// </summary>
    /// <param name="languageName">The English name of the language to locate.</param>
    /// <returns>A <see cref="CultureInfo"/> representing the specific culture for the language, or the current culture if not found.</returns>
    private static CultureInfo GetNeutralCulture(string languageName)
    {
        CultureInfo? neutral = CultureInfo.GetCultures(CultureTypes.NeutralCultures)
            .FirstOrDefault(c =>
                c.EnglishName.Equals(languageName, StringComparison.OrdinalIgnoreCase));

        if (neutral == null)
        {
            return CultureInfo.CurrentCulture; // Fallback to current culture if not found
        }

        var lang = CultureInfo.CreateSpecificCulture(neutral.Name);

        return lang;
    }

    public override string ToString()
    {
        return LanguageName;
    }
}