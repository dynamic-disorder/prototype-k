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
| **Top risk** | The Omarchy disk is a separate LUKS volume this machine cannot reach, so the copy is manual. Nothing here can verify the Linux side until you run `--check` there. |

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

## Getting it onto the Omarchy machine

The Omarchy install is on a separate LUKS-encrypted SSD that is not reachable from this Windows
machine, so there is no direct copy. Any of these work; pick whichever the two machines share.

**A. USB stick** (works even with no network between them)

```bash
# 1. on Windows — copy the folder to the stick (run from the repository root)
#    robocopy "global-style" "X:\global-style" /E

# 2. on Omarchy, after unlocking the LUKS volume and mounting it
cp -r /run/media/$USER/<stick>/global-style ~/global-style
cd ~/global-style && ./install.sh
```

**B. over the network** (if both are on the same LAN)

```bash
# on Windows (PowerShell, in the repository root)
tar -czf global-style.tgz global-style
# serve it however you prefer, then on Omarchy:
scp you@windows-box:/path/global-style.tgz . && tar -xzf global-style.tgz
cd global-style && chmod +x install.sh && ./install.sh
```

**C. via git** (the default: this folder is tracked in the umbrella repository `prototype-k`)

`global-style/` lives in [`prototype-k`](https://github.com/dynamic-disorder/prototype-k), so on Omarchy:

```bash
git clone https://github.com/dynamic-disorder/prototype-k.git ~/prototype-k
cd ~/prototype-k/global-style && ./install.sh
```

That turns "which version of the rules is this machine running?" into `git log -- global-style`, and
`install.sh --check` into a drift alarm you can run from a shell profile.

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
