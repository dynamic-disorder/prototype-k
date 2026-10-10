<#
.SYNOPSIS
Check for a .NET 9 runtime and install it if missing.

.DESCRIPTION
This lightweight bootstrap detects whether the .NET 9 runtime is installed.
If it is not, the script will attempt a semi-automatic installation using the dotnet-install script.

.NOTES
This script does not require elevated privileges when using the user-local installer.
#>
[CmdletBinding()]
param(
    [string]$Channel = '9.0',
    [string]$InstallDir = "$env:LOCALAPPDATA\Microsoft\dotnet"
)

function Test-DotNet9Runtime {
    $runtimeList = & dotnet --list-runtimes 2>$null
    if ($LASTEXITCODE -ne 0) { return $false }
    return $runtimeList -match 'Microsoft\.NETCore\.App\s+9\.0'
}

if (Test-DotNet9Runtime) {
    Write-Host ".NET 9 runtime is already installed." -ForegroundColor Green
    exit 0
}

Write-Host ".NET 9 runtime not found. Installing user-local .NET 9 runtime..." -ForegroundColor Yellow

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
