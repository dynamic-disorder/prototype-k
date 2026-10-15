namespace TextToSpeechCore.Tests;

/// <summary>
///     A throwaway directory below the system temp path, deleted when the test finishes. Used by the
///     tests that exercise the Piper engine and voice model cache on disk.
/// </summary>
internal sealed class TemporaryDirectory : IDisposable
{
    /// <summary>
    ///     Creates a new, empty temporary directory.
    /// </summary>
    public TemporaryDirectory()
    {
        Path = System.IO.Path.Join(
            System.IO.Path.GetTempPath(),
            "texttospeechcore-tests",
            Guid.NewGuid().ToString("N"));

        Directory.CreateDirectory(Path);
    }

    /// <summary>
    ///     The absolute path of the temporary directory.
    /// </summary>
    public string Path { get; }

    /// <summary>
    ///     Creates a file of a given size below the temporary directory, creating parent directories
    ///     as needed.
    /// </summary>
    /// <param name="relativePath">The path of the file, relative to the temporary directory.</param>
    /// <param name="sizeBytes">The number of bytes to write.</param>
    /// <returns>The absolute path of the created file.</returns>
    public string CreateFile(string relativePath, int sizeBytes)
    {
        return WriteFile(relativePath, new byte[sizeBytes]);
    }

    /// <summary>
    ///     Writes a file with the given content below the temporary directory, creating parent
    ///     directories as needed.
    /// </summary>
    /// <param name="relativePath">The path of the file, relative to the temporary directory.</param>
    /// <param name="content">The bytes to write.</param>
    /// <returns>The absolute path of the created file.</returns>
    public string WriteFile(string relativePath, byte[] content)
    {
        string filePath = System.IO.Path.Join(Path, relativePath);
        string? directoryPath = System.IO.Path.GetDirectoryName(filePath);

        if (!string.IsNullOrEmpty(directoryPath))
        {
            Directory.CreateDirectory(directoryPath);
        }

        File.WriteAllBytes(filePath, content);

        return filePath;
    }

    /// <inheritdoc/>
    public void Dispose()
    {
        try
        {
            if (Directory.Exists(Path))
            {
                Directory.Delete(Path, recursive: true);
            }
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            // A leftover temp directory must never fail an otherwise passing test.
        }
    }
}
