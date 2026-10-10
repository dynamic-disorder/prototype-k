namespace TextToSpeechCore;

/// <summary>
///     A progress report for a single Piper asset (the TTS engine or one voice model) emitted while
///     <see cref="ITextToSpeechService.InitializeAsync"/> prepares it for use. Sizes are exposed both
///     as raw byte counts and as megabytes so a caller can render a live progress display.
/// </summary>
public sealed class PiperAssetProgress
{
    /// <summary>
    ///     Initializes a new instance of <see cref="PiperAssetProgress"/>.
    /// </summary>
    /// <param name="kind">The kind of asset this report describes.</param>
    /// <param name="assetKey">The asset identifier (the model key for a voice model).</param>
    /// <param name="stage">The stage the asset has reached.</param>
    /// <param name="message">A human-readable description suitable for display.</param>
    /// <param name="bytesReceived">The number of bytes received so far, when downloading.</param>
    /// <param name="totalBytes">The total number of bytes to receive, or <c>0</c> when unknown.</param>
    /// <param name="assetSizeBytes">The installed size of the asset in bytes, once it is known.</param>
    public PiperAssetProgress(
        PiperAssetKind kind,
        string assetKey,
        PiperAssetStage stage,
        string message,
        long bytesReceived = 0,
        long totalBytes = 0,
        long assetSizeBytes = 0)
    {
        Kind = kind;
        AssetKey = assetKey;
        Stage = stage;
        Message = message;
        BytesReceived = bytesReceived;
        TotalBytes = totalBytes;
        AssetSizeBytes = assetSizeBytes;
        AssetLabel = kind == PiperAssetKind.Engine ? "Piper TTS engine" : $"Voice model '{assetKey}'";
    }

    /// <summary>
    ///     The kind of asset this report describes.
    /// </summary>
    public PiperAssetKind Kind { get; }

    /// <summary>
    ///     The asset identifier: <see cref="PiperAssetInstaller.EngineAssetKey"/> for the engine,
    ///     the Piper model key (for example <c>"vi_VN-vivos-x_low"</c>) for a voice model.
    /// </summary>
    public string AssetKey { get; }

    /// <summary>
    ///     The stage the asset has reached.
    /// </summary>
    public PiperAssetStage Stage { get; }

    /// <summary>
    ///     A human-readable description of this report, including sizes in megabytes where known.
    /// </summary>
    public string Message { get; }

    /// <summary>
    ///     The number of bytes received so far, or <c>0</c> when not downloading.
    /// </summary>
    public long BytesReceived { get; }

    /// <summary>
    ///     The total number of bytes to receive, or <c>0</c> when the size is unknown.
    /// </summary>
    public long TotalBytes { get; }

    /// <summary>
    ///     The installed size of the asset on disk in bytes, or <c>0</c> until it is known.
    /// </summary>
    public long AssetSizeBytes { get; }

    /// <summary>
    ///     A stable display label for the asset, used to group reports into one progress row
    ///     (for example <c>"Piper TTS engine"</c> or <c>"Voice model 'vi_VN-vivos-x_low'"</c>).
    /// </summary>
    public string AssetLabel { get; }

    /// <summary>
    ///     The number of bytes received so far in megabytes.
    /// </summary>
    public double ReceivedMegabytes
    {
        get
        {
            return PiperSizeFormatter.ToMegabytes(BytesReceived);
        }
    }

    /// <summary>
    ///     The total number of bytes to receive in megabytes.
    /// </summary>
    public double TotalMegabytes
    {
        get
        {
            return PiperSizeFormatter.ToMegabytes(TotalBytes);
        }
    }

    /// <summary>
    ///     The installed size of the asset in megabytes.
    /// </summary>
    public double AssetMegabytes
    {
        get
        {
            return PiperSizeFormatter.ToMegabytes(AssetSizeBytes);
        }
    }

    /// <summary>
    ///     How far the download has progressed, as a percentage between 0 and 100.
    ///     <c>0</c> when the total size is unknown.
    /// </summary>
    public int PercentComplete
    {
        get
        {
            return CalculatePercentComplete(BytesReceived, TotalBytes);
        }
    }

    /// <summary>
    ///     <c>true</c> when the total size is not known, so progress can only be shown as
    ///     "bytes received" without a percentage.
    /// </summary>
    public bool IsIndeterminate
    {
        get
        {
            return TotalBytes <= 0;
        }
    }

    /// <summary>
    ///     <c>true</c> when no further reports are expected because the asset is cached or installed.
    /// </summary>
    public bool IsComplete
    {
        get
        {
            return Stage is PiperAssetStage.CacheHit or PiperAssetStage.Installed;
        }
    }

    /// <summary>
    ///     <c>true</c> when preparing the asset failed.
    /// </summary>
    public bool IsFailed
    {
        get
        {
            return Stage == PiperAssetStage.Failed;
        }
    }

    /// <summary>
    ///     Calculates the completion percentage of a download.
    /// </summary>
    /// <param name="bytesReceived">The number of bytes received so far.</param>
    /// <param name="totalBytes">The total number of bytes, or <c>0</c> when unknown.</param>
    /// <returns>A percentage between 0 and 100, or <c>0</c> when the total is unknown.</returns>
    public static int CalculatePercentComplete(long bytesReceived, long totalBytes)
    {
        if (bytesReceived <= 0 || totalBytes <= 0)
        {
            return 0;
        }

        int percentComplete = (int)Math.Round(bytesReceived * 100.0 / totalBytes, MidpointRounding.AwayFromZero);

        return Math.Clamp(percentComplete, 0, 100);
    }

    /// <inheritdoc/>
    public override string ToString()
    {
        return $"{AssetLabel}: {Message}";
    }
}
