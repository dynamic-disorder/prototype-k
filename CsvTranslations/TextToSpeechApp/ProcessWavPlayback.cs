using System.Diagnostics;

using TextToSpeechCore;

namespace TextToSpeechApp;

/// <summary>
///     Plays a WAV stream by handing it to an external command-line audio player, which is how the
///     app plays Piper audio on every operating system without referencing a platform-specific audio
///     API.
/// </summary>
/// <remarks>
///     The player is chosen once, from the first entry of the list for this platform that exists on
///     <c>PATH</c> (see <see cref="GetPlayers"/>). The WAV bytes are written to a temporary file
///     because these players read a file rather than a managed stream, and the file is removed when
///     playback finishes or fails.
/// </remarks>
internal sealed class ProcessWavPlayback : IAudioPlayback
{
    /// <summary>
    ///     The Linux players, in order of preference: PipeWire, PulseAudio, ALSA, then ffmpeg's
    ///     player. Each takes the WAV path as its only argument.
    /// </summary>
    public static readonly IReadOnlyList<WavPlayer> LinuxPlayers =
    [
        new WavPlayer("pw-play", FileArgument),
        new WavPlayer("paplay", FileArgument),
        new WavPlayer("aplay", FileArgument),
        new WavPlayer("ffplay", FileArgument)
    ];

    /// <summary>
    ///     The macOS player. <c>afplay</c> ships with the system and takes the WAV path as its only
    ///     argument.
    /// </summary>
    public static readonly IReadOnlyList<WavPlayer> MacOsPlayers =
    [
        new WavPlayer("afplay", FileArgument)
    ];

    /// <summary>
    ///     The Windows players. Windows ships no command-line WAV player, so both Windows PowerShell
    ///     and PowerShell 7 are tried with <c>System.Media.SoundPlayer</c>; its <c>PlaySync</c> is
    ///     what makes the call return when playback has finished rather than when it has started.
    /// </summary>
    public static readonly IReadOnlyList<WavPlayer> WindowsPlayers =
    [
        new WavPlayer("powershell.exe", SoundPlayerArgument),
        new WavPlayer("pwsh.exe", SoundPlayerArgument)
    ];

    private const int CopyBufferSize = 81920;

    private readonly WavPlayer _player;
    private readonly string _playerPath;
    private readonly string _tempDirectory;

    /// <summary>
    ///     Initializes a new instance of the <see cref="ProcessWavPlayback"/> class.
    /// </summary>
    /// <param name="player">The player to run.</param>
    /// <param name="playerPath">The absolute path of the player executable.</param>
    /// <param name="tempDirectory">
    ///     The directory the WAV file is written to. Defaults to the system temporary directory; tests
    ///     pass their own so they can assert the file is cleaned up.
    /// </param>
    public ProcessWavPlayback(WavPlayer player, string playerPath, string? tempDirectory = null)
    {
        ArgumentNullException.ThrowIfNull(player);

        if (string.IsNullOrWhiteSpace(playerPath))
        {
            throw new ArgumentException("A player path is required.", nameof(playerPath));
        }

        _player = player;
        _playerPath = playerPath;
        _tempDirectory = string.IsNullOrWhiteSpace(tempDirectory) ? Path.GetTempPath() : tempDirectory;
    }

    /// <summary>
    ///     The players this platform can use, in order of preference.
    /// </summary>
    /// <returns>The candidate list for Windows, macOS or Linux.</returns>
    public static IReadOnlyList<WavPlayer> GetPlayers()
    {
        if (OperatingSystem.IsWindows())
        {
            return WindowsPlayers;
        }

        if (OperatingSystem.IsMacOS())
        {
            return MacOsPlayers;
        }

        return LinuxPlayers;
    }

    /// <summary>
    ///     Finds the first supported audio player for this platform on <c>PATH</c>.
    /// </summary>
    /// <param name="locateExecutable">
    ///     Resolves an executable name to its full path, or <c>null</c> when it is not installed.
    ///     Defaults to a <c>PATH</c> lookup; tests inject a stub so no real player is needed.
    /// </param>
    /// <returns>The player and its resolved path, or <c>null</c> when none is installed.</returns>
    public static (WavPlayer Player, string Path)? FindPlayer(Func<string, string?>? locateExecutable = null)
    {
        Func<string, string?> locate = locateExecutable ?? FindOnPath;

        foreach (WavPlayer candidate in GetPlayers())
        {
            string? playerPath = locate(candidate.ExecutableName);
            if (playerPath is not null)
            {
                return (candidate, playerPath);
            }
        }

        return null;
    }

    /// <summary>
    ///     Creates the playback for this machine, throwing a message the user can act on when no
    ///     supported player is installed.
    /// </summary>
    /// <param name="locateExecutable">
    ///     Resolves an executable name to its full path, or <c>null</c> when it is not installed.
    ///     Defaults to a <c>PATH</c> lookup; tests inject a stub so the failure path can be checked on
    ///     a machine that does have a player.
    /// </param>
    /// <returns>The playback, bound to the player that was found.</returns>
    /// <exception cref="PlatformNotSupportedException">No supported player is on <c>PATH</c>.</exception>
    public static ProcessWavPlayback Create(Func<string, string?>? locateExecutable = null)
    {
        (WavPlayer Player, string Path)? found = FindPlayer(locateExecutable);
        if (found is null)
        {
            throw new PlatformNotSupportedException(BuildNoPlayerMessage());
        }

        return new ProcessWavPlayback(found.Value.Player, found.Value.Path);
    }

    /// <inheritdoc />
    public async Task PlayWavAsync(Stream wavStream, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(wavStream);

        string wavFilePath = Path.Join(_tempDirectory, Path.GetRandomFileName() + ".wav");

        try
        {
            await WriteWavFileAsync(wavStream, wavFilePath, cancellationToken);
            await RunPlayerAsync(wavFilePath, cancellationToken);
        }
        finally
        {
            TryDelete(wavFilePath);
        }
    }

    private static IReadOnlyList<string> FileArgument(string wavFilePath)
    {
        return [wavFilePath];
    }

    private static IReadOnlyList<string> SoundPlayerArgument(string wavFilePath)
    {
        // A single quote in the path would end the PowerShell string literal, so it is doubled, which
        // is how PowerShell escapes it.
        string escapedPath = wavFilePath.Replace("'", "''", StringComparison.Ordinal);

        return
        [
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            $"$player = New-Object Media.SoundPlayer; $player.SoundLocation = '{escapedPath}'; $player.PlaySync()"
        ];
    }

    private static async Task WriteWavFileAsync(Stream wavStream, string wavFilePath, CancellationToken cancellationToken)
    {
        await using var fileStream = new FileStream(
            wavFilePath,
            FileMode.CreateNew,
            FileAccess.Write,
            FileShare.None,
            CopyBufferSize,
            useAsync: true);

        await wavStream.CopyToAsync(fileStream, cancellationToken);
    }

    private async Task RunPlayerAsync(string wavFilePath, CancellationToken cancellationToken)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = _playerPath,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardError = true
        };

        foreach (string argument in _player.ArgumentsFor(wavFilePath))
        {
            startInfo.ArgumentList.Add(argument);
        }

        using Process playerProcess = Process.Start(startInfo)
                                      ?? throw new InvalidOperationException($"'{_playerPath}' could not be started.");

        // The error stream is drained while the player runs, because a player that fills its pipe
        // would block; the text only reaches the user when playback actually fails. The read is
        // deliberately not cancellable: cancelling kills the player, which closes the stream.
        Task<string> errorOutput = playerProcess.StandardError.ReadToEndAsync(CancellationToken.None);

        // Stopping playback means killing the player: there is no cross-platform pause or stop API.
        using CancellationTokenRegistration cancellationRegistration = cancellationToken.Register(() => KillQuietly(playerProcess));

        try
        {
            await playerProcess.WaitForExitAsync(cancellationToken);
        }
        catch (OperationCanceledException)
        {
            KillQuietly(playerProcess);
            throw;
        }

        string errors = await errorOutput;

        if (playerProcess.ExitCode != 0)
        {
            string playerOutput = string.IsNullOrWhiteSpace(errors) ? string.Empty : " " + errors.Trim();
            throw new InvalidOperationException($"'{_playerPath}' could not play the audio (exit code {playerProcess.ExitCode}).{playerOutput}");
        }
    }

    private static void KillQuietly(Process process)
    {
        try
        {
            if (!process.HasExited)
            {
                process.Kill(entireProcessTree: true);
            }
        }
        catch (Exception exception) when (exception is InvalidOperationException or NotSupportedException or System.ComponentModel.Win32Exception)
        {
            // The player exited between the check and the kill, so there is nothing left to stop.
        }
    }

    private static string? FindOnPath(string executableName)
    {
        string? pathVariable = Environment.GetEnvironmentVariable("PATH");
        if (string.IsNullOrEmpty(pathVariable))
        {
            return null;
        }

        foreach (string directory in pathVariable.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries))
        {
            string candidatePath = Path.Join(directory, executableName);
            if (File.Exists(candidatePath))
            {
                return candidatePath;
            }
        }

        return null;
    }

    private static void TryDelete(string filePath)
    {
        try
        {
            File.Delete(filePath);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            // A leftover file in the temporary directory must not fail an utterance that was played.
        }
    }

    private static string BuildNoPlayerMessage()
    {
        string candidates = string.Join(", ", GetPlayers().Select(player => player.ExecutableName));

        if (OperatingSystem.IsWindows())
        {
            return $"No audio player was found on PATH (tried: {candidates}). Windows PowerShell is normally enough — "
                   + "install PowerShell, or add it to PATH, and run the app again.";
        }

        return $"No audio player was found on PATH (tried: {candidates}). Install one of them — for example PipeWire "
               + "(pw-play), PulseAudio (paplay), ALSA (aplay) or ffmpeg (ffplay) — and run the app again.";
    }
}
