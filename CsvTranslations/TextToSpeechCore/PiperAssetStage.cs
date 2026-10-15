namespace TextToSpeechCore;

/// <summary>
///     The stage a single Piper asset (the engine or a voice model) has reached while it is being
///     prepared, as reported through <see cref="PiperAssetProgress"/>.
/// </summary>
public enum PiperAssetStage
{
    /// <summary>
    ///     The on-disk cache is being inspected to decide whether the asset has to be downloaded.
    /// </summary>
    Checking,

    /// <summary>
    ///     The asset is already on disk and still fresh, so nothing was downloaded or extracted.
    /// </summary>
    CacheHit,

    /// <summary>
    ///     The asset is being downloaded.
    /// </summary>
    Downloading,

    /// <summary>
    ///     The downloaded asset is being extracted (engine archive) or written to disk (voice files).
    /// </summary>
    Extracting,

    /// <summary>
    ///     The asset was downloaded, extracted and is now installed.
    /// </summary>
    Installed,

    /// <summary>
    ///     Preparing the asset failed; <see cref="PiperAssetProgress.Message"/> holds the reason.
    /// </summary>
    Failed
}
