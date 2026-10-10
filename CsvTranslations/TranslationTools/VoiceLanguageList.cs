namespace TranslationTools;

/// <summary>
///   Represents a list of voice languages, with a default voice language that can be accessed. This class inherits from List<VoiceLanguage>, allowing it to hold multiple VoiceLanguage instances, each representing a specific language. The DefaultVoice property provides a convenient way to access a default voice language, which is initialized to the system language if not already set. The ToString method is overridden to provide a readable string representation of the list of voice languages, making it easier to visualize the contents of the list when debugging or displaying information about the available languages.
/// </summary>
public class VoiceLanguageList : List<VoiceLanguage>
{
    /// <summary>
    /// A private field that holds the default voice language. This field is used internally to store the default voice language, which can be accessed through the DefaultVoice property. The default voice language is initialized to null and is set to the system language when accessed for the first time if it has not been explicitly set. This approach allows for lazy initialization of the default voice language, ensuring that it is only determined when needed, while also providing a fallback to the system language to maintain functionality in cases where no specific default has been defined.
    /// </summary>
    private VoiceLanguage? _voiceLanguage;

    /// <summary>
    /// Gets the default voice language. If the default voice language has not been set, it initializes it to the system language and returns it. This property provides a convenient way to access a default voice language, ensuring that there is always a valid language available for use in the translation process. By checking if the _voiceLanguage field is null, it allows for lazy initialization, setting the default to the system language only when it is first accessed, which can help optimize performance and resource usage in cases where the default voice language may not be needed immediately.
    /// </summary>
    public VoiceLanguage DefaultVoice
    {
        get
        {
            if (_voiceLanguage != null)
            {
                return _voiceLanguage;
            }

            _voiceLanguage = VoiceLanguage.System;
            return _voiceLanguage;
        }
    }

    /// <summary>
    /// Returns a string representation of the list of voice languages. This method overrides the default ToString implementation to provide a more meaningful and readable output that lists all the voice languages contained in the VoiceLanguageList. It uses LINQ to select the LanguageName property of each VoiceLanguage instance in the list and joins them into a single string separated by commas. This allows for easy visualization of the available voice languages when debugging or displaying information about the languages supported by the application.
    /// </summary>
    /// <returns></returns>
    public override string ToString()
    {
        var listString = string.Join(", ", this.Select(v => v.LanguageName.ToString()));
        return listString;
    }
}