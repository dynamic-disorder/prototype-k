<#
.SYNOPSIS
    Repository and environment locations, resolved at runtime — nothing machine-specific.

.DESCRIPTION
    The repository root is derived from this file's own location, so scripts work from any working
    directory on any machine instead of hard-coding a path like D:\code\... or C:\Users\...

    Dot-source it and use the variables:

        . .\local_dev\scripts\repo-env.ps1
        dotnet build "$RepoRoot\CsvTranslations\CsvTranslations.sln"
        if (-not $HasPwsh) { Write-Host 'pwsh is unavailable here' }

    Or run it directly for a summary or machine-readable output:

        .\local_dev\scripts\repo-env.ps1
        .\local_dev\scripts\repo-env.ps1 -Json

    Written for both Windows PowerShell 5.1 and PowerShell 7+.
#>
[CmdletBinding()]
param(
    [switch]$Json
)

# ---------------------------------------------------------------- repository
$RepoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$RepoName = Split-Path -Leaf $RepoRoot

# --------------------------------------------------------------- environment
if ($PSVersionTable.PSEdition -eq 'Desktop') {
    $HostOS = 'windows'
} elseif ($IsWindows) {
    $HostOS = 'windows'
} elseif ($IsMacOS) {
    $HostOS = 'macos'
} elseif ($IsLinux) {
    $HostOS = 'linux'
} else {
    $HostOS = 'unknown'
}
$IsWindowsHost = ($HostOS -eq 'windows')

$LocalDev = Join-Path $RepoRoot 'local_dev'
$LocalUserFiles = Join-Path $RepoRoot 'local_user_files'

$dotnetCommand = Get-Command dotnet -ErrorAction SilentlyContinue
if ($dotnetCommand) { $Dotnet = $dotnetCommand.Source } else { $Dotnet = '' }

$HasNode = [bool](Get-Command node -ErrorAction SilentlyContinue)
$HasPwsh = [bool](Get-Command pwsh -ErrorAction SilentlyContinue)
$HasPython3 = [bool](Get-Command python3 -ErrorAction SilentlyContinue)
$HasJq = [bool](Get-Command jq -ErrorAction SilentlyContinue)

# -------------------------------------------------------- project locations
# Discovered, not listed: every solution in the repo, repo-relative with forward slashes.
$Solutions = @(
    Get-ChildItem -LiteralPath $RepoRoot -Recurse -Depth 1 -Filter '*.sln' -File -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notlike '*local_user_files*' } |
        Sort-Object FullName |
        ForEach-Object { $_.FullName.Substring($RepoRoot.Length + 1).Replace('\', '/') }
)

# --------------------------------------------------------------- direct use
$dotSourced = ($MyInvocation.InvocationName -eq '.')

if (-not $dotSourced) {
    if ($Json) {
        [pscustomobject]@{
            repoRoot       = $RepoRoot
            repoName       = $RepoName
            hostOs         = $HostOS
            isWindows      = $IsWindowsHost
            localDev       = $LocalDev
            localUserFiles = $LocalUserFiles
            dotnet         = $Dotnet
            has            = [pscustomobject]@{
                node    = $HasNode
                pwsh    = $HasPwsh
                python3 = $HasPython3
                jq      = $HasJq
            }
            solutions      = $Solutions
        } | ConvertTo-Json -Depth 4
    } else {
        $toolSummary = 'node={0} pwsh={1} python3={2} jq={3}' -f ([int]$HasNode), ([int]$HasPwsh), ([int]$HasPython3), ([int]$HasJq)
        "repository : $RepoRoot"
        "name       : $RepoName"
        "host OS    : $HostOS"
        "local_dev  : $LocalDev"
        "scratch    : $LocalUserFiles"
        "dotnet     : $(if ($Dotnet) { $Dotnet } else { '(not found)' })"
        "tools      : $toolSummary"
        "solutions  :"
        $Solutions | ForEach-Object { "  $_" }
    }
}
