using System.Runtime.Versioning;

using Shouldly;

namespace TextToSpeechApp.Tests;

/// <summary>
/// Tests for <see cref="ProcessWavPlayback"/>, the playback the app uses on every platform: which
/// player it picks for the running OS, and how it hands the WAV file to that player.
/// Verifies the per-platform candidate lists and argument shapes, the failure when no player is
/// installed, and that the WAV file is written completely and cleaned up.
/// </summary>
public sealed class ProcessWavPlaybackTests
{
    // ---------- candidate lists and argument shapes ----------

    [Fact]
    public void LinuxPlayers_ShouldPreferPipeWireAndPassTheFileAsTheOnlyArgument()
    {
        // Given: The Linux candidate list
        var players = ProcessWavPlayback.LinuxPlayers;

        // Then: PipeWire comes first, and every player is handed just the file
        players[0].ExecutableName.ShouldBe("pw-play");
        players.Select(player => player.ExecutableName)
            .ShouldBe(["pw-play", "paplay", "aplay", "ffplay"]);

        foreach (WavPlayer player in players)
        {
            player.ArgumentsFor("/tmp/speech.wav").ShouldBe(["/tmp/speech.wav"]);
        }
    }

    [Fact]
    public void MacOsPlayers_ShouldUseAfplayWithTheFileAsTheOnlyArgument()
    {
        // Given: The macOS candidate list
        var players = ProcessWavPlayback.MacOsPlayers;

        // Then: afplay is used, and it is handed just the file
        players.ShouldHaveSingleItem().ExecutableName.ShouldBe("afplay");
        players[0].ArgumentsFor("/tmp/speech.wav").ShouldBe(["/tmp/speech.wav"]);
    }

    [Fact]
    public void WindowsPlayers_ShouldPlayThroughPowerShellSoundPlayer()
    {
        // Given: The Windows candidate list
        var players = ProcessWavPlayback.WindowsPlayers;

        // Then: both PowerShell editions are tried, with .exe because Windows has no extensionless binaries
        players[0].ExecutableName.ShouldBe("powershell.exe");
        players[1].ExecutableName.ShouldBe("pwsh.exe");

        // ...and the file is named inside a script that blocks until playback finishes
        IReadOnlyList<string> arguments = players[0].ArgumentsFor("/tmp/speech.wav");

        arguments.ShouldContain("-Command");
        arguments.ShouldContain(argument => argument.Contains("SoundPlayer", StringComparison.Ordinal));
        arguments.ShouldContain(argument => argument.Contains("PlaySync()", StringComparison.Ordinal));
        arguments.ShouldContain(argument => argument.Contains("/tmp/speech.wav", StringComparison.Ordinal));
    }

    [Fact]
    public void WindowsPlayers_WithAQuoteInThePath_ShouldEscapeItForPowerShell()
    {
        // When: Building the script for a path that holds a single quote
        IReadOnlyList<string> arguments = ProcessWavPlayback.WindowsPlayers[0].ArgumentsFor("/tmp/it's here.wav");

        // Then: The quote is doubled, which is how PowerShell escapes it inside a string literal
        arguments.ShouldContain(argument => argument.Contains("it''s here.wav", StringComparison.Ordinal));
    }

    [Fact]
    public void GetPlayers_ShouldReturnTheListForThisPlatform()
    {
        // When: Asking for this platform's players
        var players = ProcessWavPlayback.GetPlayers();

        // Then: They are non-empty and come from one of the known lists
        players.ShouldNotBeEmpty();
        players.ShouldBe(
            OperatingSystem.IsWindows() ? ProcessWavPlayback.WindowsPlayers
            : OperatingSystem.IsMacOS() ? ProcessWavPlayback.MacOsPlayers
            : ProcessWavPlayback.LinuxPlayers);
    }

    // ---------- discovery ----------

    [Fact]
    public void FindPlayer_WhenTheFirstCandidateExists_ShouldPreferIt()
    {
        // Given: A machine where every candidate is installed
        Func<string, string?> locate = name => "/usr/bin/" + name;

        // When: Finding the player
        var actual = ProcessWavPlayback.FindPlayer(locate);

        // Then: The most preferred candidate is used
        actual.ShouldNotBeNull();
        actual.Value.Player.ExecutableName.ShouldBe(ProcessWavPlayback.GetPlayers()[0].ExecutableName);
    }

    [Fact]
    public void FindPlayer_WhenOnlyALaterCandidateExists_ShouldUseThatOne()
    {
        // Given: A machine that only has aplay installed
        Func<string, string?> locate = name => name == "aplay" ? "/usr/bin/aplay" : null;

        // When: Finding the player
        var actual = ProcessWavPlayback.FindPlayer(locate);

        // Then: The installed candidate is used, with its resolved path
        actual.ShouldNotBeNull();
        actual.Value.Player.ExecutableName.ShouldBe("aplay");
        actual.Value.Path.ShouldBe("/usr/bin/aplay");
    }

    [Fact]
    public void FindPlayer_WhenNothingIsInstalled_ShouldReturnNull()
    {
        // When: No candidate is installed
        var actual = ProcessWavPlayback.FindPlayer(_ => null);

        // Then: No player is reported
        actual.ShouldBeNull();
    }

    [Fact]
    public void Create_WhenNoPlayerIsInstalled_ShouldExplainWhatToInstall()
    {
        // When: Creating the playback on a machine with no supported player
        var exception = Should.Throw<PlatformNotSupportedException>(() => ProcessWavPlayback.Create(_ => null));

        // Then: The message names a player to install
        exception.Message.ShouldContain(ProcessWavPlayback.GetPlayers()[0].ExecutableName);
        exception.Message.ShouldContain("PATH");
    }

    [Fact]
    public void Constructor_WithNoPlayerPath_ShouldRejectIt()
    {
        // When: Building a playback around an empty player path
        var exception = Should.Throw<ArgumentException>(
            () => new ProcessWavPlayback(ProcessWavPlayback.GetPlayers()[0], " "));

        // Then: The argument is rejected
        exception.ParamName.ShouldBe("playerPath");
    }

    // ---------- playback ----------

    [Fact]
    public async Task PlayWavAsync_ShouldGiveThePlayerTheWholeWavFileAndCleanItUp()
    {
        // Given: A stand-in player that copies the file it is handed, so the bytes can be compared.
        // The script runs only on Unix, which is where a shell stand-in is available.
        if (OperatingSystem.IsWindows())
        {
            return;
        }

        string workDirectory = CreateTemporaryDirectory();
        string dropDirectory = Path.Join(workDirectory, "drop");
        Directory.CreateDirectory(dropDirectory);

        string capturedFilePath = Path.Join(workDirectory, "captured.wav");
        string playerPath = CreateShellScript(workDirectory, "fake-player.sh", $"cp \"$1\" \"{capturedFilePath}\"");

        var player = new WavPlayer("fake-player.sh", wavFilePath => [wavFilePath]);
        var sut = new ProcessWavPlayback(player, playerPath, dropDirectory);

        byte[] wavBytes = [0x52, 0x49, 0x46, 0x46, 0x00, 0x01, 0x02, 0x03];

        try
        {
            // When: Playing the WAV
            await sut.PlayWavAsync(new MemoryStream(wavBytes));

            // Then: The player received the complete WAV file...
            (await File.ReadAllBytesAsync(capturedFilePath)).ShouldBe(wavBytes);

            // ...and the temporary copy is gone
            Directory.GetFiles(dropDirectory).ShouldBeEmpty();
        }
        finally
        {
            Directory.Delete(workDirectory, recursive: true);
        }
    }

    [Fact]
    public async Task PlayWavAsync_WhenThePlayerFails_ShouldReportItsExitCodeAndCleanUp()
    {
        // Given: A stand-in player that fails
        if (OperatingSystem.IsWindows())
        {
            return;
        }

        string workDirectory = CreateTemporaryDirectory();
        string dropDirectory = Path.Join(workDirectory, "drop");
        Directory.CreateDirectory(dropDirectory);

        string playerPath = CreateShellScript(workDirectory, "failing-player.sh", "echo no_such_device >&2; exit 3");

        var player = new WavPlayer("failing-player.sh", wavFilePath => [wavFilePath]);
        var sut = new ProcessWavPlayback(player, playerPath, dropDirectory);

        try
        {
            // When: Playing the WAV
            var exception = await Should.ThrowAsync<InvalidOperationException>(
                () => sut.PlayWavAsync(new MemoryStream([0x00])));

            // Then: The exit code and the player's own error are reported
            exception.Message.ShouldContain("exit code 3");
            exception.Message.ShouldContain("no_such_device");

            // ...and the temporary copy is gone
            Directory.GetFiles(dropDirectory).ShouldBeEmpty();
        }
        finally
        {
            Directory.Delete(workDirectory, recursive: true);
        }
    }

    private static string CreateTemporaryDirectory()
    {
        string directoryPath = Path.Join(Path.GetTempPath(), "tts-playback-tests-" + Path.GetRandomFileName());
        Directory.CreateDirectory(directoryPath);

        return directoryPath;
    }

    [UnsupportedOSPlatform("windows")]
    private static string CreateShellScript(string directoryPath, string fileName, string body)
    {
        string scriptPath = Path.Join(directoryPath, fileName);
        File.WriteAllText(scriptPath, "#!/bin/sh\n" + body + "\n");
        File.SetUnixFileMode(
            scriptPath,
            UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);

        return scriptPath;
    }
}
