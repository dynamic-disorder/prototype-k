<#
.SYNOPSIS
Publish .NET 9 apps as self-contained Windows executables for end-user distribution.

.DESCRIPTION
This script builds selected .NET 9 projects as self-contained win-x64 packages, so the end user does not need a local .NET 9 runtime.

.PARAMETER Project
One or more project names from the supported list. If omitted, all supported projects are published.

.PARAMETER Runtime
The target runtime identifier. Defaults to win-x64.

.PARAMETER Configuration
The build configuration. Defaults to Release.

.EXAMPLE
./publish-net9-selfcontained.ps1

.EXAMPLE
./publish-net9-selfcontained.ps1 -Project AddEntryApp,OllamaTranslatorApp
#>
[CmdletBinding()]
param(
    [string[]]$Project = @(),
    [string]$Runtime = 'win-x64',
    [string]$Configuration = 'Release'
)

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptRoot '.')
Set-Location $repoRoot

$projects = @{
    AddEntryApp        = 'CsvTranslations/AddEntryApp/AddEntryApp.csproj'
    OllamaTranslatorApp = 'CsvTranslations/OllamaTranslatorApp/OllamaTranslatorApp.csproj'
    TextFileSplitterApp = 'CsvTranslations/TextFileSplitterApp/TextFileSplitterApp.csproj'
    TextToSpeechApp    = 'CsvTranslations/TextToSpeechApp/TextToSpeechApp.csproj'
}

if ($Project.Count -eq 0) {
    $projectKeys = $projects.Keys
} else {
    $projectKeys = @()
    foreach ($name in $Project) {
        if (-not $projects.ContainsKey($name)) {
            Write-Host "Unknown project name: $name" -ForegroundColor Yellow
            Write-Host "Supported projects: $($projects.Keys -join ', ')"
            exit 1
        }
        $projectKeys += $name
    }
}

Write-Host "Publishing self-contained .NET 9 apps" -ForegroundColor Cyan
Write-Host "Runtime: $Runtime" -ForegroundColor Gray
Write-Host "Configuration: $Configuration`n" -ForegroundColor Gray

foreach ($projectKey in $projectKeys) {
    $csprojRelative = $projects[$projectKey]
    $csprojPath = Join-Path $repoRoot $csprojRelative

    if (-not (Test-Path $csprojPath)) {
        Write-Host "Project file not found: $csprojPath" -ForegroundColor Red
        exit 1
    }

    $publishDir = Join-Path $repoRoot "publish/$projectKey/$Runtime/$Configuration"
    New-Item -ItemType Directory -Path $publishDir -Force | Out-Null

    Write-Host "Publishing $projectKey..." -ForegroundColor Green
    dotnet publish $csprojPath \
        -c $Configuration \
        -r $Runtime \
        --self-contained true \
        /p:PublishSingleFile=true \
        /p:PublishTrimmed=true \
        /p:PublishReadyToRun=false \
        /p:IncludeAllContentForSelfExtract=true \
        -o $publishDir

    if ($LASTEXITCODE -ne 0) {
        Write-Host "Publish failed for $projectKey." -ForegroundColor Red
        exit $LASTEXITCODE
    }

    Write-Host "Published $projectKey -> $publishDir" -ForegroundColor Cyan
    Write-Host ""
}

Write-Host "Publish complete. Review the generated bundles under publish/" -ForegroundColor Green
