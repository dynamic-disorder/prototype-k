using System.Net.Http;
using System.Text.Json;

using PiperSharp;
using PiperSharp.Models;

namespace TextToSpeechCore;

/// <summary>
///     Downloads and extracts the Piper engine and the Piper voice models, reusing everything that
///     <see cref="PiperAssetCache"/> reports as fresh. Every asset is prepared through an
///     <see cref="IProgress{T}"/> report of <see cref="PiperAssetProgress"/> values, so a caller can
///     show which asset is being downloaded and how many megabytes have arrived. A warm cache does
///     not touch the network at all.
/// </summary>
public sealed class PiperAssetInstaller
{
    /// <summary>
    ///     The asset key reported for the Piper TTS engine.
    /// </summary>
    public const string EngineAssetKey = "piper";

    /// <summary>
    ///     The name of the model info file that holds a voice model's metadata next to its model file.
    /// </summary>
    public const string VoiceModelInfoFileName = "model.json";

    /// <summary>
    ///     How often download progress is reported, so a large file does not flood the display.
    /// </summary>
    private static readonly TimeSpan ProgressReportInterval = TimeSpan.FromMilliseconds(100);

    private const string VoiceModelFileUrlTemplate = "https://huggingface.co/rhasspy/piper-voices/resolve/main/{0}?download=true";
    private const string StagingDirectoryName = ".piper-install-staging";
    private const string EngineArchiveFileName = "piper-download";
    private const string EngineExtractDirectoryName = "extract";
    private const string ModelConfigFileSuffix = ".onnx.json";
    private const int CopyBufferSize = 81920;

    /// <summary>
    ///     The model info file is written indented, exactly as the PiperSharp downloader writes it.
    /// </summary>
    private static readonly JsonSerializerOptions VoiceModelInfoSerializerOptions = new()
    {
        WriteIndented = true
    };

    private static readonly HttpClient SharedHttpClient = CreateSharedHttpClient();

    private readonly PiperAssetCache _cache;
    private readonly HttpClient _httpClient;
    private readonly Func<string, CancellationToken, Task<VoiceModel?>> _voiceModelMetadataProvider;
    private readonly Func<CancellationToken, Task<Stream>> _engineArchiveProvider;

    /// <summary>
    ///     Initializes a new instance of <see cref="PiperAssetInstaller"/>.
    /// </summary>
    /// <param name="cache">
    ///     The cache that decides whether an asset has to be downloaded. When null, a cache with
    ///     default options (rooted at the current working directory, two week time-to-live) is used.
    /// </param>
    /// <param name="httpClient">
    ///     The client used to download assets. Defaults to a shared client; tests can inject a stub.
    /// </param>
    /// <param name="voiceModelMetadataProvider">
    ///     Resolves a Piper model key to its download metadata (from the Piper voice list). Defaults
    ///     to <see cref="PiperDownloader.GetModelByKey"/>; tests can inject a stub that stays offline.
    /// </param>
    /// <param name="engineArchiveProvider">
    ///     Opens the Piper engine release archive for this platform. Defaults to
    ///     <see cref="PiperDownloader.DownloadPiper()"/> so upstream releases are followed without a
    ///     hard-coded URL here; tests can inject a stream instead.
    /// </param>
    public PiperAssetInstaller(
        PiperAssetCache? cache = null,
        HttpClient? httpClient = null,
        Func<string, CancellationToken, Task<VoiceModel?>>? voiceModelMetadataProvider = null,
        Func<CancellationToken, Task<Stream>>? engineArchiveProvider = null)
    {
        _cache = cache ?? new PiperAssetCache();
        _httpClient = httpClient ?? SharedHttpClient;
        _voiceModelMetadataProvider = voiceModelMetadataProvider ?? GetVoiceModelMetadataAsync;
        _engineArchiveProvider = engineArchiveProvider ?? DownloadEngineArchiveStreamAsync;
    }

    /// <summary>
    ///     The cache this installer stores assets in.
    /// </summary>
    public PiperAssetCache Cache
    {
        get
        {
            return _cache;
        }
    }

    /// <summary>
    ///     The path of the Piper executable inside the cached engine directory.
    /// </summary>
    public string EngineExecutablePath
    {
        get
        {
            return Path.Join(_cache.EngineDirectory, PiperDownloader.PiperExecutable);
        }
    }

    private static HttpClient CreateSharedHttpClient()
    {
        var httpClient = new HttpClient
        {
            Timeout = TimeSpan.FromMinutes(30)
        };

        httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("TextToSpeechApp/1.0");

        return httpClient;
    }

    private static async Task<VoiceModel?> GetVoiceModelMetadataAsync(string modelKey, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        return await PiperDownloader.GetModelByKey(modelKey);
    }

    private static async Task<Stream> DownloadEngineArchiveStreamAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        return await PiperDownloader.DownloadPiper();
    }

    /// <summary>
    ///     Makes sure the Piper engine is on disk, downloading and extracting the release archive
    ///     only when the cached copy is missing or older than the cache time-to-live.
    /// </summary>
    /// <param name="progress">Receives one report per stage of the operation; may be null.</param>
    /// <param name="cancellationToken">Cancels the download.</param>
    /// <returns>The outcome, including the engine directory and size in bytes.</returns>
    public async Task<PiperAssetInstallResult> EnsureEngineAsync(
        IProgress<PiperAssetProgress>? progress = null,
        CancellationToken cancellationToken = default)
    {
        Report(progress, new PiperAssetProgress(
            PiperAssetKind.Engine,
            EngineAssetKey,
            PiperAssetStage.Checking,
            "Checking whether the Piper TTS engine is already cached..."));

        PiperAssetCacheStatus cacheStatus = _cache.InspectAsset(
            PiperAssetKind.Engine,
            EngineAssetKey,
            _cache.EngineDirectory,
            [PiperDownloader.PiperExecutable]);

        if (cacheStatus.IsFresh)
        {
            string cachedMessage = $"Piper TTS engine is cached ({PiperSizeFormatter.Format(cacheStatus.SizeBytes)}).";
            Report(progress, new PiperAssetProgress(
                PiperAssetKind.Engine,
                EngineAssetKey,
                PiperAssetStage.CacheHit,
                cachedMessage,
                assetSizeBytes: cacheStatus.SizeBytes));

            return PiperAssetInstallResult.FromCache(cachedMessage, _cache.EngineDirectory, cacheStatus.SizeBytes);
        }

        string stagingDirectory = Path.Join(_cache.AssetRootDirectory, StagingDirectoryName);
        string archiveFilePath = Path.Join(stagingDirectory, EngineArchiveFileName);

        try
        {
            Directory.CreateDirectory(stagingDirectory);

            Report(progress, new PiperAssetProgress(
                PiperAssetKind.Engine,
                EngineAssetKey,
                PiperAssetStage.Downloading,
                "Downloading the Piper TTS engine..."));

            long archiveBytes = await DownloadEngineArchiveAsync(archiveFilePath, progress, cancellationToken);

            Report(progress, new PiperAssetProgress(
                PiperAssetKind.Engine,
                EngineAssetKey,
                PiperAssetStage.Extracting,
                $"Extracting the Piper TTS engine ({PiperSizeFormatter.Format(archiveBytes)} downloaded)...",
                assetSizeBytes: archiveBytes));

            string extractedEngineDirectory = ExtractEngineArchive(archiveFilePath);
            ReplaceDirectory(extractedEngineDirectory, _cache.EngineDirectory);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception exception) when (IsAssetPreparationFailure(exception))
        {
            string failureMessage = $"Piper TTS engine could not be prepared ({exception.Message}).";
            Report(progress, new PiperAssetProgress(
                PiperAssetKind.Engine,
                EngineAssetKey,
                PiperAssetStage.Failed,
                failureMessage));

            return PiperAssetInstallResult.Unavailable(failureMessage);
        }
        finally
        {
            TryDeleteDirectory(stagingDirectory);
        }

        if (!File.Exists(EngineExecutablePath))
        {
            string missingMessage = $"The Piper TTS engine download did not contain '{PiperDownloader.PiperExecutable}'.";
            Report(progress, new PiperAssetProgress(
                PiperAssetKind.Engine,
                EngineAssetKey,
                PiperAssetStage.Failed,
                missingMessage));

            return PiperAssetInstallResult.Unavailable(missingMessage);
        }

        long sizeBytes = PiperAssetCache.GetDirectorySizeBytes(_cache.EngineDirectory);
        _cache.RecordAssetInstall(PiperAssetKind.Engine, EngineAssetKey, _cache.EngineDirectory, sizeBytes);

        string installedMessage = $"Piper TTS engine is ready ({PiperSizeFormatter.Format(sizeBytes)} downloaded).";
        Report(progress, new PiperAssetProgress(
            PiperAssetKind.Engine,
            EngineAssetKey,
            PiperAssetStage.Installed,
            installedMessage,
            assetSizeBytes: sizeBytes));

        return PiperAssetInstallResult.Installed(installedMessage, _cache.EngineDirectory, sizeBytes);
    }

    /// <summary>
    ///     Makes sure a Piper voice model is on disk and loaded into a
    ///     <see cref="VoiceModel"/>, downloading only the files that are missing and only when the
    ///     cached copy is missing or older than the cache time-to-live.
    /// </summary>
    /// <param name="modelKey">The Piper model key, for example <c>"vi_VN-vivos-x_low"</c>.</param>
    /// <param name="progress">Receives one report per stage of the operation; may be null.</param>
    /// <param name="cancellationToken">Cancels the download.</param>
    /// <returns>
    ///     The outcome, including the loaded model and the size on disk. <see cref="IsAvailable"/> is
    ///     <c>false</c> when the model is unknown or could not be downloaded; the caller should then
    ///     keep going with the other models instead of failing.
    /// </returns>
    public async Task<PiperAssetInstallResult> EnsureVoiceModelAsync(
        string modelKey,
        IProgress<PiperAssetProgress>? progress = null,
        CancellationToken cancellationToken = default)
    {
        string modelDirectory = _cache.GetModelDirectory(modelKey);

        Report(progress, new PiperAssetProgress(
            PiperAssetKind.VoiceModel,
            modelKey,
            PiperAssetStage.Checking,
            $"Checking whether voice model '{modelKey}' is already cached..."));

        string[]? cachedFileNames = TryReadCachedFileNames(modelDirectory);
        if (cachedFileNames is not null)
        {
            PiperAssetCacheStatus cacheStatus = _cache.InspectAsset(
                PiperAssetKind.VoiceModel,
                modelKey,
                modelDirectory,
                cachedFileNames);

            if (cacheStatus.IsFresh)
            {
                VoiceModel cachedModel = await VoiceModel.LoadModel(modelDirectory);
                string cachedMessage = $"Voice model '{modelKey}' is cached ({PiperSizeFormatter.Format(cacheStatus.SizeBytes)}).";
                Report(progress, new PiperAssetProgress(
                    PiperAssetKind.VoiceModel,
                    modelKey,
                    PiperAssetStage.CacheHit,
                    cachedMessage,
                    assetSizeBytes: cacheStatus.SizeBytes));

                return PiperAssetInstallResult.FromCache(cachedMessage, modelDirectory, cacheStatus.SizeBytes, cachedModel);
            }
        }

        VoiceModel? model;
        try
        {
            model = await _voiceModelMetadataProvider(modelKey, cancellationToken);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception exception) when (IsAssetPreparationFailure(exception))
        {
            string lookupMessage = $"Voice model '{modelKey}' could not be looked up in the Piper voice list ({exception.Message}).";
            ReportFailure(progress, PiperAssetKind.VoiceModel, modelKey, lookupMessage);

            return PiperAssetInstallResult.Unavailable(lookupMessage);
        }

        if (model is null)
        {
            string notFoundMessage = $"Voice model '{modelKey}' was not found in the Piper voice list.";
            ReportFailure(progress, PiperAssetKind.VoiceModel, modelKey, notFoundMessage);

            return PiperAssetInstallResult.Unavailable(notFoundMessage);
        }

        try
        {
            await DownloadVoiceModelFilesAsync(model, modelDirectory, progress, cancellationToken);
            await WriteVoiceModelInfoAsync(model, modelDirectory, cancellationToken);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception exception) when (IsAssetPreparationFailure(exception))
        {
            string failureMessage = $"Voice model '{modelKey}' could not be downloaded ({exception.Message}).";
            ReportFailure(progress, PiperAssetKind.VoiceModel, modelKey, failureMessage);

            return PiperAssetInstallResult.Unavailable(failureMessage);
        }

        long sizeBytes = PiperAssetCache.GetDirectorySizeBytes(modelDirectory);
        _cache.RecordAssetInstall(PiperAssetKind.VoiceModel, modelKey, modelDirectory, sizeBytes);
        model.ModelLocation = modelDirectory;

        string installedMessage = $"Voice model '{modelKey}' is ready ({PiperSizeFormatter.Format(sizeBytes)} downloaded).";
        Report(progress, new PiperAssetProgress(
            PiperAssetKind.VoiceModel,
            modelKey,
            PiperAssetStage.Installed,
            installedMessage,
            assetSizeBytes: sizeBytes));

        return PiperAssetInstallResult.Installed(installedMessage, modelDirectory, sizeBytes, model);
    }

    private async Task<long> DownloadEngineArchiveAsync(
        string archiveFilePath,
        IProgress<PiperAssetProgress>? progress,
        CancellationToken cancellationToken)
    {
        // The engine archive is small compared to the voice models, so it is reported in megabytes
        // without a percentage: PiperSharp resolves the current release for this platform, which
        // means the response stream does not expose the archive length.
        var tracker = new AssetDownloadTracker(
            progress,
            PiperAssetKind.Engine,
            EngineAssetKey,
            "the Piper TTS engine",
            totalBytes: 0,
            initialReceivedBytes: 0);

        tracker.Report(force: true);

        using Stream archiveStream = await _engineArchiveProvider(cancellationToken);
        await CopyStreamToFileAsync(archiveStream, archiveFilePath, tracker, cancellationToken);

        tracker.Report(force: true);

        return tracker.BytesReceived;
    }

    private async Task DownloadVoiceModelFilesAsync(
        VoiceModel model,
        string modelDirectory,
        IProgress<PiperAssetProgress>? progress,
        CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(modelDirectory);

        var fileUrls = new List<string>(model.Files.Keys);

        long totalBytes = 0;
        long reusedBytes = 0;
        foreach (string fileUrl in fileUrls)
        {
            long expectedBytes = TryGetExpectedSizeBytes(model, fileUrl);
            totalBytes += expectedBytes;

            // A file that is already complete is reused, so an interrupted download resumes where it
            // stopped instead of starting over.
            string cachedFilePath = Path.Join(modelDirectory, Path.GetFileName(fileUrl));
            if (IsCompleteFileOnDisk(cachedFilePath, expectedBytes))
            {
                reusedBytes += new FileInfo(cachedFilePath).Length;
            }
        }

        var tracker = new AssetDownloadTracker(
            progress,
            PiperAssetKind.VoiceModel,
            model.Key,
            $"voice model '{model.Key}'",
            totalBytes,
            reusedBytes);

        tracker.Report(force: true);

        foreach (string fileUrl in fileUrls)
        {
            cancellationToken.ThrowIfCancellationRequested();

            string fileName = Path.GetFileName(fileUrl);
            string filePath = Path.Join(modelDirectory, fileName);
            if (IsCompleteFileOnDisk(filePath, TryGetExpectedSizeBytes(model, fileUrl)))
            {
                continue;
            }

            using HttpResponseMessage response = await _httpClient.GetAsync(
                BuildVoiceModelFileUrl(fileUrl),
                HttpCompletionOption.ResponseHeadersRead,
                cancellationToken);

            response.EnsureSuccessStatusCode();

            await using (Stream contentStream = await response.Content.ReadAsStreamAsync(cancellationToken))
            {
                await CopyStreamToFileAsync(contentStream, filePath, tracker, cancellationToken);
            }
        }

        // The WAV header of every synthesized utterance is built from the sample rate in the model
        // config file, so its audio configuration is copied onto the model (as PiperSharp does). This
        // also covers a config file that was reused from an earlier, interrupted download.
        await ApplyAudioConfigurationAsync(model, modelDirectory, cancellationToken);

        tracker.Report(force: true);
    }

    private static string BuildVoiceModelFileUrl(string fileUrl)
    {
        return VoiceModelFileUrlTemplate.Replace("{0}", fileUrl, StringComparison.Ordinal);
    }

    private static async Task CopyStreamToFileAsync(
        Stream source,
        string destinationPath,
        AssetDownloadTracker tracker,
        CancellationToken cancellationToken)
    {
        await using var destination = new FileStream(
            destinationPath,
            FileMode.Create,
            FileAccess.Write,
            FileShare.None,
            CopyBufferSize,
            useAsync: true);

        byte[] buffer = new byte[CopyBufferSize];
        int bytesRead;
        while ((bytesRead = await source.ReadAsync(buffer, cancellationToken)) > 0)
        {
            await destination.WriteAsync(buffer.AsMemory(0, bytesRead), cancellationToken);
            tracker.Add(bytesRead);
        }

        await destination.FlushAsync(cancellationToken);
    }

    private static bool IsCompleteFileOnDisk(string filePath, long expectedBytes)
    {
        if (!File.Exists(filePath))
        {
            return false;
        }

        // Without a known expected size a file that exists is trusted, matching the behaviour of a
        // cache hit: an asset is only downloaded again once it is missing or has expired.
        return expectedBytes <= 0 || new FileInfo(filePath).Length == expectedBytes;
    }

    private string ExtractEngineArchive(string archiveFilePath)
    {
        string extractDirectory = Path.Join(_cache.AssetRootDirectory, StagingDirectoryName, EngineExtractDirectoryName);

        TryDeleteDirectory(extractDirectory);
        Directory.CreateDirectory(extractDirectory);

        using FileStream archiveStream = File.OpenRead(archiveFilePath);
        PiperDownloader.ExtractPiper(archiveStream, extractDirectory);

        return FindExtractedEngineDirectory(extractDirectory);
    }

    /// <summary>
    ///     Locates the engine directory inside an extracted release archive. The release archives
    ///     bundle the engine in a <c>piper</c> folder, but how deep the extractor nests it depends on
    ///     the archive format, so the folder that actually holds the executable is used.
    /// </summary>
    /// <param name="extractDirectory">The directory the archive was extracted into.</param>
    /// <returns>
    ///     The directory that holds the Piper executable, or <paramref name="extractDirectory"/> when
    ///     no executable was extracted at all.
    /// </returns>
    private static string FindExtractedEngineDirectory(string extractDirectory)
    {
        string[] executablePaths = Directory.GetFiles(
            extractDirectory,
            PiperDownloader.PiperExecutable,
            SearchOption.AllDirectories);

        if (executablePaths.Length == 0)
        {
            return extractDirectory;
        }

        return Path.GetDirectoryName(executablePaths[0]) ?? extractDirectory;
    }

    private static void ReplaceDirectory(string sourceDirectory, string destinationDirectory)
    {
        TryDeleteDirectory(destinationDirectory);
        Directory.CreateDirectory(Path.GetDirectoryName(destinationDirectory) ?? destinationDirectory);
        Directory.Move(sourceDirectory, destinationDirectory);
    }

    private static void TryDeleteDirectory(string directory)
    {
        if (!Directory.Exists(directory))
        {
            return;
        }

        try
        {
            Directory.Delete(directory, recursive: true);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            // Leaving a stale directory behind must not fail an otherwise successful install: the
            // cache freshness check decides what happens on the next run.
        }
    }

    private static string[]? TryReadCachedFileNames(string modelDirectory)
    {
        string modelInfoPath = Path.Join(modelDirectory, VoiceModelInfoFileName);
        if (!File.Exists(modelInfoPath))
        {
            return null;
        }

        try
        {
            VoiceModel? model = JsonSerializer.Deserialize<VoiceModel>(File.ReadAllText(modelInfoPath));
            if (model is null || model.Files.Count == 0)
            {
                return null;
            }

            return BuildRequiredFileNames(model);
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

    private static string[] BuildRequiredFileNames(VoiceModel model)
    {
        var fileNames = new List<string> { VoiceModelInfoFileName };

        foreach (string fileUrl in model.Files.Keys)
        {
            string fileName = Path.GetFileName(fileUrl);
            if (!string.IsNullOrEmpty(fileName) && !fileNames.Contains(fileName, StringComparer.Ordinal))
            {
                fileNames.Add(fileName);
            }
        }

        return [.. fileNames];
    }

    private static long TryGetExpectedSizeBytes(VoiceModel model, string fileUrl)
    {
        if (!model.Files.TryGetValue(fileUrl, out object? fileInfo) || fileInfo is null)
        {
            return 0;
        }

        if (fileInfo is not JsonElement jsonElement)
        {
            return 0;
        }

        if (jsonElement.ValueKind == JsonValueKind.Number && jsonElement.TryGetInt64(out long directSizeBytes))
        {
            return directSizeBytes;
        }

        if (jsonElement.ValueKind == JsonValueKind.Object
            && jsonElement.TryGetProperty("size_bytes", out JsonElement sizeBytes)
            && sizeBytes.ValueKind == JsonValueKind.Number
            && sizeBytes.TryGetInt64(out long parsedSizeBytes))
        {
            return parsedSizeBytes;
        }

        return 0;
    }

    private static async Task WriteVoiceModelInfoAsync(
        VoiceModel model,
        string modelDirectory,
        CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(modelDirectory);

        string modelInfoPath = Path.Join(modelDirectory, VoiceModelInfoFileName);

        await using var stream = new FileStream(
            modelInfoPath,
            FileMode.Create,
            FileAccess.Write,
            FileShare.None,
            CopyBufferSize,
            useAsync: true);

        await JsonSerializer.SerializeAsync(stream, model, VoiceModelInfoSerializerOptions, cancellationToken);
    }

    /// <summary>
    ///     Copies the audio configuration (quality and sample rate) from the model's config file
    ///     (<c>*.onnx.json</c>) onto the model, mirroring what the PiperSharp downloader does. The WAV
    ///     header that PiperSharp builds for every synthesized utterance uses this sample rate, so a
    ///     model without it would be played at the wrong rate.
    /// </summary>
    /// <param name="model">The model the audio configuration is copied onto.</param>
    /// <param name="modelDirectory">The directory that holds the downloaded model files.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    private static async Task ApplyAudioConfigurationAsync(
        VoiceModel model,
        string modelDirectory,
        CancellationToken cancellationToken)
    {
        string? modelConfigFileName = model.Files.Keys
            .Select(Path.GetFileName)
            .FirstOrDefault(fileName => fileName is not null
                && fileName.EndsWith(ModelConfigFileSuffix, StringComparison.OrdinalIgnoreCase));

        if (modelConfigFileName is null)
        {
            return;
        }

        string modelConfigPath = Path.Join(modelDirectory, modelConfigFileName);
        if (!File.Exists(modelConfigPath))
        {
            return;
        }

        await using var stream = new FileStream(
            modelConfigPath,
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read,
            CopyBufferSize,
            useAsync: true);

        VoiceModel? modelConfig = await JsonSerializer.DeserializeAsync<VoiceModel>(stream, cancellationToken: cancellationToken);

        if (modelConfig?.Audio is not null)
        {
            model.Audio = modelConfig.Audio;
        }
    }

    private static bool IsAssetPreparationFailure(Exception exception)
    {
        return exception is HttpRequestException
            or IOException
            or UnauthorizedAccessException
            or JsonException
            or InvalidOperationException
            or NotSupportedException;
    }

    private static void Report(IProgress<PiperAssetProgress>? progress, PiperAssetProgress report)
    {
        progress?.Report(report);
    }

    private static void ReportFailure(IProgress<PiperAssetProgress>? progress, PiperAssetKind kind, string assetKey, string message)
    {
        Report(progress, new PiperAssetProgress(kind, assetKey, PiperAssetStage.Failed, message));
    }

    /// <summary>
    ///     Accumulates download byte counts for one asset and throttles the reports, so a large file
    ///     does not flood the progress display while the final megabytes are still reported exactly.
    /// </summary>
    private sealed class AssetDownloadTracker
    {
        private readonly IProgress<PiperAssetProgress>? _progress;
        private readonly PiperAssetKind _kind;
        private readonly string _assetKey;
        private readonly string _assetLabel;
        private readonly long _totalBytes;
        private DateTimeOffset _lastReportUtc = DateTimeOffset.MinValue;

        public AssetDownloadTracker(
            IProgress<PiperAssetProgress>? progress,
            PiperAssetKind kind,
            string assetKey,
            string assetLabel,
            long totalBytes,
            long initialReceivedBytes)
        {
            _progress = progress;
            _kind = kind;
            _assetKey = assetKey;
            _assetLabel = assetLabel;
            _totalBytes = totalBytes;
            BytesReceived = initialReceivedBytes;
        }

        /// <summary>
        ///     The number of bytes accounted for so far: reused files plus bytes downloaded this run.
        /// </summary>
        public long BytesReceived { get; private set; }

        /// <summary>
        ///     Adds freshly downloaded bytes and reports the new total once the interval has passed.
        /// </summary>
        /// <param name="bytes">The number of bytes just downloaded.</param>
        public void Add(long bytes)
        {
            BytesReceived += bytes;
            Report(force: false);
        }

        /// <summary>
        ///     Reports the current byte count.
        /// </summary>
        /// <param name="force">When true, the throttle interval is ignored.</param>
        public void Report(bool force)
        {
            DateTimeOffset utcNow = DateTimeOffset.UtcNow;
            if (!force && utcNow - _lastReportUtc < ProgressReportInterval)
            {
                return;
            }

            _lastReportUtc = utcNow;

            PiperAssetInstaller.Report(_progress, new PiperAssetProgress(
                _kind,
                _assetKey,
                PiperAssetStage.Downloading,
                $"Downloading {_assetLabel}... {PiperSizeFormatter.FormatProgress(BytesReceived, _totalBytes)}",
                BytesReceived,
                _totalBytes));
        }
    }
}
