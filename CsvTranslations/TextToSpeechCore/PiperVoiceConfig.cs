namespace TextToSpeechCore;

/// <summary>
///     Configuration for a single Piper voice mapped to a language in settings.json.
///     The Piper model key is composed from <see cref="LanguageCode"/>, <see cref="ModelCard"/>
///     and <see cref="ModelQuality"/> (e.g. <c>"vi_VN"</c> + <c>"vivos"</c> + <c>"x_low"</c>
///     produces the model key <c>"vi_VN-vivos-x_low"</c>).
/// </summary>
public sealed class PiperVoiceConfig
{
    /// <summary>
    ///     The Piper language code of the voice (e.g. <c>"vi_VN"</c>, <c>"fi_FI"</c>, <c>"en_GB"</c>).
    /// </summary>
    public string LanguageCode { get; set; } = string.Empty;

    /// <summary>
    ///     The model card / dataset name of the voice (e.g. <c>"vivos"</c>, <c>"harri"</c>).
    /// </summary>
    public string ModelCard { get; set; } = string.Empty;

    /// <summary>
    ///     The quality of the voice model (e.g. <c>"x_low"</c>, <c>"medium"</c>, <c>"high"</c>).
    /// </summary>
    public string ModelQuality { get; set; } = string.Empty;

    /// <summary>
    ///     Optional speaker name (e.g. <c>"VIVOSDEV09"</c>) resolved via the model's
    ///     <c>speaker_id_map</c> when <see cref="SpeakerId"/> is not a valid numeric id.
    /// </summary>
    public string? SpeakerName { get; set; }

    /// <summary>
    ///     Optional numeric speaker id passed to piper as <c>--speaker <id></c>.
    ///     When empty and <see cref="SpeakerName"/> is set, the name is resolved via the
    ///     model's <c>speaker_id_map</c>. When neither is valid, piper uses the model default.
    /// </summary>
    public string? SpeakerId { get; set; }

    /// <summary>
    ///     Builds the Piper model key (e.g. <c>"vi_VN-vivos-x_low"</c>) from
    ///     <see cref="LanguageCode"/>, <see cref="ModelCard"/> and <see cref="ModelQuality"/>.
    /// </summary>
    public string BuildModelKey() => $"{LanguageCode}-{ModelCard}-{ModelQuality}";
}