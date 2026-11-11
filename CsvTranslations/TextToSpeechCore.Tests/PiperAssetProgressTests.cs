using Shouldly;

namespace TextToSpeechCore.Tests;

/// <summary>
///     Tests for <see cref="PiperAssetProgress" /> and <see cref="PiperSizeFormatter" />: the
///     megabyte values and percentages shown while the Piper engine and voice models are prepared.
/// </summary>
public sealed class PiperAssetProgressTests
{
    private const long Megabyte = 1024 * 1024;

    // ---------------------------------------------------------------------------------- labels

    /// <summary>
    ///     Verifies engine progress is labelled as the Piper TTS engine and keeps its asset key.
    /// </summary>
    [Fact]
    public void Constructor_EngineKind_LabelsTheEngine()
    {
        var progress = Create(PiperAssetKind.Engine, PiperAssetInstaller.EngineAssetKey);

        progress.AssetLabel.ShouldBe("Piper TTS engine");
        progress.AssetKey.ShouldBe(PiperAssetInstaller.EngineAssetKey);
    }

    /// <summary>
    ///     Verifies model progress names the voice model by its key.
    /// </summary>
    [Fact]
    public void Constructor_VoiceModelKind_LabelsTheModelWithItsKey()
    {
        var progress = Create(PiperAssetKind.VoiceModel, "vi_VN-vivos-x_low");

        progress.AssetLabel.ShouldBe("Voice model 'vi_VN-vivos-x_low'");
    }

    /// <summary>
    ///     Verifies a report without sizes shows zero bytes, megabytes and percent, and counts as
    ///     indeterminate.
    /// </summary>
    [Fact]
    public void Constructor_WithoutSizes_ReportsZeroMegabytes()
    {
        var progress = Create(PiperAssetKind.VoiceModel, "vi_VN-vivos-x_low");

        progress.BytesReceived.ShouldBe(0);
        progress.TotalBytes.ShouldBe(0);
        progress.AssetSizeBytes.ShouldBe(0);
        progress.ReceivedMegabytes.ShouldBe(0);
        progress.TotalMegabytes.ShouldBe(0);
        progress.AssetMegabytes.ShouldBe(0);
        progress.PercentComplete.ShouldBe(0);
        progress.IsIndeterminate.ShouldBeTrue();
    }

    // --------------------------------------------------------------------------- percent complete

    /// <summary>
    ///     Verifies the percentage is rounded and clamped between zero and one hundred for zero, negative
    ///     and over-complete byte counts.
    /// </summary>
    [Theory]
    [InlineData(0, 0, 0)]
    [InlineData(0, 100, 0)]
    [InlineData(100, 0, 0)]
    [InlineData(-5, 100, 0)]
    [InlineData(30, 100, 30)]
    [InlineData(100, 100, 100)]
    [InlineData(150, 100, 100)]
    [InlineData(1, 3, 33)]
    [InlineData(2, 3, 67)]
    public void CalculatePercentComplete_ClampsBetweenZeroAndHundred(long receivedBytes, long totalBytes, int expected)
    {
        PiperAssetProgress.CalculatePercentComplete(receivedBytes, totalBytes).ShouldBe(expected);
    }

    /// <summary>
    ///     Verifies half the bytes downloaded reports fifty percent and a determinate bar.
    /// </summary>
    [Fact]
    public void PercentComplete_ReportsTheDownloadedShare()
    {
        var progress = new PiperAssetProgress(
            PiperAssetKind.VoiceModel,
            "vi_VN-vivos-x_low",
            PiperAssetStage.Downloading,
            "downloading",
            bytesReceived: 27 * Megabyte,
            totalBytes: 54 * Megabyte);

        progress.PercentComplete.ShouldBe(50);
        progress.IsIndeterminate.ShouldBeFalse();
    }

    // ----------------------------------------------------------------------------- size formatting

    /// <summary>
    ///     Verifies sizes are shown in binary megabytes with one decimal.
    /// </summary>
    [Theory]
    [InlineData(0, "0.0 MB")]
    [InlineData(Megabyte, "1.0 MB")]
    [InlineData(27789413, "26.5 MB")]
    [InlineData(63201294, "60.3 MB")]
    public void Format_UsesOneDecimalMegabytes(long bytes, string expected)
    {
        PiperSizeFormatter.Format(bytes).ShouldBe(expected);
    }

    /// <summary>
    ///     Verifies a megabyte is counted as 1024 times 1024 bytes.
    /// </summary>
    [Fact]
    public void ToMegabytes_UsesBinaryMegabytes()
    {
        PiperSizeFormatter.ToMegabytes(2 * Megabyte).ShouldBe(2.0);
    }

    /// <summary>
    ///     Verifies progress text pairs received and total megabytes with the percentage.
    /// </summary>
    [Fact]
    public void FormatProgress_WithTotal_ShowsReceivedTotalAndPercentage()
    {
        PiperSizeFormatter.FormatProgress(27 * Megabyte, 54 * Megabyte).ShouldBe("27.0 / 54.0 MB (50%)");
    }

    /// <summary>
    ///     Verifies progress text omits the total when none is known.
    /// </summary>
    [Fact]
    public void FormatProgress_WithoutTotal_ShowsReceivedOnly()
    {
        PiperSizeFormatter.FormatProgress(27 * Megabyte, 0).ShouldBe("27.0 MB");
    }

    // ------------------------------------------------------------------------------------ stages

    /// <summary>
    ///     Verifies cache hits and installs count as complete and only failures count as failed.
    /// </summary>
    [Theory]
    [InlineData(PiperAssetStage.CacheHit, true, false)]
    [InlineData(PiperAssetStage.Installed, true, false)]
    [InlineData(PiperAssetStage.Downloading, false, false)]
    [InlineData(PiperAssetStage.Failed, false, true)]
    public void Stage_IsClassifiedForTheDisplay(PiperAssetStage stage, bool expectedComplete, bool expectedFailed)
    {
        var progress = new PiperAssetProgress(PiperAssetKind.Engine, PiperAssetInstaller.EngineAssetKey, stage, "message");

        progress.IsComplete.ShouldBe(expectedComplete);
        progress.IsFailed.ShouldBe(expectedFailed);
    }

    /// <summary>
    ///     Verifies the text form pairs the asset label with the stage message.
    /// </summary>
    [Fact]
    public void ToString_CombinesTheAssetLabelAndTheMessage()
    {
        var progress = new PiperAssetProgress(PiperAssetKind.Engine, PiperAssetInstaller.EngineAssetKey, PiperAssetStage.Installed, "Piper TTS engine is ready (10.0 MB downloaded).");

        progress.ToString().ShouldBe("Piper TTS engine: Piper TTS engine is ready (10.0 MB downloaded).");
    }

    private static PiperAssetProgress Create(PiperAssetKind kind, string assetKey)
    {
        return new PiperAssetProgress(kind, assetKey, PiperAssetStage.Checking, "checking");
    }
}
