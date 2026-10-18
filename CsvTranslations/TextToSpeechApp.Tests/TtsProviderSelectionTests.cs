using Shouldly;

namespace TextToSpeechApp.Tests;

/// <summary>
/// Tests for <see cref="TtsProviderSelection.Resolve"/>, which decides which provider the app runs.
/// Verifies that Piper is always the answer, and that the notice explains what happened to the
/// provider that was asked for.
/// </summary>
public sealed class TtsProviderSelectionTests
{
    [Theory]
    [InlineData("Piper")]
    [InlineData("piper")]
    [InlineData("PIPER")]
    public void Resolve_PiperRequested_ShouldKeepPiperWithoutNotice(string requestedProvider)
    {
        // When: Resolving Piper
        var actual = TtsProviderSelection.Resolve(requestedProvider, out var notice);

        // Then: Piper is kept and the user is told nothing
        actual.ShouldBe(TtsProviderSelection.PiperProvider);
        notice.ShouldBeNull();
    }

    [Fact]
    public void Resolve_RemovedWindowsProvider_ShouldFallBackToPiperWithNotice()
    {
        // When: Resolving the Windows provider that no longer exists
        var actual = TtsProviderSelection.Resolve(TtsProviderSelection.RemovedWindowsProvider, out var notice);

        // Then: Piper is used, and the notice says the Windows provider was removed and how to silence it
        actual.ShouldBe(TtsProviderSelection.PiperProvider);
        notice.ShouldNotBeNull();
        notice.ShouldContain(TtsProviderSelection.RemovedWindowsProvider);
        notice.ShouldContain("removed");
        notice.ShouldContain("settings.json");
    }

    [Fact]
    public void Resolve_UnknownProvider_ShouldFallBackToPiperWithNotice()
    {
        // When: Resolving a provider that does not exist
        var actual = TtsProviderSelection.Resolve("Festival", out var notice);

        // Then: Piper is used, and the notice names the value and the only provider
        actual.ShouldBe(TtsProviderSelection.PiperProvider);
        notice.ShouldNotBeNull();
        notice.ShouldContain("Festival");
        notice.ShouldContain(TtsProviderSelection.PiperProvider);
    }

    [Fact]
    public void Resolve_EmptyProvider_ShouldFallBackToPiperWithNotice()
    {
        // When: Resolving an empty provider name
        var actual = TtsProviderSelection.Resolve(string.Empty, out var notice);

        // Then: Piper is used and the user is told why
        actual.ShouldBe(TtsProviderSelection.PiperProvider);
        notice.ShouldNotBeNull();
    }
}
