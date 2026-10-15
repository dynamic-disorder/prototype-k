using System.Globalization;

namespace TextToSpeechCore;

/// <summary>
///     Formats byte counts as megabyte values for Piper asset progress reports.
/// </summary>
public static class PiperSizeFormatter
{
    /// <summary>
    ///     The number of bytes in one megabyte (binary megabyte, 1024 * 1024).
    /// </summary>
    public const double BytesPerMegabyte = 1024 * 1024;

    /// <summary>
    ///     Converts a byte count to megabytes.
    /// </summary>
    /// <param name="bytes">The byte count to convert.</param>
    /// <returns>The size in megabytes.</returns>
    public static double ToMegabytes(long bytes)
    {
        return bytes / BytesPerMegabyte;
    }

    /// <summary>
    ///     Formats a byte count as megabytes with a single decimal, for example <c>"63.2 MB"</c>.
    /// </summary>
    /// <param name="bytes">The byte count to format.</param>
    /// <returns>The size in megabytes, culture-invariant.</returns>
    public static string Format(long bytes)
    {
        return ToMegabytes(bytes).ToString("0.0", CultureInfo.InvariantCulture) + " MB";
    }

    /// <summary>
    ///     Formats an amount received against a total as megabytes and a percentage, for example
    ///     <c>"12.4 / 63.2 MB (20%)"</c>. When <paramref name="totalBytes"/> is unknown (<c>0</c>)
    ///     only the received amount is formatted.
    /// </summary>
    /// <param name="receivedBytes">The number of bytes received so far.</param>
    /// <param name="totalBytes">The total number of bytes, or <c>0</c> when unknown.</param>
    /// <returns>The formatted progress, culture-invariant.</returns>
    public static string FormatProgress(long receivedBytes, long totalBytes)
    {
        if (totalBytes <= 0)
        {
            return Format(receivedBytes);
        }

        string received = ToMegabytes(receivedBytes).ToString("0.0", CultureInfo.InvariantCulture);
        int percentComplete = PiperAssetProgress.CalculatePercentComplete(receivedBytes, totalBytes);

        return $"{received} / {Format(totalBytes)} ({percentComplete}%)";
    }
}
