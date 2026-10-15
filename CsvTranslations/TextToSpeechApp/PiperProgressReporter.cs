using Spectre.Console;

using TextToSpeechCore;

namespace TextToSpeechApp;

/// <summary>
///     Renders <see cref="PiperAssetProgress"/> reports as Spectre.Console progress rows, one row per
///     Piper asset (the engine plus each voice model), so a long first run shows which asset is being
///     downloaded, how many megabytes have arrived and how far along it is. Implemented synchronously
///     (instead of via <see cref="Progress{T}"/>) so reports cannot be reordered by the thread pool
///     and the final report always wins.
/// </summary>
internal sealed class PiperProgressReporter : IProgress<PiperAssetProgress>
{
    private readonly ProgressContext _progressContext;
    private readonly Dictionary<string, ProgressTask> _tasksByAssetLabel = new(StringComparer.Ordinal);

    /// <summary>
    ///     Initializes a new instance of the <see cref="PiperProgressReporter"/> class.
    /// </summary>
    /// <param name="progressContext">The live progress context that owns the task rows.</param>
    public PiperProgressReporter(ProgressContext progressContext)
    {
        _progressContext = progressContext;
    }

    /// <summary>
    ///     Applies a single asset report to its progress row, creating the row on first use.
    /// </summary>
    /// <param name="progress">The report to display.</param>
    public void Report(PiperAssetProgress progress)
    {
        ProgressTask task = GetOrAddTask(progress);
        task.Description = progress.Message;

        if (progress.IsComplete)
        {
            // Cached and installed assets are done: show a full bar rather than a spinner.
            task.IsIndeterminate = false;
            task.Value = task.MaxValue;

            return;
        }

        if (progress.IsFailed)
        {
            task.IsIndeterminate = false;
            task.Value = 0;

            return;
        }

        if (progress.IsIndeterminate)
        {
            // The total size is unknown, so only the megabytes received can be shown.
            task.IsIndeterminate = true;

            return;
        }

        task.IsIndeterminate = false;
        task.Value = task.MaxValue * progress.PercentComplete / 100.0;
    }

    private ProgressTask GetOrAddTask(PiperAssetProgress progress)
    {
        if (_tasksByAssetLabel.TryGetValue(progress.AssetLabel, out ProgressTask? existingTask))
        {
            return existingTask;
        }

        ProgressTask createdTask = _progressContext.AddTask(progress.AssetLabel);
        _tasksByAssetLabel[progress.AssetLabel] = createdTask;

        return createdTask;
    }
}
