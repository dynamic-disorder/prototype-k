using System.Globalization;
using System.IO.Compression;
using System.Net;
using System.Text;
using System.Text.Json;

using PiperSharp;
using PiperSharp.Models;

using Shouldly;

namespace TextToSpeechCore.Tests;

/// <summary>
///     Tests for <see cref="PiperAssetInstaller" />: a fresh asset on disk is reused, a missing asset
///     is downloaded (and the engine archive extracted), progress is reported with sizes in
///     megabytes, and the install is recorded in the cache manifest. The PiperSharp downloaders and
///     the network are replaced by stubs, so these tests never touch the internet.
/// </summary>
public sealed class PiperAssetInstallerTests
{
    private const string ModelKey = "vi_VN-vivos-x_low";
    private const int Megabyte = 1024 * 1024;

    // ------------------------------------------------------------------------------------ engine

    [Fact]
    public async Task EnsureEngineAsync_FreshEngineOnDisk_ReportsCacheHitWithoutDownloading()
    {
        // Given: an engine that was already extracted on disk
        using var temp = new TemporaryDirectory();
        temp.CreateFile(Path.Join(PiperAssetCache.EngineDirectoryName, PiperDownloader.PiperExecutable), 4096);
        StubHttpMessageHandler handler = CreateUnusedHandler();
        PiperAssetInstaller installer = CreateInstaller(temp, handler);
        var progress = new RecordingProgress();

        // When: ensuring the engine
        PiperAssetInstallResult result = await installer.EnsureEngineAsync(progress);

        // Then: nothing was fetched and the cached engine is reported with its size
        result.IsAvailable.ShouldBeTrue();
        result.WasCached.ShouldBeTrue();
        result.SizeBytes.ShouldBe(4096);
        result.DirectoryPath.ShouldBe(installer.Cache.EngineDirectory);
        result.Message.ShouldContain("cached");
        File.Exists(installer.EngineExecutablePath).ShouldBeTrue();
        File.Exists(PiperAssetCache.GetManifestPath(installer.Cache.EngineDirectory)).ShouldBeFalse();
        handler.RequestedUrls.ShouldBeEmpty();
        progress.Reports.ShouldContain(r => r.Stage == PiperAssetStage.CacheHit && r.Kind == PiperAssetKind.Engine);
        progress.Reports.ShouldNotContain(r => r.Stage == PiperAssetStage.Downloading);
    }

    [Fact]
    public async Task EnsureEngineAsync_MissingEngine_DownloadsExtractsAndRecordsTheInstall()
    {
        // Given: no engine on disk and an injected release archive
        using var temp = new TemporaryDirectory();
        byte[] archive = CreateEngineArchive();
        PiperAssetInstaller installer = CreateInstaller(
            temp,
            CreateUnusedHandler(),
            engineArchive: _ => Task.FromResult<Stream>(new MemoryStream(archive, writable: false)));
        var progress = new RecordingProgress();

        // When: ensuring the engine
        PiperAssetInstallResult result = await installer.EnsureEngineAsync(progress);

        // Then: the executable and its data end up in the cache engine directory
        result.IsAvailable.ShouldBeTrue();
        result.WasCached.ShouldBeFalse();
        result.DirectoryPath.ShouldBe(installer.Cache.EngineDirectory);
        File.Exists(installer.EngineExecutablePath).ShouldBeTrue();
        File.Exists(Path.Join(installer.Cache.EngineDirectory, "espeak-ng-data", "en_dict")).ShouldBeTrue();
        result.SizeBytes.ShouldBe(1024 + 2048);

        // Then: the install is recorded so the next run reuses it
        File.Exists(PiperAssetCache.GetManifestPath(installer.Cache.EngineDirectory)).ShouldBeTrue();
        installer.Cache
            .InspectAsset(PiperAssetKind.Engine, PiperAssetInstaller.EngineAssetKey, installer.Cache.EngineDirectory, [PiperDownloader.PiperExecutable])
            .IsFresh.ShouldBeTrue();

        // Then: the staging directory used while downloading and extracting is gone
        Directory.Exists(Path.Join(temp.Path, ".piper-install-staging")).ShouldBeFalse();

        // Then: the download, extraction and install were reported, with the page size in megabytes
        progress.Reports.ShouldContain(r => r.Stage == PiperAssetStage.Extracting);
        progress.Reports.ShouldContain(r => r.Stage == PiperAssetStage.Installed && r.AssetSizeBytes == 1024 + 2048);
        PiperAssetProgress downloadReport = progress.Reports.Last(r => r.Stage == PiperAssetStage.Downloading);
        downloadReport.BytesReceived.ShouldBe(archive.Length);
        downloadReport.Message.ShouldContain(PiperSizeFormatter.Format(archive.Length));
    }

    [Fact]
    public async Task EnsureEngineAsync_ArchiveWithoutTheExecutable_ReportsFailure()
    {
        // Given: an archive that does not contain the Piper executable
        using var temp = new TemporaryDirectory();
        byte[] archive = CreateEngineArchive(includeExecutable: false);
        PiperAssetInstaller installer = CreateInstaller(
            temp,
            CreateUnusedHandler(),
            engineArchive: _ => Task.FromResult<Stream>(new MemoryStream(archive, writable: false)));
        var progress = new RecordingProgress();

        // When: ensuring the engine
        PiperAssetInstallResult result = await installer.EnsureEngineAsync(progress);

        // Then: the failure is reported instead of leaving a half-installed engine behind
        result.IsAvailable.ShouldBeFalse();
        result.Message.ShouldContain("did not contain");
        progress.Reports.ShouldContain(r => r.IsFailed && r.Kind == PiperAssetKind.Engine);
    }

    // ------------------------------------------------------------------------------ voice models

    [Fact]
    public async Task EnsureVoiceModelAsync_CachedAndFresh_ReusesTheModelWithoutNetworkOrVoiceList()
    {
        // Given: a complete model on disk, written just now
        using var temp = new TemporaryDirectory();
        VoiceModel metadata = CreateModelMetadata(ModelKey, ("model.onnx", 30000), ("model.onnx.json", 400), ("MODEL_CARD", 100));
        WriteCachedModel(temp, metadata, ("model.onnx", 30000), ("model.onnx.json", 400), ("MODEL_CARD", 100));

        bool voiceListWasRead = false;
        PiperAssetInstaller installer = CreateInstaller(
            temp,
            CreateUnusedHandler(),
            metadataProvider: (_, _) =>
            {
                voiceListWasRead = true;
                return Task.FromResult<VoiceModel?>(metadata);
            });
        var progress = new RecordingProgress();

        // When: ensuring the model
        PiperAssetInstallResult result = await installer.EnsureVoiceModelAsync(ModelKey, progress);

        // Then: the cached model is loaded, without touching the network or the voice list
        string cachedModelDirectory = installer.Cache.GetModelDirectory(ModelKey);
        long modelInfoBytes = new FileInfo(Path.Join(cachedModelDirectory, PiperAssetInstaller.VoiceModelInfoFileName)).Length;

        result.IsAvailable.ShouldBeTrue();
        result.WasCached.ShouldBeTrue();
        result.Model.ShouldNotBeNull();
        result.Model!.ModelLocation.ShouldBe(cachedModelDirectory);
        result.SizeBytes.ShouldBe(30500 + modelInfoBytes);
        result.Message.ShouldContain("cached");
        voiceListWasRead.ShouldBeFalse();
        progress.Reports.ShouldContain(r => r.Stage == PiperAssetStage.CacheHit && r.Kind == PiperAssetKind.VoiceModel);
        progress.Reports.ShouldNotContain(r => r.Stage == PiperAssetStage.Downloading);
    }

    [Fact]
    public async Task EnsureVoiceModelAsync_UncachedModel_DownloadsEveryFileAndRecordsTheInstall()
    {
        // Given: a model that is not on disk yet
        using var temp = new TemporaryDirectory();
        VoiceModel metadata = CreateModelMetadata(
            ModelKey,
            ("model.onnx", 3 * Megabyte),
            ("model.onnx.json", 4096),
            ("MODEL_CARD", 272));

        const int expectedTotalBytes = (3 * Megabyte) + 4096 + 272;
        StubHttpMessageHandler handler = CreateFileServer(metadata);
        PiperAssetInstaller installer = CreateInstaller(temp, handler, metadataProvider: (_, _) => Task.FromResult<VoiceModel?>(metadata));
        var progress = new RecordingProgress();

        // When: ensuring the model
        PiperAssetInstallResult result = await installer.EnsureVoiceModelAsync(ModelKey, progress);

        // Then: every file is downloaded and the metadata is written next to it
        string modelDirectory = installer.Cache.GetModelDirectory(ModelKey);
        result.IsAvailable.ShouldBeTrue();
        result.WasCached.ShouldBeFalse();
        result.Model.ShouldNotBeNull();
        result.Model!.ModelLocation.ShouldBe(modelDirectory);
        new FileInfo(Path.Join(modelDirectory, "model.onnx")).Length.ShouldBe(3 * Megabyte);
        new FileInfo(Path.Join(modelDirectory, "MODEL_CARD")).Length.ShouldBe(272);
        File.Exists(Path.Join(modelDirectory, PiperAssetInstaller.VoiceModelInfoFileName)).ShouldBeTrue();

        // Then: the audio configuration from the model's config file is kept, because the WAV header
        // of every synthesized utterance is built from its sample rate
        result.Model!.Audio.ShouldNotBeNull();
        result.Model.Audio!.SampleRate.ShouldBe(16000u);

        string writtenModelInfo = File.ReadAllText(Path.Join(modelDirectory, PiperAssetInstaller.VoiceModelInfoFileName));
        writtenModelInfo.ShouldContain("\"audio\"");
        writtenModelInfo.ShouldContain("16000");
        writtenModelInfo.ShouldContain("\n");

        handler.RequestedUrls.Count.ShouldBe(3);
        handler.RequestedUrls.ShouldAllBe(url => url.StartsWith("https://huggingface.co/rhasspy/piper-voices/resolve/main/", StringComparison.Ordinal));
        handler.RequestedUrls.ShouldAllBe(url => url.EndsWith("?download=true", StringComparison.Ordinal));

        // Then: the install is recorded and the next run counts as fresh
        File.Exists(PiperAssetCache.GetManifestPath(modelDirectory)).ShouldBeTrue();
        installer.Cache
            .InspectAsset(PiperAssetKind.VoiceModel, ModelKey, modelDirectory, ["model.onnx", "model.onnx.json", "MODEL_CARD", PiperAssetInstaller.VoiceModelInfoFileName])
            .IsFresh.ShouldBeTrue();

        // Then: the progress reports the megabytes transferred and the size on disk
        PiperAssetProgress downloadReport = progress.Reports.Last(r => r.Stage == PiperAssetStage.Downloading);
        downloadReport.AssetKey.ShouldBe(ModelKey);
        downloadReport.TotalBytes.ShouldBe(expectedTotalBytes);
        downloadReport.BytesReceived.ShouldBe(expectedTotalBytes);
        downloadReport.PercentComplete.ShouldBe(100);
        downloadReport.Message.ShouldContain("3.0 / 3.0 MB (100%)");

        PiperAssetProgress installedReport = progress.Reports.Last();
        installedReport.Stage.ShouldBe(PiperAssetStage.Installed);
        installedReport.AssetMegabytes.ShouldBeGreaterThan(3.0);
    }

    [Fact]
    public async Task EnsureVoiceModelAsync_PartiallyDownloadedModel_ReusesTheCompleteFiles()
    {
        // Given: an interrupted download whose metadata is present but whose model file is not
        using var temp = new TemporaryDirectory();
        VoiceModel metadata = CreateModelMetadata(ModelKey, ("model.onnx", 30000), ("model.onnx.json", 4096), ("MODEL_CARD", 272));
        WriteCachedModel(temp, metadata, ("model.onnx.json", 4096));

        StubHttpMessageHandler handler = CreateFileServer(metadata);
        PiperAssetInstaller installer = CreateInstaller(temp, handler, metadataProvider: (_, _) => Task.FromResult<VoiceModel?>(metadata));
        var progress = new RecordingProgress();

        // When: ensuring the model
        PiperAssetInstallResult result = await installer.EnsureVoiceModelAsync(ModelKey, progress);

        // Then: only the two missing files are downloaded
        result.IsAvailable.ShouldBeTrue();
        result.WasCached.ShouldBeFalse();
        handler.RequestedUrls.Count.ShouldBe(2);
        handler.RequestedUrls.ShouldNotContain(url => url.EndsWith("/model.onnx.json?download=true", StringComparison.Ordinal));

        // Then: progress starts from the bytes that were already on disk
        progress.Reports.First(r => r.Stage == PiperAssetStage.Downloading).BytesReceived.ShouldBe(4096);
        progress.Reports.Last(r => r.Stage == PiperAssetStage.Downloading).BytesReceived.ShouldBe(30000 + 4096 + 272);

        // Then: the audio configuration is read from the reused config file as well
        result.Model!.Audio.ShouldNotBeNull();
        result.Model.Audio!.SampleRate.ShouldBe(16000u);
    }

    // ------------------------------------------------------------------------------------ failures

    [Fact]
    public async Task EnsureVoiceModelAsync_ModelNotInTheVoiceList_ReportsFailure()
    {
        using var temp = new TemporaryDirectory();
        PiperAssetInstaller installer = CreateInstaller(
            temp,
            CreateUnusedHandler(),
            metadataProvider: (_, _) => Task.FromResult<VoiceModel?>(null));
        var progress = new RecordingProgress();

        PiperAssetInstallResult result = await installer.EnsureVoiceModelAsync("xx_XX-missing-low", progress);

        result.IsAvailable.ShouldBeFalse();
        result.WasCached.ShouldBeFalse();
        result.Model.ShouldBeNull();
        result.Message.ShouldContain("was not found");
        progress.Reports.ShouldContain(r => r.IsFailed && r.AssetKey == "xx_XX-missing-low" && r.Kind == PiperAssetKind.VoiceModel);
    }

    [Fact]
    public async Task EnsureVoiceModelAsync_VoiceListUnavailable_ReportsFailure()
    {
        // Given: the voice list cannot be fetched (the machine is offline)
        using var temp = new TemporaryDirectory();
        PiperAssetInstaller installer = CreateInstaller(
            temp,
            CreateUnusedHandler(),
            metadataProvider: (_, _) => throw new HttpRequestException("no internet"));
        var progress = new RecordingProgress();

        // When: ensuring a model that is not on disk
        PiperAssetInstallResult result = await installer.EnsureVoiceModelAsync(ModelKey, progress);

        // Then: the failure is reported and the other languages can still initialize
        result.IsAvailable.ShouldBeFalse();
        result.Message.ShouldContain("could not be looked up");
        progress.Reports.ShouldContain(r => r.IsFailed);
    }

    [Fact]
    public async Task EnsureVoiceModelAsync_DownloadFails_ReportsFailureWithoutRecordingAnInstall()
    {
        using var temp = new TemporaryDirectory();
        VoiceModel metadata = CreateModelMetadata(ModelKey, ("model.onnx", 30000));
        var handler = new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.NotFound));
        PiperAssetInstaller installer = CreateInstaller(temp, handler, metadataProvider: (_, _) => Task.FromResult<VoiceModel?>(metadata));
        var progress = new RecordingProgress();

        PiperAssetInstallResult result = await installer.EnsureVoiceModelAsync(ModelKey, progress);

        result.IsAvailable.ShouldBeFalse();
        result.Model.ShouldBeNull();
        result.Message.ShouldContain("could not be downloaded");
        File.Exists(PiperAssetCache.GetManifestPath(installer.Cache.GetModelDirectory(ModelKey))).ShouldBeFalse();
        progress.Reports.ShouldContain(r => r.IsFailed);
    }

    // ------------------------------------------------------------------------------------ helpers

    private static PiperAssetInstaller CreateInstaller(
        TemporaryDirectory temp,
        HttpMessageHandler handler,
        Func<string, CancellationToken, Task<VoiceModel?>>? metadataProvider = null,
        Func<CancellationToken, Task<Stream>>? engineArchive = null)
    {
        var cache = new PiperAssetCache(temp.Path, TimeSpan.FromDays(14), () => DateTimeOffset.UtcNow);

        return new PiperAssetInstaller(
            cache,
            new HttpClient(handler),
            metadataProvider ?? ((_, _) => Task.FromResult<VoiceModel?>(null)),
            engineArchive ?? (_ => throw new InvalidOperationException("this test must not download the Piper engine")));
    }

    private static StubHttpMessageHandler CreateUnusedHandler()
    {
        return new StubHttpMessageHandler(_ => throw new InvalidOperationException("this test must not use the network"));
    }

    private static StubHttpMessageHandler CreateFileServer(VoiceModel metadata)
    {
        return new StubHttpMessageHandler(request =>
        {
            string requestPath = request.RequestUri?.AbsolutePath ?? string.Empty;

            foreach (string fileUrl in metadata.Files.Keys)
            {
                string fileName = Path.GetFileName(fileUrl);
                if (requestPath.EndsWith(fileName, StringComparison.Ordinal))
                {
                    return new HttpResponseMessage(HttpStatusCode.OK)
                    {
                        Content = new ByteArrayContent(CreateFileContent(fileName, GetExpectedSizeBytes(metadata, fileUrl)))
                    };
                }
            }

            return new HttpResponseMessage(HttpStatusCode.NotFound);
        });
    }

    /// <summary>
    ///     Builds the body of a stubbed model file of the declared size. A <c>.onnx.json</c> file has
    ///     to be valid JSON because its audio configuration (the sample rate used for the WAV header)
    ///     is read from it, so it is padded with whitespace instead of filled with placeholders.
    /// </summary>
    private static byte[] CreateFileContent(string fileName, int sizeBytes)
    {
        const string ModelConfigJson = "{\"audio\": {\"quality\": \"x_low\", \"sample_rate\": 16000}}";

        string content = fileName.EndsWith(".onnx.json", StringComparison.OrdinalIgnoreCase)
            ? ModelConfigJson.PadRight(Math.Max(sizeBytes, ModelConfigJson.Length))
            : new string('x', sizeBytes);

        return Encoding.UTF8.GetBytes(content);
    }

    private static int GetExpectedSizeBytes(VoiceModel model, string fileUrl)
    {
        if (model.Files[fileUrl] is not JsonElement fileInfo
            || !fileInfo.TryGetProperty("size_bytes", out JsonElement sizeBytes))
        {
            return 0;
        }

        return (int)sizeBytes.GetInt64();
    }

    private static VoiceModel CreateModelMetadata(string modelKey, params (string FileName, long SizeBytes)[] files)
    {
        var fileEntries = new Dictionary<string, object>();

        foreach ((string fileName, long sizeBytes) in files)
        {
            string fileJson = $"{{\"size_bytes\": {sizeBytes.ToString(CultureInfo.InvariantCulture)}, \"md5_digest\": \"stub\"}}";
            fileEntries[$"en/en_GB/{modelKey}/{fileName}"] = JsonSerializer.Deserialize<JsonElement>(fileJson);
        }

        return new VoiceModel
        {
            Key = modelKey,
            Name = modelKey,
            NumSpeakers = 1,
            Files = fileEntries
        };
    }

    private static void WriteCachedModel(TemporaryDirectory temp, VoiceModel model, params (string FileName, long SizeBytes)[] files)
    {
        foreach ((string fileName, long sizeBytes) in files)
        {
            string relativePath = Path.Join(PiperAssetCache.ModelsDirectoryName, model.Key, fileName);
            temp.WriteFile(relativePath, CreateFileContent(fileName, (int)sizeBytes));
        }

        // The metadata is written exactly as the installer writes it, so the cache can inspect it.
        string modelDirectory = Path.Join(temp.Path, PiperAssetCache.ModelsDirectoryName, model.Key);
        File.WriteAllText(Path.Join(modelDirectory, PiperAssetInstaller.VoiceModelInfoFileName), JsonSerializer.Serialize(model));
    }

    private static byte[] CreateEngineArchive(bool includeExecutable = true)
    {
        using var stream = new MemoryStream();

        using (var archive = new ZipArchive(stream, ZipArchiveMode.Create, leaveOpen: true))
        {
            if (includeExecutable)
            {
                AddArchiveEntry(archive, $"{PiperAssetCache.EngineDirectoryName}/{PiperDownloader.PiperExecutable}", 1024);
            }

            AddArchiveEntry(archive, $"{PiperAssetCache.EngineDirectoryName}/espeak-ng-data/en_dict", 2048);
        }

        return stream.ToArray();
    }

    private static void AddArchiveEntry(ZipArchive archive, string entryName, int sizeBytes)
    {
        ZipArchiveEntry entry = archive.CreateEntry(entryName);

        using Stream entryStream = entry.Open();
        entryStream.Write(new byte[sizeBytes]);
    }

    /// <summary>
    ///     An <see cref="HttpMessageHandler" /> returning canned responses and recording which URLs
    ///     were requested, so the tests can assert what was (not) downloaded.
    /// </summary>
    private sealed class StubHttpMessageHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _responseFactory;

        public StubHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> responseFactory)
        {
            _responseFactory = responseFactory;
        }

        public List<string> RequestedUrls { get; } = [];

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            RequestedUrls.Add(request.RequestUri?.ToString() ?? string.Empty);

            return Task.FromResult(_responseFactory(request));
        }
    }

    /// <summary>
    ///     An <see cref="IProgress{T}" /> that records every report synchronously, so assertions do
    ///     not race with a thread pool dispatcher.
    /// </summary>
    private sealed class RecordingProgress : IProgress<PiperAssetProgress>
    {
        public List<PiperAssetProgress> Reports { get; } = [];

        public void Report(PiperAssetProgress value)
        {
            Reports.Add(value);
        }
    }
}
