using PiperSharp.Models;

namespace TextToSpeechCore;

/// <summary>
///     The outcome of preparing (or reusing) a single Piper asset. Instances are created by
///     <see cref="PiperAssetInstaller"/>; use <see cref="IsAvailable"/> to tell a usable asset from a
///     failed download, and <see cref="Message"/> for a human-readable summary with sizes in
///     megabytes.
/// </summary>
public sealed class PiperAssetInstallResult
{
    private PiperAssetInstallResult(
        bool isAvailable,
        bool wasCached,
        string message,
        string? directoryPath,
        long sizeBytes,
        VoiceModel? model)
    {
        IsAvailable = isAvailable;
        WasCached = wasCached;
        Message = message;
        DirectoryPath = directoryPath;
        SizeBytes = sizeBytes;
        Model = model;
    }

    /// <summary>
    ///     Whether the asset is on disk and usable.
    /// </summary>
    public bool IsAvailable { get; }

    /// <summary>
    ///     Whether the asset was reused from the cache instead of being downloaded.
    /// </summary>
    public bool WasCached { get; }

    /// <summary>
    ///     A human-readable summary of the outcome, including the size in megabytes.
    /// </summary>
    public string Message { get; }

    /// <summary>
    ///     The directory that holds the asset, or <c>null</c> when the asset is not available.
    /// </summary>
    public string? DirectoryPath { get; }

    /// <summary>
    ///     The size of the asset on disk in bytes, or <c>0</c> when the asset is not available.
    /// </summary>
    public long SizeBytes { get; }

    /// <summary>
    ///     The loaded voice model for a voice model asset; <c>null</c> for the engine.
    /// </summary>
    public VoiceModel? Model { get; }

    /// <summary>
    ///     Creates a result for an asset that was reused from the cache.
    /// </summary>
    /// <param name="message">A human-readable summary including the size.</param>
    /// <param name="directoryPath">The directory that holds the asset.</param>
    /// <param name="sizeBytes">The size of the asset on disk in bytes.</param>
    /// <param name="model">The loaded voice model, when the asset is a voice model.</param>
    /// <returns>The cache-hit result.</returns>
    public static PiperAssetInstallResult FromCache(string message, string directoryPath, long sizeBytes, VoiceModel? model = null)
    {
        return new PiperAssetInstallResult(true, true, message, directoryPath, sizeBytes, model);
    }

    /// <summary>
    ///     Creates a result for an asset that was just downloaded and installed.
    /// </summary>
    /// <param name="message">A human-readable summary including the size.</param>
    /// <param name="directoryPath">The directory that holds the asset.</param>
    /// <param name="sizeBytes">The size of the asset on disk in bytes.</param>
    /// <param name="model">The loaded voice model, when the asset is a voice model.</param>
    /// <returns>The installed result.</returns>
    public static PiperAssetInstallResult Installed(string message, string directoryPath, long sizeBytes, VoiceModel? model = null)
    {
        return new PiperAssetInstallResult(true, false, message, directoryPath, sizeBytes, model);
    }

    /// <summary>
    ///     Creates a result for an asset that could not be prepared.
    /// </summary>
    /// <param name="message">A human-readable explanation of the failure.</param>
    /// <returns>The unavailable result.</returns>
    public static PiperAssetInstallResult Unavailable(string message)
    {
        return new PiperAssetInstallResult(false, false, message, null, 0, null);
    }

    /// <inheritdoc/>
    public override string ToString()
    {
        return Message;
    }
}
