# global-style — one writing style across every harness and every machine

Installs the writing rules into each AI harness's **user-global** config, so they apply to every project
without anyone remembering to ask. One voice, three modes: a direct answer stays signal-only and budgeted,
a document opens with an executive summary, a message uses the simplest register and puts the ask first.

Canonical rules: `documentation-style.md`. Injected text: `managed-block.md`. Edit one of those two,
then re-run the installer on each machine.

---

## Executive summary

| | |
| :--- | :--- |
| **Problem** | The style rule was installed into Windows harness configs only. Omarchy (Arch) is the primary machine, so the rule had to exist there too — and two hand-copied files drift apart within weeks. |
| **Value** | One source of truth, one command per machine, and a `--check` mode that detects drift. Re-running after an edit updates the block in place without touching your own global instructions. |
| **Change** | Added `install.sh` (Arch/Ubuntu/macOS) and `install.ps1` (Windows) with an identical managed-block scheme. Both are idempotent and non-destructive. |
| **Verify** | Bash installer tested in WSL across 6 scenarios — fresh install, idempotent re-run, content preserved, in-place update, drift detected (exit 1), drift cleared (exit 0). Windows `-Check` returns 0. |
| **Top risk** | Only the Windows profile is verified. WSL and Omarchy each have their own `$HOME`, so their copy of the block stays unverified until `install.sh --check` runs there. |

---

## What it writes

Every target receives **one** block delimited by

```
<!-- BEGIN managed: documentation-style -->
<!-- END managed: documentation-style -->
```

Everything outside those markers is untouched, so your own global instructions survive. Rule-directory
harnesses (Cline, Continue) get the file verbatim instead, since the file itself is the rule.

| Harness | Linux / macOS (Omarchy) | Windows |
| :--- | :--- | :--- |
| DeepSeek Harness | `$DSH_HOME/AGENTS.md` → `~/.dsh/AGENTS.md` | `%USERPROFILE%\.dsh\AGENTS.md` |
| Claude Code | `~/.claude/CLAUDE.md` | `%USERPROFILE%\.claude\CLAUDE.md` |
| Cline | `~/Documents/Cline/Rules/documentation-style.md` | `%USERPROFILE%\Documents\Cline\Rules\documentation-style.md` |
| Continue | `~/.continue/rules/documentation-style.md` (if installed) | same shape under `%USERPROFILE%` |

The scripts probe for an existing directory first (e.g. `~/Cline/Rules`, `~/.cline/rules`) and only
fall back to the documented default, so an established setup is detected rather than a parallel one
created. If a path is wrong for your Cline build, fix the candidate list at the top of each script.

---

## Running it from another shell

The folder is one set of files seen through three shells — nothing is copied:

| Shell | `$HOME` for this run | Notes |
| :--- | :--- | :--- |
| PowerShell (Windows) | `%USERPROFILE%` | run `.\install.ps1` from this folder |
| Git Bash (Windows, MSYS) | `~` — the same Windows profile, reached through an MSYS mount | run `./install.sh` from this folder |
| WSL (Ubuntu) | `~` — the WSL user's own home | run `./install.sh` from this folder |

Each shell reaches these files through a different mount of the same disk, and no path is written
down here: that is exactly the class of detail a public repository must not carry. Because Git Bash
shares the Windows profile, `./install.sh` there writes the **same three targets** `install.ps1`
writes — the way to exercise the bash installer against real files without a Linux box. WSL's home
is a different profile, so a run there installs for that user only.

Run in Git Bash, from this folder:

```bash
./install.sh --check      # exit 1 = that profile is uninstalled or stale
./install.sh              # install or update in place
./install.sh --check      # expect exit 0
```

Then restart each harness: they read these files at session start.

### On the Omarchy machine

The Omarchy install is a **separate disk** (LUKS), and whether it can see this folder is not
established here — do not assume either way. Since harness globals live in each machine's `$HOME`,
the installer runs once per machine from wherever that copy is:

Run in Bash on that machine, from its copy of this folder:

```bash
./install.sh --check      # exit 1 = uninstalled or stale; then ./install.sh and re-check
```

If the folder is not there, the repository carries it:

```bash
git clone https://github.com/dynamic-disorder/prototype-k.git ~/prototype-k
cd ~/prototype-k/global-style && ./install.sh --check
```

### The ownership mismatch this folder already carries

Four repositories here are owned by `BUILTIN\Administrators` rather than the Windows user, which makes
`git` refuse to run in them with `fatal: detected dubious ownership` — on 2026-10-29 that covered
`cliutils`, `filenametools`, `mediarenamer` and `ai-offline`. The fix is per clone, on the machine
that complains:

Run in PowerShell, in the repository root:

```powershell
git config --global --add safe.directory (Get-Location).Path
```

---

## Usage

```bash
./install.sh              # install or update every detected harness
./install.sh --dry-run    # show what would change, write nothing
./install.sh --check      # exit 1 if any target is missing or stale
./install.sh --help
```

Windows:

```powershell
.\install.ps1
.\install.ps1 -DryRun
.\install.ps1 -Check
```

`--check` / `-Check` is the drift detector. A sensible habit is to run it in your shell profile or a
weekly timer, so a harness config that gets reset by an update shows up as a failure rather than
being silently lost.

## Changing the rules

1. Edit `documentation-style.md` (the human-readable rules) and `managed-block.md` (the exact text
   injected into configs — keep it terse; it is loaded on every session).
2. Re-run the installer on each machine.
3. Restart each harness. Claude Code and DSH read these files at session start, so a running session
   will not pick up the change.

`install.sh` and `install.ps1` must stay behaviourally identical — same markers, same whole-file rule
for Cline/Continue, same idempotency. If you change one, change the other and re-run both test paths.

## Notes

- Both scripts are LF-only, which matters because this file family mandates LF everywhere.
- Nothing is installed outside `$HOME` / `%USERPROFILE%`; no sudo, no system paths.
- The block is intentionally short. It is injected into every session's context, so length is a
  recurring cost, not a one-off. Detail belongs in `documentation-style.md`, which is read on demand.
