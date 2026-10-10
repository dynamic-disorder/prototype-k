namespace TranslationTools;

/// <summary>
/// Defines the types of languages that can be used in the translation process. 
/// This enumeration includes values for None, Source, Target, and System languages, 
/// allowing for clear categorization and identification of the different language 
/// roles within the translation workflow. 
/// </summary>
public enum LanguageTypes
{
    /// <summary>
    /// Represents the absence of a specific language type. 
    /// This value can be used as a default or placeholder when no language type is 
    /// applicable or when the language type is not yet determined in the translation process. 
    /// It serves as a way to indicate that no particular language role has been assigned or 
    /// identified for a given context within the application.
    /// </summary>
    None,
    /// <summary>
    /// Represents the source language in the translation process. 
    /// This value is used to indicate the language of the original text that is being translated.
    /// </summary>
    Source,
    /// <summary>
    /// Represents the target language in the translation process. 
    /// This value is used to indicate the language into which the original text is being translated.
    /// </summary>
    Target,
    /// <summary>
    /// Represents the system language in the translation process. 
    /// This value is used to indicate the language used by the system or application for internal 
    /// operations or messages.
    /// </summary>
    System
}