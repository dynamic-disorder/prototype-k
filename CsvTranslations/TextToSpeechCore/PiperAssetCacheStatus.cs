namespace TextToSpeechCore;

/// <summary>
///     The outcome of inspecting the on-disk cache entry of a single Piper asset, as returned by
///     <see cref="PiperAssetCache.InspectAsset"/>.
/// </summary>
public sealed class PiperAssetCacheStatus
{
    /// <summary>
    ///     Initializes a new instance of <see cref="PiperAssetCacheStatus"/>.
    /// </summary>
    /// <param name="kind">The kind of asset that was inspected.</param>
    /// <param name="assetKey">The asset identifier (the model key for a voice model).</param>
    /// <param name="isFresh">Whether the asset can be reused as-is.</param>
    /// <param name="installedUtc">When the asset was installed, or <c>null</c> when unknown.</param>
    /// <param name="age">How long ago the asset was installed, or <c>null</c> when unknown.</param>
    /// <param name="sizeBytes">The total size of the asset on disk in bytes.</param>
    /// <param name="missingRelativePaths">The required files that are not present on disk.</param>
    /// <param name="reason">A human-readable explanation of the verdict.</param>
    public PiperAssetCacheStatus(
        PiperAssetKind kind,
        string assetKey,
        bool isFresh,
        DateTimeOffset? installedUtc,
        TimeSpan? age,
        long sizeBytes,
        IReadOnlyList<string> missingRelativePaths,
        string reason)
    {
        Kind = kind;
        AssetKey = assetKey;
        IsFresh = isFresh;
        InstalledUtc = installedUtc;
        Age = age;
        SizeBytes = sizeBytes;
        MissingRelativePaths = missingRelativePaths;
        Reason = reason;
    }

    /// <summary>
    ///     The kind of asset that was inspected.
    /// </summary>
    public PiperAssetKind Kind { get; }

    /// <summary>
    ///     The asset identifier (the model key for a voice model).
    /// </summary>
    public string AssetKey { get; }

    /// <summary>
    ///     Whether every required file is present and the asset is still within its time-to-live,
    ///     so it can be reused without downloading or extracting anything.
    /// </summary>
    public bool IsFresh { get; }

    /// <summary>
    ///     When the asset was installed, either from its cache manifest or from the newest file
    ///     timestamp. <c>null</c> when nothing is on disk.
    /// </summary>
    public DateTimeOffset? InstalledUtc { get; }

    /// <summary>
    ///     How long ago the asset was installed. <c>null</c> when nothing is on disk.
    /// </summary>
    public TimeSpan? Age { get; }

    /// <summary>
    ///     The total size of the asset on disk in bytes, excluding cache manifests.
    /// </summary>
    public long SizeBytes { get; }

    /// <summary>
    ///     The required files that are missing from the asset directory.
    /// </summary>
    public IReadOnlyList<string> MissingRelativePaths { get; }

    /// <summary>
    ///     A human-readable explanation of why the asset is (not) fresh.
    /// </summary>
    public string Reason { get; }

    /// <inheritdoc/>
    public override string ToString()
    {
        return $"{AssetKey}: {Reason}";
    }
}
