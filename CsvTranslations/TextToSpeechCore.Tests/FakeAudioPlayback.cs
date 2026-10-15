namespace TextToSpeechCore.Tests;

/// <summary>
///     An <see cref="IAudioPlayback" /> that records what it was asked to play instead of
///     producing sound.
/// </summary>
/// <remarks>
///     This is the seam that makes <see cref="PiperTextToSpeechService" /> testable away from
///     Windows: playback is the only OS-specific part of Piper speech, so substituting it means
///     no audio device is involved and the tests run anywhere.
/// </remarks>
public sealed class FakeAudioPlayback : IAudioPlayback
{
    private readonly List<PlaybackRequest> _requests = [];

    /// <summary>Every playback request received, in order.</summary>
    public IReadOnlyList<PlaybackRequest> Requests => _requests;

    /// <summary>How many times playback was requested. Zero means "nothing was spoken".</summary>
    public int CallCount => _requests.Count;

    /// <inheritdoc />
    public Task PlayWavAsync(Stream wavStream, CancellationToken cancellationToken = default)
    {
        _requests.Add(new PlaybackRequest(wavStream.Length, wavStream.CanSeek));
        return Task.CompletedTask;
    }

    /// <summary>A single recorded playback request.</summary>
    /// <param name="Length">Length of the WAV stream handed to playback.</param>
    /// <param name="CanSeek">Whether the stream was seekable (NAudio's reader requires this).</param>
    public sealed record PlaybackRequest(long Length, bool CanSeek);
}
