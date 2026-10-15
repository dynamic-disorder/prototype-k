<#
.SYNOPSIS
Check for a .NET 10 runtime and install it if missing.

.DESCRIPTION
This lightweight bootstrap detects whether the .NET 10 runtime is installed.
If it is not, the script will attempt a semi-automatic installation using the dotnet-install script.

.NOTES
This script does not require elevated privileges when using the user-local installer.
#>
[CmdletBinding()]
param(
    [string]$Channel = '10.0',
    [string]$InstallDir = "$env:LOCALAPPDATA\Microsoft\dotnet"
)

function Test-DotNet10Runtime {
    $runtimeList = & dotnet --list-runtimes 2>$null
    if ($LASTEXITCODE -ne 0) { return $false }
    return $runtimeList -match 'Microsoft\.NETCore\.App\s+10\.0'
}

if (Test-DotNet10Runtime) {
    Write-Host ".NET 10 runtime is already installed." -ForegroundColor Green
    exit 0
}

Write-Host ".NET 10 runtime not found. Installing user-local .NET 10 runtime..." -ForegroundColor Yellow

$installScript = Join-Path $env:TEMP 'dotnet-install.ps1'
Invoke-WebRequest -UseBasicParsing -Uri 'https://dot.net/v1/dotnet-install.ps1' -OutFile $installScript

& pwsh -NoProfile -ExecutionPolicy Bypass -File $installScript -Channel $Channel -Runtime dotnet -InstallDir $InstallDir
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Runtime install failed.' -ForegroundColor Red
    exit $LASTEXITCODE
}

$dotnetPath = Join-Path $InstallDir 'dotnet.exe'
Write-Host "Installation complete. Add $InstallDir to PATH or run using `$InstallDir\dotnet.exe`." -ForegroundColor Green
if (Test-Path $dotnetPath) {
    & $dotnetPath --list-runtimes
}
