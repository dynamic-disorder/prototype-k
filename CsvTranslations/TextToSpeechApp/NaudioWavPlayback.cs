using NAudio.Wave;

using TextToSpeechCore;

namespace TextToSpeechApp;

/// <summary>
///     Windows audio playback for <see cref="PiperTextToSpeechService" />, using NAudio's WinMM
///     <see cref="WaveOut" /> player.
/// </summary>
/// <remarks>
///     This lives in the app rather than in <c>TextToSpeechCore</c> on purpose: since NAudio 3.0
///     the monolithic package is split per platform, and <c>NAudio.WinMM</c> (which owns
///     <see cref="WaveOut" />) only ships a Windows target framework. Keeping the Windows-only
///     dependency here is what lets <c>TextToSpeechCore</c> stay <c>net10.0</c> — the alternative
///     was widening the library's target framework to match the package.
/// </remarks>
internal sealed class NaudioWavPlayback : IAudioPlayback
{
    /// <inheritdoc />
    public async Task PlayWavAsync(Stream wavStream, CancellationToken cancellationToken = default)
    {
        using var reader = new WaveFileReader(wavStream);
        using var output = new WaveOut();
        var playbackFinished = new TaskCompletionSource<bool>();

        output.PlaybackStopped += (_, _) => { playbackFinished.TrySetResult(true); };
        output.Init(reader);
        output.Play();

        // Disposing output on the way out stops playback if the wait is cancelled.
        await playbackFinished.Task.WaitAsync(cancellationToken);
    }
}
