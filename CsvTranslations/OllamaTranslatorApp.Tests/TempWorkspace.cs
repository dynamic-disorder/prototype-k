using System.Text;

namespace OllamaTranslatorApp.Tests;

/// <summary>
///     A disposable scratch directory under the system temp path. Tests that need real
///     files on disk use this so they never write into the repository or depend on the
///     current working directory.
/// </summary>
public sealed class TempWorkspace : IDisposable
{
    public TempWorkspace()
    {
        Path = System.IO.Path.Combine(System.IO.Path.GetTempPath(), $"ollama-app-tests-{Guid.NewGuid():N}");
        Directory.CreateDirectory(Path);
    }

    /// <summary>Absolute path of the scratch directory.</summary>
    public string Path { get; }

    /// <summary>
    ///     Writes <paramref name="content" /> to <paramref name="fileName" /> inside the
    ///     scratch directory and returns the absolute file path.
    /// </summary>
    /// <param name="newLine">
    ///     Line ending to normalise to. Defaults to LF; CSV fixtures need CRLF because
    ///     CsvHelper is configured with <c>NewLine = "\r\n"</c>.
    /// </param>
    public string WriteFile(string fileName, string content, string newLine = "\n")
    {
        string filePath = System.IO.Path.Combine(Path, fileName);
        Directory.CreateDirectory(System.IO.Path.GetDirectoryName(filePath)!);
        File.WriteAllText(filePath, content.Replace("\n", newLine), new UTF8Encoding(false));
        return filePath;
    }

    /// <summary>Returns an absolute path inside the scratch directory.</summary>
    public string Combine(params string[] parts) => System.IO.Path.Combine([Path, .. parts]);

    /// <inheritdoc />
    public void Dispose()
    {
        try
        {
            if (Directory.Exists(Path))
            {
                Directory.Delete(Path, recursive: true);
            }
        }
        catch (IOException)
        {
            // Best-effort cleanup: a leaked temp directory must not fail a test run.
        }
    }
}
