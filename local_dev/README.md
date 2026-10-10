This folder contains local development tools and helpers for this repository. It is not intended for production use or to be included in the main application. 
Use it for scripts, utilities, or documentation that assist with local setup, testing, or development tasks.

## Organization Guidelines

- **Plans & Documentation**: Store development plans, architectural documents, and implementation guides in the `plans/` subdirectory.
- **Analyses**: Store code analysis, performance evaluations, and technical assessments in the `analyses/` subdirectory.
- **Sensitive or Raw Ideas**: For sensitive data, personal notes, or very raw brainstorming ideas, use the `local_user_files/` directory at the repository root instead.
- **External References**: For CLI library recommendations, tool comparisons, and external resource documentation, store in the root of `local_dev/`.
- **Development Scripts**: Store Python, PowerShell, or shell scripts for local development tasks in the `scripts/` subdirectory of `local_dev/`.

Do not include secrets, credentials, or external network calls in this folder.

## Available Development Scripts

### Repository & Environment Locations (`repo-env.sh`, `repo-env.ps1`, `repo_paths.py`)

Nothing in this repository should hard-code a machine path. These resolve the repository root from
their **own** location and report the environment, so scripts work from any working directory on any
machine.

```bash
source local_dev/scripts/repo-env.sh      # REPO_ROOT, HOST_OS, DOTNET, HAS_NODE, SOLUTIONS, …
./local_dev/scripts/repo-env.sh           # human-readable summary
./local_dev/scripts/repo-env.sh --json    # machine-readable
```

```powershell
. .\local_dev\scripts\repo-env.ps1        # $RepoRoot, $HostOS, $Dotnet, $HasNode, $Solutions, …
.\local_dev\scripts\repo-env.ps1 -Json
```

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "local_dev" / "scripts"))
from repo_paths import repo_root, translations_csv, local_user_files, solution
```

Provided: `REPO_ROOT` / `$RepoRoot`, `REPO_NAME`, `HOST_OS` (linux/macos/windows), `IS_WINDOWS`,
`LOCAL_DEV`, `LOCAL_USER_FILES`, `DOTNET`, the capability flags `HAS_NODE`, `HAS_PWSH`,
`HAS_PYTHON3`, `HAS_JQ`, and `SOLUTIONS` — which is **discovered**, not a maintained list.

**Notes**:
- `build-all-linux.sh` sources `repo-env.sh`; use `repo-env.sh` from any new script rather than
  re-deriving the root.
- Node scripts resolve the root themselves via `import.meta.url`, so they need no shell.
- `repo-env.ps1` targets both Windows PowerShell 5.1 and PowerShell 7+.

### Cross-Platform Build & Test (`build-all-linux.sh`)

Builds every `.sln` in the repository on Linux/macOS and prints a per-solution summary.

```bash
./local_dev/scripts/build-all-linux.sh                 # Debug build, all solutions
./local_dev/scripts/build-all-linux.sh -c Release      # Release build
./local_dev/scripts/build-all-linux.sh --test          # build, then run tests
```

**Notes**:
- Windows-only targets (WPF, `net*-windows`) still compile — `EnableWindowsTargeting=true`
  is set in `Directory.Build.props`. They remain unrunnable on Linux.
- Every project targets `net10.0` and the .NET 10 runtime is installed, so the test
  hosts start directly — no `DOTNET_ROLL_FORWARD` fallback is needed.
- Covers solutions only. `CsvTranslations/OllamaTranslatorApp.Tests` and
  `CsvTranslations/TextToSpeechApp.Tests` are not part of any solution and must be
  built from their `.csproj` paths.

### AI Context Token Estimate (`ai-context-token-estimate.mjs`)

Estimates how much AI-context the committed instruction files cost (CLAUDE.md files, `.clinerules`, per-project `.claude/rules/`, Copilot instructions), at a rough ~4 characters per token.

```bash
node local_dev/scripts/ai-context-token-estimate.mjs
node local_dev/scripts/ai-context-token-estimate.mjs --json   # machine-readable
```

**Notes**:
- Dependency-free Node (built-ins only); no `npm install`.
- Node port of the former `ai_context_token_estimate.ps1`, which could not run on this box because `pwsh` is not installed.
- The git-ignored root `.claude/` tree is not counted: it now holds only skills, which load on demand rather than being injected at session start.

### VS Code Cache Cleaner (`vscode_cache_cleaner.py`)

A cross-platform Python script to clear Visual Studio Code cache folders without deleting settings or extensions.

**Purpose**: Cleans VS Code cache to resolve performance issues, free up disk space, or fix extension caching problems.

**Features**:
- Detects operating system (Windows, macOS, Linux)
- Closes VS Code if running (to avoid file lock conflicts)
- Removes cache-related folders (Cache, CachedData, Code Cache, GPUCache, logs, CachedExtensions)
- Preserves your settings, keybindings, and installed extensions

**Usage**:
```bash
cd local_dev/scripts
python vscode_cache_cleaner.py
```

**Notes**:
- Requires Python 3.6+ and appropriate permissions to delete system folders
- Does NOT delete your settings or installed extensions
- Restart VS Code after running to regenerate caches as needed

**Source**: Based on community recommendations for VS Code cache management.

## Analyses

- [`analyses/linux-build-audit.md`](analyses/linux-build-audit.md) — cross-platform build audit of every
  solution and project (2026-10-10): per-solution Debug/Release/test results, the case-sensitive
  `ProjectReference` and `EnableWindowsTargeting` failures, the `git core.ignorecase` rename trap,
  open issues, and a cross-platform checklist for future changes.
- [`analyses/tts_analysis.md`](analyses/tts_analysis.md) — text-to-speech implementation analysis.

## Documentation

- [`git-ignored-local-files.md`](git-ignored-local-files.md) — index of working-tree files excluded by
  `.gitignore` (root `.claude/`, `launchSettings.json`, `local_user_files/` tooling): what changed, what is
  tracked-but-ignored, and how to persist any of it with `git add -f`.
