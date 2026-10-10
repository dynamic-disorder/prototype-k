namespace TextToSpeechCore;

/// <summary>
///     The kind of Piper asset that <see cref="PiperAssetInstaller"/> prepares for use.
/// </summary>
public enum PiperAssetKind
{
    /// <summary>
    ///     The Piper TTS engine itself (the native piper executable and its support files).
    /// </summary>
    Engine,

    /// <summary>
    ///     A Piper voice model (the <c>.onnx</c> model file plus its support files).
    /// </summary>
    VoiceModel
}
