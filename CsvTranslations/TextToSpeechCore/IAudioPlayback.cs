namespace TextToSpeechCore;

/// <summary>
///     Plays a WAV audio stream to completion.
/// </summary>
/// <remarks>
///     Playback is the only part of Piper text-to-speech that is inherently platform-specific:
///     synthesizing audio works anywhere PiperSharp runs, but every audio output API is tied to
///     an operating system. The dependency is therefore injected rather than referenced, so this
///     library stays platform-neutral and can be built and tested off Windows.
/// </remarks>
public interface IAudioPlayback
{
    /// <summary>
    ///     Plays the supplied WAV stream and completes when playback has stopped.
    /// </summary>
    /// <param name="wavStream">A seekable stream containing WAV audio.</param>
    /// <param name="cancellationToken">Cancels waiting for playback to finish.</param>
    /// <returns>A task that completes when playback finishes or is cancelled.</returns>
    Task PlayWavAsync(Stream wavStream, CancellationToken cancellationToken = default);
}
