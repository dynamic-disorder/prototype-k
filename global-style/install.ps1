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

# ---- encoding ------------------------------------------------------------------------------
# Read and write UTF-8 explicitly. Windows PowerShell 5.1 defaults Get-Content and Set-Content to
# the ANSI code page, so a BOM-less UTF-8 source double-encodes every em dash, arrow and ≤ sign
# into mojibake in the targets — it did exactly that on 2026-10-31. The bash sibling is byte-safe
# (cat in, printf out), so doing this explicitly keeps the two behaviourally identical: UTF-8 in,
# UTF-8 out, and no BOM added that bash would not have written.
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Read-Utf8 {
    param([string]$Path)
    [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
}

function Write-Utf8NoBom {
    param([string]$Path, [string]$Text)
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Path) | Out-Null
    [System.IO.File]::WriteAllText($Path, $Text, $Utf8NoBom)
}

if (-not (Test-Path -LiteralPath $Block)) { throw "missing $Block" }
$blockText = (Read-Utf8 -Path $Block).TrimEnd()

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
        $current = if (Test-Path -LiteralPath $TargetPath) { (Read-Utf8 -Path $TargetPath) } else { $null }
        if ($current -and $current.TrimEnd() -eq $blockText) { return @{ State='up-to-date' } }
        if ($Check)   { return @{ State='out-of-date' } }
        if ($DryRun)  { return @{ State='would-write' } }
        Write-Utf8NoBom -Path $TargetPath -Text ($blockText + "`n")
        return @{ State='wrote' }
    }

    $current = if (Test-Path -LiteralPath $TargetPath) { (Read-Utf8 -Path $TargetPath) } else { '' }
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
        Write-Utf8NoBom -Path $TargetPath -Text $updated
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
    Write-Utf8NoBom -Path $TargetPath -Text $updated
    return @{ State='appended' }
}

# ---- The guardrail that ships with every install -------------------------------------------
# The credential file is deliberately not a target: it is never read, never merged, never copied.
# The rule travels with the installer so a new machine cannot learn it late. The injected text is
# not a managed block, because it is appended before the run below; keep a re-run from duplicating
# it by checking for the section title first.
$guardrail = @'
### Credentials: never read the credential file

Binding, learned on 2026-11-01 the hard way: a session that checked "can two machines share `$DSH_HOME`?"
opened the credentials document to judge the risk, and printed live API keys into the transcript.

- **Never read, cat, print, grep for values in, hash, or copy the credential file** — on Windows
  `%USERPROFILE%\.dsh\.credentials.yaml`, on Linux and macOS `~/.dsh/.credentials.yaml`. The rule covers any
  file holding a secret; these two are the ones that exist. `Test-Path` (existence only) is fine.
- **Why it matters more than it looks:** shell and file tools run as the same user, so nothing blocks the
  read; the harness only keeps the path out of the model's hands, and a model that goes looking finds it.
  A read costs a rotation at the provider, not just an apology.
- **Do the job another way.** To learn which providers exist, read the non-secret `settings.yaml`
  (`apiKeyEnv`, provider ids, model ids). To change a credential, tell the owner which one and let them run
  the harness's own credential command. Never echo a secret, not even a fragment, and never re-print a
  match while scanning for one — report match counts and file lists only.
- If it is already exposed: say so flat, name the file and every place the text landed (tool output,
  session log), and ask the owner to revoke and reissue the key. Do not leave it to be discovered.

### Your own notes are not the credential store

- This file may name where a credential lives and how to change it, and nothing else. Never paste a key, a
  token or a password into these notes, a doc, a commit or a chat message — not even one the owner pasted
  first.
'@
$guardrailTitle = '### Credentials: never read the credential file'

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
    # The credential guardrail rides in the AGENTS.md target, appended once and only when missing.
    if ($t.Harness -eq 'dsh' -and -not $Check -and -not $DryRun) {
        $current = if (Test-Path -LiteralPath $t.Path) { Read-Utf8 -Path $t.Path } else { '' }
        if (-not $current.Contains($guardrailTitle)) {
            Write-Utf8NoBom -Path $t.Path -Text ($current.TrimEnd() + "`n`n" + ($guardrail.TrimEnd()) + "`n")
            Write-Host ("  {0,-13} {1}" -f 'guardrail', $t.Path)
        }
    }
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
