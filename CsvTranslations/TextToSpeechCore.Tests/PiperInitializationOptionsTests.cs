using Shouldly;

namespace TextToSpeechCore.Tests;

/// <summary>
///     Tests for <see cref="PiperInitializationOptions" />: the two week cache default and the
///     mapping from configured days to the time-to-live used by the cache.
/// </summary>
public sealed class PiperInitializationOptionsTests
{
    [Fact]
    public void DefaultCacheTtlDays_IsTwoWeeks()
    {
        PiperInitializationOptions.DefaultCacheTtlDays.ShouldBe(14);
    }

    [Fact]
    public void NewOptions_UseTheDefaults()
    {
        var options = new PiperInitializationOptions();

        options.AssetRootDirectory.ShouldBeNull();
        options.CacheTtlDays.ShouldBe(PiperInitializationOptions.DefaultCacheTtlDays);
    }

    [Theory]
    [InlineData(1, 1)]
    [InlineData(14, 14)]
    [InlineData(365, 365)]
    public void ResolveCacheTtl_PositiveDays_ReturnsThatManyDays(int configuredDays, int expectedDays)
    {
        var options = new PiperInitializationOptions { CacheTtlDays = configuredDays };

        options.ResolveCacheTtl().ShouldBe(TimeSpan.FromDays(expectedDays));
    }

    [Fact]
    public void ResolveCacheTtl_Default_IsTwoWeeks()
    {
        new PiperInitializationOptions().ResolveCacheTtl().ShouldBe(TimeSpan.FromDays(14));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(-365)]
    public void ResolveCacheTtl_NonPositiveDays_MeansNeverExpires(int configuredDays)
    {
        var options = new PiperInitializationOptions { CacheTtlDays = configuredDays };

        options.ResolveCacheTtl().ShouldBe(TimeSpan.MaxValue);
    }
}
