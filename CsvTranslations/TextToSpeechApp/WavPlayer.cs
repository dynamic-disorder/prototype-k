namespace TextToSpeechApp;

/// <summary>
///     A command-line audio player that can be handed a WAV file: the executable to look for on
///     <c>PATH</c>, and the arguments that make it play the file and return when playback has
///     finished.
/// </summary>
/// <remarks>
///     The arguments are built per player rather than shared, because the players do not agree on
///     how a file is named. Every player on Linux and macOS takes the path as its only argument,
///     while Windows has no such player and goes through PowerShell's
///     <c>System.Media.SoundPlayer</c>, where the path belongs inside the script text.
/// </remarks>
internal sealed class WavPlayer
{
    private readonly Func<string, IReadOnlyList<string>> _argumentsFor;

    /// <summary>
    ///     Initializes a new instance of the <see cref="WavPlayer"/> class.
    /// </summary>
    /// <param name="executableName">
    ///     The file name to look for on <c>PATH</c>, including the extension where the platform
    ///     needs one (<c>powershell.exe</c> on Windows).
    /// </param>
    /// <param name="argumentsFor">
    ///     Builds the arguments that play the supplied WAV file to completion.
    /// </param>
    public WavPlayer(string executableName, Func<string, IReadOnlyList<string>> argumentsFor)
    {
        if (string.IsNullOrWhiteSpace(executableName))
        {
            throw new ArgumentException("An executable name is required.", nameof(executableName));
        }

        ArgumentNullException.ThrowIfNull(argumentsFor);

        ExecutableName = executableName;
        _argumentsFor = argumentsFor;
    }

    /// <summary>
    ///     The file name this player is looked up by on <c>PATH</c>.
    /// </summary>
    public string ExecutableName { get; }

    /// <summary>
    ///     Builds the arguments that play <paramref name="wavFilePath"/> to completion.
    /// </summary>
    /// <param name="wavFilePath">The absolute path of the WAV file to play.</param>
    /// <returns>The arguments to pass to <see cref="ExecutableName"/>.</returns>
    public IReadOnlyList<string> ArgumentsFor(string wavFilePath)
    {
        return _argumentsFor(wavFilePath);
    }
}
