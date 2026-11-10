param(
    [Parameter(Mandatory = $true)][string]$InputPath,
    [Parameter(Mandatory = $true)][string]$AssetsDir,
    [int]$Dpi = 150,
    [string]$Prefix = "page"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null

$extensionMethods = [System.WindowsRuntimeSystemExtensions].GetMethods()
$asTaskOperation = ($extensionMethods | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]
$asTaskAction = ($extensionMethods | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction'
})[0]

function Await-Operation($operation, $resultType) {
    $task = $asTaskOperation.MakeGenericMethod($resultType).Invoke($null, @($operation))
    $task.Wait(-1) | Out-Null
    return $task.Result
}

function Await-Action($action) {
    $task = $asTaskAction.Invoke($null, @($action))
    $task.Wait(-1) | Out-Null
}

[Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Pdf.PdfPageRenderOptions, Windows.Data.Pdf, ContentType = WindowsRuntime] | Out-Null

New-Item -ItemType Directory -Force -Path $AssetsDir | Out-Null

$file = Await-Operation ([Windows.Storage.StorageFile]::GetFileFromPathAsync($InputPath)) ([Windows.Storage.StorageFile])
$document = Await-Operation ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) ([Windows.Data.Pdf.PdfDocument])

for ($index = 0; $index -lt $document.PageCount; $index++) {
    $page = $document.GetPage($index)
    $options = New-Object Windows.Data.Pdf.PdfPageRenderOptions
    $options.DestinationWidth = [uint32][math]::Round(($page.Size.Width / 72.0) * $Dpi)

    $stream = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
    Await-Action ($page.RenderToStreamAsync($stream, $options))

    $target = Join-Path $AssetsDir ("{0}-{1}.png" -f $Prefix, ($index + 1))
    $readStream = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream)
    $writeStream = [System.IO.File]::Create($target)
    $readStream.CopyTo($writeStream)
    $writeStream.Dispose()
    $readStream.Dispose()
    $stream.Dispose()

    Write-Output "page $($index + 1): $target"
}

Write-Output "rendered $($document.PageCount) page(s) at $Dpi dpi"
$document = $null
