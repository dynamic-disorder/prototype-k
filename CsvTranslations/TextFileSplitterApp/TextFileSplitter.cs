namespace TextFileSplitterApp;

/// <summary>
/// Provides methods to split large text files into smaller files and
/// to format split outputs as translation entries.
/// </summary>
public class TextFileSplitter
{
    /// <summary>
    /// Default maximum number of lines per output file (legacy constant).
    /// </summary>
    public const int MaxLinesPerFile1 = 25000;

    /// <summary>
    /// Minimum number of lines required to perform a split.
    /// </summary>
    public const int MinLinesPerFile = 250;

    /// <inheritdoc />
    public static async Task<SplitProcessInfo> SplitFileAsync(SplitRequestInfo splitRequestInfo)
    {
        var splitProcessInfo = new SplitProcessInfo(splitRequestInfo);

        var initializationError = splitProcessInfo.Initialize();
        if (!string.IsNullOrEmpty(initializationError))
        {
            splitProcessInfo.ErrorList.Add($"Initialization failed: {initializationError}");
            return splitProcessInfo;
        }

        using var inputReader = new StreamReader(splitProcessInfo.InputFilepath);

        try
        {
            await ProcessFileLinesAsync(inputReader, splitProcessInfo);
        }
        catch (Exception ex)
        {
            splitProcessInfo.ErrorList.Add($"Unexpected error during file splitting: {ex.Message}");
        }

        return splitProcessInfo;
    }

    private static async Task ProcessFileLinesAsync(StreamReader reader, SplitProcessInfo processInfo)
    {
        await using var lineProcessor = new FileLineProcessor(processInfo, MinLinesPerFile);
        
        // Skip CSV header line if it exists (already read and stored)
        if (!string.IsNullOrEmpty(processInfo.CsvHeaderLine))
        {
            var headerLine = await reader.ReadLineAsync(); // Read and discard the header
            if (headerLine == null)
            {
                // Empty CSV file, nothing to process
                return;
            }
        }
        
        while (true)
        {
            var line = await reader.ReadLineAsync();
            if (line is null)
            {
                break; // EOF reached
            }

            await lineProcessor.ProcessLineAsync(line);
        }

        await lineProcessor.CompleteProcessingAsync();
    }

    /// <summary>
    /// Counts the total number of non-empty lines in the specified file.
    /// This is an internal helper and does not perform public validation.
    /// </summary>
    /// <param name="filePath">Path to the file to count lines for.</param>
    /// <returns>Total number of non-empty lines in the file.</returns>
    private static async Task<int> GetTotalLinesAsync(string filePath)
    {
        var lineCount = 0;
        using var reader = new StreamReader(filePath);
        while (true)
        {
            var line = await reader.ReadLineAsync();
            if (line is null)
            {
                break;
            }

            // Count every line read, including empty lines, to avoid losing content
            lineCount++;
        }

        return lineCount;
    }

    /// <inheritdoc />
    public static async Task<SplitRequestInfo> GetSplittingInformation(string filePath, int maxLinesPerFile)
    {
        try
        {
            if (!File.Exists(filePath))
            {
                var errorRequestInfo = new SplitRequestInfo();
                errorRequestInfo.ErrorMessages.Add($"ErrorList: File not found at path: {filePath}");
                return errorRequestInfo;
            }

            var totalLines = await GetTotalLinesAsync(filePath);
            var estimatedFileCount = Math.Max(1, (int)Math.Ceiling((double)totalLines / Math.Max(1, maxLinesPerFile)));

            var splitFileInfo = new SplitRequestInfo
            {
                InputFilepath = filePath,
                TotalLinesPerFile = totalLines,
                // The requested number of lines per output file
                SplitLinesPerFile = maxLinesPerFile,
                // Estimated number of output files required
                SplitFilesAmount = estimatedFileCount
            };

            return splitFileInfo;
        }
        catch (Exception ex)
        {
            var errorRequestInfo = new SplitRequestInfo();
            errorRequestInfo.ErrorMessages.Add($"ErrorList occurred: {ex.Message}");
            return errorRequestInfo;
        }
    }

    /// <summary>
    /// Formats the files produced by a split operation as translation entries.
    /// </summary>
    /// <param name="splitResult">The split operation result containing output file paths.</param>
    /// <returns>A task representing the asynchronous formatting operation.</returns>
    public static async Task FormatAsTranslationEntries(SplitProcessInfo splitResult)
    {
        foreach (var filePath in splitResult.OutputFiles)
        {
            // Create a new TranslationEntryFormatter instance for each file
            await TranslationEntryFormatter.FormatFile(filePath);
        }
    }

    /// <summary>
    /// Handles line-by-line processing and file rotation with proper resource management.
    /// </summary>
    private sealed class FileLineProcessor : IAsyncDisposable
    {
        private readonly SplitProcessInfo _processInfo;
        private readonly int _minLinesPerFile;
        private int _currentOutputLineCount;
        private FileStream? _outputFileStream;
        private StreamWriter? _outputFileWriter;

        public FileLineProcessor(SplitProcessInfo processInfo, int minLinesPerFile)
        {
            _processInfo = processInfo ?? throw new ArgumentNullException(nameof(processInfo));
            _minLinesPerFile = minLinesPerFile;
        }

        public async Task ProcessLineAsync(string line)
        {
            EnsureWriterInitialized();
            
            await _outputFileWriter!.WriteLineAsync(line);
            _processInfo.LineNumber += 1;
            _currentOutputLineCount += 1;

            if (ShouldRotateFile())
            {
                await RotateFileAsync();
            }
        }

        public async Task CompleteProcessingAsync()
        {
            if (_outputFileWriter is not null)
            {
                await _outputFileWriter.FlushAsync();
                await DisposeWriterAsync();
            }
        }

        public async ValueTask DisposeAsync()
        {
            await DisposeWriterAsync();
        }

        private void EnsureWriterInitialized()
        {
            if (_outputFileWriter is null)
            {
                var newFilename = _processInfo.GetNewFilename();
                _outputFileStream = new FileStream(newFilename, FileMode.Create, FileAccess.Write, FileShare.None);
                _outputFileWriter = new StreamWriter(_outputFileStream);
                
                // Write CSV header if it exists
                if (!string.IsNullOrEmpty(_processInfo.CsvHeaderLine))
                {
                    _outputFileWriter.WriteLine(_processInfo.CsvHeaderLine);
                }
            }
        }

        private bool ShouldRotateFile()
        {
            var linesPerFile = Math.Max(_processInfo.SplitLinesPerFile, _minLinesPerFile);
            return _currentOutputLineCount >= linesPerFile;
        }

        private async Task RotateFileAsync()
        {
            try
            {
                await _outputFileWriter!.FlushAsync();
                await DisposeWriterAsync();
                _currentOutputLineCount = 0;
            }
            catch (Exception ex)
            {
                _processInfo.ErrorList.Add($"Error rotating file: {ex.Message}");
            }
        }

        private async Task DisposeWriterAsync()
        {
            if (_outputFileWriter is not null)
            {
                await _outputFileWriter.DisposeAsync();
                _outputFileWriter = null;
            }

            if (_outputFileStream is not null)
            {
                await _outputFileStream.DisposeAsync();
                _outputFileStream = null;
            }
        }
    }
}
