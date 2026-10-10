using PiperSharp;

using Shouldly;

namespace TextToSpeechCore.Tests;

/// <summary>
///     Tests for <see cref="PiperAssetCache" />: which files count as a usable asset, how old an
///     asset may be before it is downloaded and extracted again, and what the inspection reports.
/// </summary>
public sealed class PiperAssetCacheTests
{
    private static readonly DateTimeOffset UtcNow = new(2026, 1, 15, 12, 0, 0, TimeSpan.Zero);

    private const string EngineFileName = "piper";

    // ------------------------------------------------------------------------------- paths / ttl

    [Fact]
    public void Constructor_WithoutRoot_UsesPiperSharpsDefaultLocation()
    {
        // Given/When: a cache without an explicit root
        var cache = new PiperAssetCache(utcNowProvider: () => UtcNow);

        // Then: the engine and models directories match PiperSharp's own defaults
        cache.AssetRootDirectory.ShouldBe(Path.GetFullPath(PiperDownloader.DefaultLocation));
        cache.EngineDirectory.ShouldBe(Path.GetFullPath(PiperDownloader.DefaultPiperLocation));
        cache.ModelsDirectory.ShouldBe(Path.GetFullPath(PiperDownloader.DefaultModelLocation));
    }

    [Fact]
    public void Constructor_WithRoot_PlacesEngineAndModelsBelowIt()
    {
        using var temp = new TemporaryDirectory();

        var cache = new PiperAssetCache(temp.Path, utcNowProvider: () => UtcNow);

        cache.AssetRootDirectory.ShouldBe(Path.GetFullPath(temp.Path));
        cache.EngineDirectory.ShouldBe(Path.Join(Path.GetFullPath(temp.Path), PiperAssetCache.EngineDirectoryName));
        cache.ModelsDirectory.ShouldBe(Path.Join(Path.GetFullPath(temp.Path), PiperAssetCache.ModelsDirectoryName));
        cache.GetModelDirectory("vi_VN-vivos-x_low")
            .ShouldBe(Path.Join(Path.GetFullPath(temp.Path), PiperAssetCache.ModelsDirectoryName, "vi_VN-vivos-x_low"));
    }

    [Fact]
    public void CacheTtl_DefaultsToTwoWeeks()
    {
        var cache = new PiperAssetCache(utcNowProvider: () => UtcNow);

        cache.CacheTtl.ShouldBe(TimeSpan.FromDays(14));
        PiperAssetCache.DefaultCacheTtl.ShouldBe(TimeSpan.FromDays(14));
    }

    // ---------------------------------------------------------------------------------- freshness

    [Fact]
    public void InspectAsset_NothingOnDisk_IsNotFreshAndListsEveryMissingFile()
    {
        using var temp = new TemporaryDirectory();
        PiperAssetCache cache = CreateCache(temp);

        PiperAssetCacheStatus status = cache.InspectAsset(
            PiperAssetKind.Engine,
            PiperAssetInstaller.EngineAssetKey,
            cache.EngineDirectory,
            [EngineFileName, "espeak-ng-data"]);

        status.IsFresh.ShouldBeFalse();
        status.MissingRelativePaths.ShouldBe([EngineFileName, "espeak-ng-data"]);
        status.SizeBytes.ShouldBe(0);
        status.InstalledUtc.ShouldBeNull();
        status.Age.ShouldBeNull();
        status.Reason.ShouldContain("missing 2 file(s)");
    }

    [Fact]
    public void InspectAsset_AllFilesPresentWithoutManifest_UsesTheNewestFileTimestamp()
    {
        // Given: a downloaded engine without a cache manifest (as older versions left it)
        using var temp = new TemporaryDirectory();
        temp.CreateFile(Path.Join(PiperAssetCache.EngineDirectoryName, EngineFileName), 1024);
        temp.CreateFile(Path.Join(PiperAssetCache.EngineDirectoryName, "espeak-ng-data", "en_dict"), 2048);
        PiperAssetCache cache = CreateCache(temp, DateTimeOffset.UtcNow);

        // When: inspecting the engine directory
        PiperAssetCacheStatus status = cache.InspectAsset(
            PiperAssetKind.Engine,
            PiperAssetInstaller.EngineAssetKey,
            cache.EngineDirectory,
            [EngineFileName, Path.Join("espeak-ng-data", "en_dict")]);

        // Then: the files are reused and their size is reported
        status.IsFresh.ShouldBeTrue();
        status.MissingRelativePaths.ShouldBeEmpty();
        status.SizeBytes.ShouldBe(3072);
        status.InstalledUtc.ShouldNotBeNull();
        status.Reason.ShouldContain("within");
    }

    [Fact]
    public void InspectAsset_FilesOlderThanTheTtl_IsNotFresh()
    {
        using var temp = new TemporaryDirectory();
        string engineFilePath = temp.CreateFile(Path.Join(PiperAssetCache.EngineDirectoryName, EngineFileName), 10);
        File.SetLastWriteTimeUtc(engineFilePath, UtcNow.AddDays(-15).UtcDateTime);
        PiperAssetCache cache = CreateCache(temp);

        PiperAssetCacheStatus status = cache.InspectAsset(
            PiperAssetKind.Engine,
            PiperAssetInstaller.EngineAssetKey,
            cache.EngineDirectory,
            [EngineFileName]);

        status.IsFresh.ShouldBeFalse();
        status.MissingRelativePaths.ShouldBeEmpty();
        status.Age!.Value.TotalDays.ShouldBeGreaterThan(14);
        status.Reason.ShouldContain("exceeds");
    }

    [Fact]
    public void InspectAsset_ManifestPresentButARequiredFileIsMissing_IsNotFresh()
    {
        using var temp = new TemporaryDirectory();
        temp.CreateFile(Path.Join(PiperAssetCache.EngineDirectoryName, EngineFileName), 10);
        PiperAssetCache cache = CreateCache(temp);
        cache.RecordAssetInstall(PiperAssetKind.Engine, PiperAssetInstaller.EngineAssetKey, cache.EngineDirectory, 10);

        PiperAssetCacheStatus status = cache.InspectAsset(
            PiperAssetKind.Engine,
            PiperAssetInstaller.EngineAssetKey,
            cache.EngineDirectory,
            [EngineFileName, "espeak-ng-data"]);

        status.IsFresh.ShouldBeFalse();
        status.MissingRelativePaths.ShouldBe(["espeak-ng-data"]);
        status.Reason.ShouldContain("missing 1 file(s)");
    }

    [Fact]
    public void InspectAsset_CorruptManifest_FallsBackToTheFileTimestamps()
    {
        using var temp = new TemporaryDirectory();
        temp.CreateFile(Path.Join(PiperAssetCache.EngineDirectoryName, EngineFileName), 10);
        PiperAssetCache cache = CreateCache(temp, DateTimeOffset.UtcNow);
        File.WriteAllText(PiperAssetCache.GetManifestPath(cache.EngineDirectory), "{ this is not json");

        PiperAssetCacheStatus status = cache.InspectAsset(
            PiperAssetKind.Engine,
            PiperAssetInstaller.EngineAssetKey,
            cache.EngineDirectory,
            [EngineFileName]);

        status.IsFresh.ShouldBeTrue();
        status.SizeBytes.ShouldBe(10);
    }

    // ---------------------------------------------------------------------------------- manifests

    [Fact]
    public void RecordAssetInstall_WritesAManifestThatKeepsTheAssetFresh()
    {
        using var temp = new TemporaryDirectory();
        temp.CreateFile(Path.Join(PiperAssetCache.ModelsDirectoryName, "vi_VN-vivos-x_low", "vi_VN-vivos-x_low.onnx"), 4096);
        PiperAssetCache cache = CreateCache(temp);

        string modelDirectory = cache.GetModelDirectory("vi_VN-vivos-x_low");
        cache.RecordAssetInstall(PiperAssetKind.VoiceModel, "vi_VN-vivos-x_low", modelDirectory, 4096);

        // Then: the manifest exists and the next inspection reuses the asset
        File.Exists(PiperAssetCache.GetManifestPath(modelDirectory)).ShouldBeTrue();

        PiperAssetCacheStatus status = cache.InspectAsset(
            PiperAssetKind.VoiceModel,
            "vi_VN-vivos-x_low",
            modelDirectory,
            ["vi_VN-vivos-x_low.onnx"]);

        status.IsFresh.ShouldBeTrue();
        status.SizeBytes.ShouldBe(4096);
    }

    [Fact]
    public void InspectAsset_ManifestOlderThanTheTtl_IsNotFreshEvenWhenTheFilesAreNewer()
    {
        // Given: an asset installed 20 days ago and files that were written just now
        using var temp = new TemporaryDirectory();
        DateTimeOffset clock = UtcNow.AddDays(-20);
        var cache = new PiperAssetCache(temp.Path, TimeSpan.FromDays(14), () => clock);
        temp.CreateFile(Path.Join(PiperAssetCache.EngineDirectoryName, EngineFileName), 10);
        cache.RecordAssetInstall(PiperAssetKind.Engine, PiperAssetInstaller.EngineAssetKey, cache.EngineDirectory, 10);

        // When: inspecting right after the install
        PiperAssetCacheStatus freshStatus = cache.InspectAsset(
            PiperAssetKind.Engine,
            PiperAssetInstaller.EngineAssetKey,
            cache.EngineDirectory,
            [EngineFileName]);

        // Then: the recorded install time wins over the (newer) file timestamps
        freshStatus.IsFresh.ShouldBeTrue();

        // When: 20 days pass, past the 14 day time-to-live
        clock = clock.AddDays(20);
        PiperAssetCacheStatus staleStatus = cache.InspectAsset(
            PiperAssetKind.Engine,
            PiperAssetInstaller.EngineAssetKey,
            cache.EngineDirectory,
            [EngineFileName]);

        // Then: the asset is downloaded and extracted again
        staleStatus.IsFresh.ShouldBeFalse();
        staleStatus.Age!.Value.TotalDays.ShouldBe(20, 0.1);
        staleStatus.Reason.ShouldContain("exceeds");
    }

    [Fact]
    public void InspectAsset_WithoutExpiry_KeepsTheAssetFreshForever()
    {
        using var temp = new TemporaryDirectory();
        DateTimeOffset clock = UtcNow.AddYears(-5);
        var cache = new PiperAssetCache(temp.Path, TimeSpan.MaxValue, () => clock);
        temp.CreateFile(Path.Join(PiperAssetCache.EngineDirectoryName, EngineFileName), 10);
        cache.RecordAssetInstall(PiperAssetKind.Engine, PiperAssetInstaller.EngineAssetKey, cache.EngineDirectory, 10);

        clock = clock.AddYears(5);
        PiperAssetCacheStatus status = cache.InspectAsset(
            PiperAssetKind.Engine,
            PiperAssetInstaller.EngineAssetKey,
            cache.EngineDirectory,
            [EngineFileName]);

        status.IsFresh.ShouldBeTrue();
        status.Reason.ShouldContain("unlimited time-to-live");
    }

    // ------------------------------------------------------------------------------------- sizing

    [Fact]
    public void GetDirectorySizeBytes_SumsNestedFilesAndIgnoresManifests()
    {
        using var temp = new TemporaryDirectory();
        string modelDirectoryName = Path.Join(PiperAssetCache.ModelsDirectoryName, "en_GB-northern_english_male-medium");
        temp.CreateFile(Path.Join(modelDirectoryName, "model.onnx"), 100);
        temp.CreateFile(Path.Join(modelDirectoryName, "nested", "tokens.txt"), 250);
        PiperAssetCache cache = CreateCache(temp);

        string modelDirectory = cache.GetModelDirectory("en_GB-northern_english_male-medium");
        cache.RecordAssetInstall(PiperAssetKind.VoiceModel, "en_GB-northern_english_male-medium", modelDirectory, 350);

        PiperAssetCache.GetDirectorySizeBytes(modelDirectory).ShouldBe(350);
    }

    [Fact]
    public void GetDirectorySizeBytes_MissingDirectory_IsZero()
    {
        using var temp = new TemporaryDirectory();
        PiperAssetCache cache = CreateCache(temp);

        PiperAssetCache.GetDirectorySizeBytes(cache.EngineDirectory).ShouldBe(0);
    }

    [Fact]
    public void TryGetNewestWriteTimeUtc_DirectoryWithoutFiles_IsNull()
    {
        using var temp = new TemporaryDirectory();
        PiperAssetCache cache = CreateCache(temp);
        Directory.CreateDirectory(cache.EngineDirectory);

        PiperAssetCache.TryGetNewestWriteTimeUtc(cache.EngineDirectory).ShouldBeNull();
    }

    // ------------------------------------------------------------------------------------ helpers

    private static PiperAssetCache CreateCache(TemporaryDirectory temp, DateTimeOffset? utcNow = null)
    {
        return new PiperAssetCache(temp.Path, TimeSpan.FromDays(14), () => utcNow ?? UtcNow);
    }
}
