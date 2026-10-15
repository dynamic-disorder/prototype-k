using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

using PiperSharp;

namespace TextToSpeechCore;

/// <summary>
///     Tracks which Piper assets (the engine and each voice model) are already on disk and how old
///     they are, so an asset that is still within its time-to-live is reused instead of being
///     downloaded and extracted again. Freshness is recorded in a small JSON manifest per asset
///     (<c>.piper-cache.json</c>). When no manifest is present, the newest file timestamp in the
///     asset directory is used instead, so assets downloaded before the manifest existed are still
///     recognised as fresh.
/// </summary>
public sealed class PiperAssetCache
{
    /// <summary>
    ///     The name of the per-asset manifest file that records when an asset was installed.
    /// </summary>
    public const string ManifestFileName = ".piper-cache.json";

    /// <summary>
    ///     The name of the sub-directory that holds the Piper engine.
    /// </summary>
    public const string EngineDirectoryName = "piper";

    /// <summary>
    ///     The name of the sub-directory that holds the Piper voice models.
    /// </summary>
    public const string ModelsDirectoryName = "models";

    /// <summary>
    ///     The default time-to-live of an installed asset: two weeks.
    /// </summary>
    public static readonly TimeSpan DefaultCacheTtl = TimeSpan.FromDays(PiperInitializationOptions.DefaultCacheTtlDays);

    private static readonly JsonSerializerOptions ManifestSerializerOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly Func<DateTimeOffset> _utcNowProvider;

    /// <summary>
    ///     Initializes a new instance of <see cref="PiperAssetCache"/>.
    /// </summary>
    /// <param name="assetRootDirectory">
    ///     The directory that contains the <c>piper</c> engine and the <c>models</c> directory. When
    ///     null or empty, PiperSharp's default location (the current working directory) is used.
    /// </param>
    /// <param name="cacheTtl">
    ///     How long an installed asset stays fresh. Defaults to <see cref="DefaultCacheTtl"/>
    ///     (two weeks); <see cref="TimeSpan.MaxValue"/> keeps assets forever.
    /// </param>
    /// <param name="utcNowProvider">
    ///     The clock used to age assets. Defaults to <see cref="DateTimeOffset.UtcNow"/>; tests can
    ///     inject a fixed clock.
    /// </param>
    public PiperAssetCache(
        string? assetRootDirectory = null,
        TimeSpan? cacheTtl = null,
        Func<DateTimeOffset>? utcNowProvider = null)
    {
        string root = string.IsNullOrWhiteSpace(assetRootDirectory)
            ? PiperDownloader.DefaultLocation
            : assetRootDirectory;

        AssetRootDirectory = Path.GetFullPath(root);
        CacheTtl = cacheTtl ?? DefaultCacheTtl;
        _utcNowProvider = utcNowProvider ?? (() => DateTimeOffset.UtcNow);
        EngineDirectory = Path.Join(AssetRootDirectory, EngineDirectoryName);
        ModelsDirectory = Path.Join(AssetRootDirectory, ModelsDirectoryName);
    }

    /// <summary>
    ///     The directory that contains the <c>piper</c> engine and the <c>models</c> directory.
    /// </summary>
    public string AssetRootDirectory { get; }

    /// <summary>
    ///     The directory that holds the Piper engine (PiperSharp's release archive extracts here).
    /// </summary>
    public string EngineDirectory { get; }

    /// <summary>
    ///     The directory that holds one sub-directory per installed Piper voice model.
    /// </summary>
    public string ModelsDirectory { get; }

    /// <summary>
    ///     How long an installed asset stays fresh before it is downloaded and extracted again.
    /// </summary>
    public TimeSpan CacheTtl { get; }

    /// <summary>
    ///     Gets the directory that holds a single voice model.
    /// </summary>
    /// <param name="modelKey">The Piper model key, for example <c>"vi_VN-vivos-x_low"</c>.</param>
    /// <returns>The absolute path of the model directory.</returns>
    public string GetModelDirectory(string modelKey)
    {
        return Path.Join(ModelsDirectory, modelKey);
    }

    /// <summary>
    ///     Gets the path of the cache manifest for an asset directory.
    /// </summary>
    /// <param name="assetDirectory">The directory that holds the asset.</param>
    /// <returns>The absolute path of the manifest file.</returns>
    public static string GetManifestPath(string assetDirectory)
    {
        return Path.Join(assetDirectory, ManifestFileName);
    }

    /// <summary>
    ///     Inspects the cache entry of an asset: whether every required file is present and whether
    ///     the newest recorded install time is still within <see cref="CacheTtl"/>.
    /// </summary>
    /// <param name="kind">The kind of asset being inspected.</param>
    /// <param name="assetKey">The asset identifier (the model key for a voice model).</param>
    /// <param name="assetDirectory">The directory that holds the asset.</param>
    /// <param name="requiredRelativePaths">
    ///     The files the asset must contain, relative to <paramref name="assetDirectory"/>.
    /// </param>
    /// <returns>The inspection result, including the reason for the verdict.</returns>
    public PiperAssetCacheStatus InspectAsset(
        PiperAssetKind kind,
        string assetKey,
        string assetDirectory,
        IReadOnlyCollection<string> requiredRelativePaths)
    {
        var missingRelativePaths = new List<string>();
        foreach (string relativePath in requiredRelativePaths)
        {
            string fullPath = Path.Join(assetDirectory, relativePath);
            if (!File.Exists(fullPath) && !Directory.Exists(fullPath))
            {
                missingRelativePaths.Add(relativePath);
            }
        }

        DateTimeOffset? installedUtc = TryReadManifestInstallTime(assetDirectory);
        if (installedUtc is null)
        {
            installedUtc = TryGetNewestWriteTimeUtc(assetDirectory);
        }

        TimeSpan? age = installedUtc is null ? null : _utcNowProvider() - installedUtc.Value;
        long sizeBytes = GetDirectorySizeBytes(assetDirectory);

        bool isFresh = missingRelativePaths.Count == 0
            && age is not null
            && age.Value <= CacheTtl;

        return new PiperAssetCacheStatus(
            kind,
            assetKey,
            isFresh,
            installedUtc,
            age,
            sizeBytes,
            missingRelativePaths,
            BuildReason(missingRelativePaths, installedUtc, age, isFresh));
    }

    /// <summary>
    ///     Records that an asset was installed now, by writing its cache manifest. The next
    ///     <see cref="InspectAsset"/> call then reports the asset as fresh until
    ///     <see cref="CacheTtl"/> has passed.
    /// </summary>
    /// <param name="kind">The kind of asset that was installed.</param>
    /// <param name="assetKey">The asset identifier (the model key for a voice model).</param>
    /// <param name="assetDirectory">The directory that holds the asset.</param>
    /// <param name="sizeBytes">The installed size of the asset in bytes.</param>
    public void RecordAssetInstall(PiperAssetKind kind, string assetKey, string assetDirectory, long sizeBytes)
    {
        var manifest = new PiperAssetManifest
        {
            AssetKey = assetKey,
            Kind = kind,
            InstalledUtc = _utcNowProvider(),
            SizeBytes = sizeBytes
        };

        Directory.CreateDirectory(assetDirectory);
        File.WriteAllText(GetManifestPath(assetDirectory), JsonSerializer.Serialize(manifest, ManifestSerializerOptions));
    }

    /// <summary>
    ///     Sums the size of every file below a directory, ignoring cache manifests so the reported
    ///     size reflects the asset itself.
    /// </summary>
    /// <param name="directory">The directory to measure.</param>
    /// <returns>The total size in bytes; <c>0</c> when the directory does not exist.</returns>
    public static long GetDirectorySizeBytes(string directory)
    {
        long sizeBytes = 0;

        foreach (string filePath in EnumerateFilesSafely(directory))
        {
            if (string.Equals(Path.GetFileName(filePath), ManifestFileName, StringComparison.Ordinal))
            {
                continue;
            }

            try
            {
                sizeBytes += new FileInfo(filePath).Length;
            }
            catch (IOException)
            {
                // A file that disappears while it is measured simply does not count towards the size.
            }
        }

        return sizeBytes;
    }

    /// <summary>
    ///     Finds the most recent write time of any file below a directory.
    /// </summary>
    /// <param name="directory">The directory to inspect.</param>
    /// <returns>The newest write time, or <c>null</c> when the directory holds no files.</returns>
    public static DateTimeOffset? TryGetNewestWriteTimeUtc(string directory)
    {
        DateTimeOffset? newestWriteTimeUtc = null;

        foreach (string filePath in EnumerateFilesSafely(directory))
        {
            try
            {
                var writeTimeUtc = new DateTimeOffset(File.GetLastWriteTimeUtc(filePath), TimeSpan.Zero);
                if (newestWriteTimeUtc is null || writeTimeUtc > newestWriteTimeUtc.Value)
                {
                    newestWriteTimeUtc = writeTimeUtc;
                }
            }
            catch (IOException)
            {
                // A file that disappears while it is inspected cannot age the asset.
            }
        }

        return newestWriteTimeUtc;
    }

    private static IEnumerable<string> EnumerateFilesSafely(string directory)
    {
        if (!Directory.Exists(directory))
        {
            return [];
        }

        try
        {
            return Directory.EnumerateFiles(directory, "*", SearchOption.AllDirectories);
        }
        catch (DirectoryNotFoundException)
        {
            return [];
        }
    }

    private string BuildReason(
        List<string> missingRelativePaths,
        DateTimeOffset? installedUtc,
        TimeSpan? age,
        bool isFresh)
    {
        if (missingRelativePaths.Count > 0)
        {
            return $"missing {missingRelativePaths.Count} file(s): {string.Join(", ", missingRelativePaths)}";
        }

        if (installedUtc is null || age is null)
        {
            return "no files on disk";
        }

        if (isFresh)
        {
            return $"cached {FormatDays(age.Value)} day(s) ago, within {DescribeCacheTtl()}";
        }

        return $"cache age of {FormatDays(age.Value)} day(s) exceeds {DescribeCacheTtl()}";
    }

    private string DescribeCacheTtl()
    {
        if (CacheTtl == TimeSpan.MaxValue)
        {
            return "an unlimited time-to-live";
        }

        return $"a {FormatDays(CacheTtl)} day time-to-live";
    }

    private static string FormatDays(TimeSpan timeSpan)
    {
        return timeSpan.TotalDays.ToString("0.0", CultureInfo.InvariantCulture);
    }

    private static DateTimeOffset? TryReadManifestInstallTime(string assetDirectory)
    {
        string manifestPath = Path.Join(assetDirectory, ManifestFileName);
        if (!File.Exists(manifestPath))
        {
            return null;
        }

        try
        {
            PiperAssetManifest? manifest = JsonSerializer.Deserialize<PiperAssetManifest>(
                File.ReadAllText(manifestPath),
                ManifestSerializerOptions);

            return manifest?.InstalledUtc;
        }
        catch (JsonException)
        {
            return null;
        }
        catch (IOException)
        {
            return null;
        }
    }

    /// <summary>
    ///     The JSON shape of a cache manifest. Only <see cref="InstalledUtc"/> decides whether the
    ///     asset is still fresh; the other values are informational.
    /// </summary>
    private sealed class PiperAssetManifest
    {
        public string AssetKey { get; set; } = string.Empty;

        public PiperAssetKind Kind { get; set; }

        public DateTimeOffset InstalledUtc { get; set; }

        public long SizeBytes { get; set; }
    }
}
