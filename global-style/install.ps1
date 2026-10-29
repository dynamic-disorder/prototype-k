#Requires -Version 5.1
<#
.SYNOPSIS
    Installs the executive-first documentation style into every AI harness's user-global config.

.DESCRIPTION
    Idempotent and non-destructive. Upserts ONE managed block delimited by
        <!-- BEGIN managed: documentation-style --> ... <!-- END managed: documentation-style -->
    into each target file. Everything outside those markers is left exactly as it was, so existing
    global instructions are never overwritten. Re-run after editing managed-block.md to update the
    block in place.

    The bash sibling install.sh does the same job on Linux/macOS with the same marker scheme, so a
    machine can be set up from either OS and stay in sync.

.PARAMETER DryRun
    Show what would change, write nothing.

.PARAMETER Check
    Exit 1 if any target is missing or out of date. For scheduled drift detection.

.EXAMPLE
    .\install.ps1

.EXAMPLE
    .\install.ps1 -Check
#>
[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$Check
)

$ErrorActionPreference = 'Stop'
$Here  = $PSScriptRoot
$Block = Join-Path $Here 'managed-block.md'
$BeginMark = '<!-- BEGIN managed: documentation-style -->'
$EndMark   = '<!-- END managed: documentation-style -->'

if (-not (Test-Path -LiteralPath $Block)) { throw "missing $Block" }
$blockText = (Get-Content -LiteralPath $Block -Raw).TrimEnd()

# ---- target resolution -----------------------------------------------------
$targets = New-Object System.Collections.Generic.List[object]
$home_ = $env:USERPROFILE

# 1. DeepSeek Harness — always $DSH_HOME/AGENTS.md, $DSH_HOME defaults to ~/.dsh
$dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $home_ '.dsh' }
$targets.Add([pscustomobject]@{ Harness='dsh'; Path=(Join-Path $dshHome 'AGENTS.md'); Mode='inline' })

# 2. Claude Code — user-global memory file
$targets.Add([pscustomobject]@{ Harness='claude-code'; Path=(Join-Path $home_ '.claude\CLAUDE.md'); Mode='inline' })

# 3. Cline — global rules directory; prefer one that already exists
$clineCandidates = @(
    (Join-Path $home_ 'Documents\Cline\Rules'),
    (Join-Path $home_ 'Cline\Rules'),
    (Join-Path $home_ '.cline\rules')
)
$clineDir = $clineCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $clineDir) { $clineDir = $clineCandidates[0] }
$targets.Add([pscustomobject]@{ Harness='cline'; Path=(Join-Path $clineDir 'documentation-style.md'); Mode='whole-file' })

# 4. Continue — global rules, only if the tool is actually installed
foreach ($c in @((Join-Path $home_ '.continue\rules'), (Join-Path $home_ '.continue'))) {
    if (Test-Path -LiteralPath $c) {
        $targets.Add([pscustomobject]@{ Harness='continue'; Path=(Join-Path (Join-Path $c 'rules') 'documentation-style.md'); Mode='whole-file' })
        break
    }
}

# ---- helpers ---------------------------------------------------------------
function Set-ManagedBlock {
    param([string]$TargetPath, [string]$Mode)

    if ($Mode -eq 'whole-file') {
        $current = if (Test-Path -LiteralPath $TargetPath) { (Get-Content -LiteralPath $TargetPath -Raw) } else { $null }
        if ($current -and $current.TrimEnd() -eq $blockText) { return @{ State='up-to-date' } }
        if ($Check)   { return @{ State='out-of-date' } }
        if ($DryRun)  { return @{ State='would-write' } }
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $TargetPath) | Out-Null
        Set-Content -LiteralPath $TargetPath -Value ($blockText + "`n") -Encoding UTF8 -NoNewline
        return @{ State='wrote' }
    }

    $current = if (Test-Path -LiteralPath $TargetPath) { (Get-Content -LiteralPath $TargetPath -Raw) } else { '' }
    $hasMarkers = $current.Contains($BeginMark)

    if ($hasMarkers) {
        $start = $current.IndexOf($BeginMark)
        $endIdx = $current.IndexOf($EndMark, $start)
        $after = if ($endIdx -ge 0) { $current.Substring($endIdx + $EndMark.Length) } else { '' }
        $before = $current.Substring(0, $start)
        $updated = ($before + $blockText + $after).TrimEnd() + "`n"
        if ($updated -eq $current) { return @{ State='up-to-date' } }
        if ($Check)  { return @{ State='out-of-date' } }
        if ($DryRun) { return @{ State='would-update' } }
        Set-Content -LiteralPath $TargetPath -Value $updated -Encoding UTF8 -NoNewline
        return @{ State='updated' }
    }

    # No block yet — append it, preserving everything already in the file.
    $updated = if ([string]::IsNullOrWhiteSpace($current)) {
        $blockText + "`n"
    } else {
        $current.TrimEnd() + "`n`n" + $blockText + "`n"
    }
    if ($Check)  { return @{ State='out-of-date' } }
    if ($DryRun) { return @{ State='would-append' } }
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $TargetPath) | Out-Null
    Set-Content -LiteralPath $TargetPath -Value $updated -Encoding UTF8 -NoNewline
    return @{ State='appended' }
}

# ---- run -------------------------------------------------------------------
Write-Host 'documentation-style installer'
Write-Host ("  source : {0}" -f $Block)
Write-Host ("  home   : {0}" -f $home_)
Write-Host ''

$failed = $false
foreach ($t in $targets) {
    Write-Host ("[{0}]" -f $t.Harness)
    $r = Set-ManagedBlock -TargetPath $t.Path -Mode $t.Mode
    if ($r.State -eq 'out-of-date') { $failed = $true }
    Write-Host ("  {0,-13} {1}" -f $r.State, $t.Path)
}

Write-Host ''
if ($Check) {
    if ($failed) { Write-Host 'Some targets are stale — run .\install.ps1' -ForegroundColor Yellow; exit 1 }
    Write-Host 'All targets up to date.' -ForegroundColor Green
    exit 0
}
if ($DryRun) {
    Write-Host 'Dry run — nothing written.'
} else {
    Write-Host 'Done. Restart each harness to pick up the change.' -ForegroundColor Green
    Write-Host 'Verify: .\install.ps1 -Check'
    Write-Host ''
    Write-Host 'On Omarchy / Linux, run the bash sibling instead:' -ForegroundColor Cyan
    Write-Host '  ./global-style/install.sh --check'
    Write-Host '  ./global-style/install.sh'
}
