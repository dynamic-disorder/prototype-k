# global-style — one writing style across every harness and every machine

Installs the executive-first documentation rules into each AI harness's **user-global** config, so
they apply to every project without anyone remembering to ask.

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
| **Top risk** | Sharing the folder installs nothing: each machine has its own `$HOME`, so the Omarchy side stays unverified until `install.sh --check` runs there. |

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

## Running it on the Omarchy machine

**The files are already there.** The repositories sit on one disk that both machines mount — the `E:`
drive on Windows, a Linux mount point on Omarchy — so `global-style/` is a single copy, not two.
Nothing is transferred, copied or cloned between the machines, and there is no second version of the
rules to drift.

**What is not shared is the install target.** Each machine has its own `$HOME`, so the Omarchy side
carries its own `~/.dsh/AGENTS.md`, `~/.claude/CLAUDE.md` and Cline rules. Sharing the folder
installs nothing there; the installer still runs once per machine.

Run in Bash on the Omarchy machine, from the mounted copy — find the mount point first rather than
assuming one (`findmnt -o TARGET,SOURCE,FSTYPE` lists them):

```bash
cd <mount-point>/code/GitHub/My/prototype-k/global-style
./install.sh --check      # exit 1 = that machine is uninstalled or stale
./install.sh              # install or update in place
./install.sh --check      # expect exit 0
```

Then restart each harness: they read these files at session start.

Because the working tree is shared, a rule edited here is already visible there — no pull, no push,
no archive. Only the install step repeats, once per machine. That is what
`git log -- global-style` on either side answers: which version of the rules each machine is running.

### Two machines, one working tree — one caveat

`git` is safe from both sides, since a single working tree cannot diverge from itself. The mismatch is
in file ownership: a repository written by the Linux user appears on Windows owned by another account,
and Windows `git` then refuses to run in it, with `fatal: detected dubious ownership`. On 2026-10-29
that state covered `cliutils`, `filenametools`, `mediarenamer` and `ai-offline`. The fix is per clone,
on the machine that complains:

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
