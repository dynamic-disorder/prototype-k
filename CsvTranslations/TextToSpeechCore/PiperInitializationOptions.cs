namespace TextToSpeechCore;

/// <summary>
///     Options that control where Piper assets (the engine and the voice models) are cached and how
///     long a cached asset is reused before it is downloaded and extracted again.
/// </summary>
public sealed class PiperInitializationOptions
{
    /// <summary>
    ///     The default number of days an installed asset is reused: two weeks.
    /// </summary>
    public const int DefaultCacheTtlDays = 14;

    /// <summary>
    ///     The directory that holds the Piper engine (<c>piper</c>) and the voice models
    ///     (<c>models</c>) sub-directories. When null or empty, the current working directory is
    ///     used, which is PiperSharp's own default.
    /// </summary>
    public string? AssetRootDirectory { get; set; }

    /// <summary>
    ///     How many days an installed asset stays fresh. Once it is older than this, it is downloaded
    ///     and extracted again. Use <c>0</c> or a negative value to keep cached assets forever.
    /// </summary>
    public int CacheTtlDays { get; set; } = DefaultCacheTtlDays;

    /// <summary>
    ///     Resolves <see cref="CacheTtlDays"/> to the <see cref="TimeSpan"/> used by
    ///     <see cref="PiperAssetCache"/>, mapping a non-positive value to
    ///     <see cref="TimeSpan.MaxValue"/> ("never expires").
    /// </summary>
    /// <returns>The cache time-to-live to apply.</returns>
    public TimeSpan ResolveCacheTtl()
    {
        if (CacheTtlDays <= 0)
        {
            return TimeSpan.MaxValue;
        }

        return TimeSpan.FromDays(CacheTtlDays);
    }
}
