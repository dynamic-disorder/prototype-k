# ai_context_token_estimate.ps1
# Estimates token usage of committed AI-context files (CLAUDE.md, rules, Copilot instructions).
# Rough rule: ~4 characters per token for English/markdown text.
# Hooks (.claude/hooks/*.sh) are NOT counted here because only their OUTPUT is injected at session start.

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

# Explicit relative paths (wildcards work correctly in -Path, not -Filter).
$patterns = @(
    'CLAUDE.md',
    'CliUtils/CLAUDE.md',
    'FileNameTools/CLAUDE.md',
    'FileNameTools/.claude/rules/*.md',
    'FileNameTools/.github/copilot-instructions.md',
    'CsvTranslations/CLAUDE.md',
    'CsvTranslations/.claude/rules/*.md',
    'CsvTranslations/.github/copilot-instructions.md',
    'MediaRenamer/CLAUDE.md',
    'ai_offline/CLAUDE.md',
    'ai_offline/ollama_with_open_webui/CLAUDE.md',
    '.clinerules',
    '.claude/rules/*.md',
    '.github/copilot-instructions.md',
    '.github/clean_code_general_instructions.md'
)

$files = @()
foreach ($p in $patterns) {
    $resolved = Join-Path $repoRoot $p
    $matches = Get-ChildItem -Path $resolved -File -ErrorAction SilentlyContinue
    if ($matches) {
        $files += $matches
    }
}

$totalChars = 0L
$totalTokens = 0L
$rows = @()

foreach ($f in ($files | Sort-Object FullName -Unique)) {
    $charCount = (Get-Content -Raw -Path $f.FullName).Length
    $estTokens = [math]::Round($charCount / 4)
    $totalChars += $charCount
    $totalTokens += $estTokens
    $rows += [PSCustomObject]@{
        File      = $f.FullName.Substring($repoRoot.Length + 1)
        Chars     = $charCount
        EstTokens = $estTokens
    }
}

$rows | Format-Table -AutoSize
Write-Host ("TOTAL: {0:N0} chars, ~{1:N0} estimated tokens" -f $totalChars, $totalTokens)