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
| **Need** | The style rule was installed into Windows harness configs only. Omarchy (Arch) is the primary machine, so the rule had to exist there too — and two hand-copied files drift apart within weeks. |
| **Why** | One source of truth, one command per machine, and a `--check` mode that detects drift. Re-running after an edit updates the block in place without touching your own global instructions. |
| **What** | Added `install.sh` — bash everywhere, Git Bash on Windows — with a managed-block scheme that is idempotent and non-destructive. |
| **DoD** | Bash installer tested in WSL across 6 scenarios — fresh install, idempotent re-run, content preserved, in-place update, drift detected (exit 1), drift cleared (exit 0). Git Bash on Windows clears the same `--check`. |
| **Top risk** | Only the Windows profile is verified. WSL and Omarchy each have their own `$HOME`, so their copy of the block stays unverified until `install.sh --check` runs there. |

---

## The document flow — Need → Why → What → DoD

Documents used to flow Problem → Value → Change → Verify. They now open with the reader's **need** — the gap,
plus only the background needed to judge it — then **why** it is worth solving, then the bounded **what** with
its core and its exclusions, then a **DoD** in which every check traces to a line of the why. When the what is
large it becomes baby steps, each shipped with its own DoD before the next is scoped. A status update adds what
happens next and who acts.

The five row labels follow the context while the five slots stay put: slot 1 is *Need* by default and becomes
*Issue*, *Background*, *Details* or *Feature* as the document demands; slot 4 is *DoD* and becomes *Acceptance
criteria*, *Verification* or *Proof*. Every change statement closes with a **documentation line** — what was
written or updated and where, or that none was needed and why.

Where a document lives decides who may read it:

| Tier | Paths | May contain |
| :--- | :--- | :--- |
| Public | `docs/` — architecture documentation, development docs, and manuals when they exist — plus `README.md`, `CLAUDE.md` and commit bodies | nothing machine-specific, no identity string |
| Developer wiki | `local_dev/` | working plans, walkthroughs, per-phase notes |
| Private scratch | `local_user_files/` — git-ignored except its README | whatever is not for the internet, but no secrets: it is on disk and in every backup |

---

## Getting it picked up on both machines

Windows, Omarchy, Git Bash and WSL each have their own home directory, so the block is installed **per
machine**, and the installer is itself the copy step: it writes only inside the profile
(`%USERPROFILE%\.dsh\AGENTS.md`, `%USERPROFILE%\.claude\CLAUDE.md`, and the Cline/Continue rule files) and never
into a system path. No sudo, no machine-wide state, nothing to undo outside your own home directory.

Run in Git Bash, from this folder (Windows):

```bash
./install.sh --check     # exit 1 = this profile is uninstalled or stale
./install.sh             # install or update in place
./install.sh --check     # expect exit 0
```

Run in Bash, from this folder (Omarchy / Linux — and Git Bash on Windows, which shares the Windows profile):

```bash
./install.sh --check     # exit 1 = uninstalled or stale; then ./install.sh and re-check
```

**After any edit to `managed-block.md`, re-run on every machine.** `--check` exits 1 there until it does: that is
the drift detector working, not a fault. The checkout sits on a data disk both machines mount, so Omarchy runs
the installer from the same working tree through its own mount of it — nothing is copied to that machine. What
stays per machine is the user-global instruction file the installer writes, because `$HOME` is per machine.

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
| Git Bash (Windows, MSYS) | `~` — the same Windows profile, reached through an MSYS mount | run `./install.sh` from this folder |
| WSL (Ubuntu) | `~` — the WSL user's own home | run `./install.sh` from this folder |

Each shell reaches these files through a different mount of the same disk, and no path is written
down here: that is exactly the class of detail a public repository must not carry. Because Git Bash
shares the Windows profile, `./install.sh` there writes the **same three Windows targets** directly:
the one installer serves both machines. WSL's home is a different profile, so a run there installs
for that user only.

Run in Git Bash, from this folder:

```bash
./install.sh --check      # exit 1 = that profile is uninstalled or stale
./install.sh              # install or update in place
./install.sh --check      # expect exit 0
```

Then restart each harness: they read these files at session start.

### On the Omarchy machine

The two machines boot from separate system disks: this repository is on a data disk that both mount, so
it is the same files, but each machine keeps its own home directory — and the Windows side cannot read the
LUKS-encrypted one. That is why the installer, not a copy of the repository, is the step that repeats. Run
it once per machine, from the checkout as that machine reaches it:

```bash
./install.sh --check      # exit 1 = uninstalled or stale on this machine; then ./install.sh and re-check
```

The mount root differs per machine and is deliberately not written down here. It is in the private machine
notes (`local_user_files/omarchy-mount-notes.md`), which are git-ignored for exactly this reason.

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

On Windows, the same three commands run in Git Bash; its `$HOME` is the Windows profile, so they write
the Windows targets.

`--check` is the drift detector. A sensible habit is to run it in your shell profile or a
weekly timer, so a harness config that gets reset by an update shows up as a failure rather than
being silently lost.

## Changing the rules

1. Edit `documentation-style.md` (the human-readable rules) and `managed-block.md` (the exact text
   injected into configs — keep it terse; it is loaded on every session).
2. Re-run the installer on each machine.
3. Restart each harness. Claude Code and DSH read these files at session start, so a running session
   will not pick up the change.

`install.sh` keeps the marker scheme and the whole-file rule for Cline/Continue on purpose — they are
what make a re-run idempotent and non-destructive. Change them only together with the README table, and
re-test on Git Bash as well as on Linux.

## Notes

- **Encoding is part of the contract.** `managed-block.md` is UTF-8 without a BOM, and the installer is
  byte-safe in bash — `cat` in, `printf` out. One bug made that explicit on 2026-10-31: gawk's `-v` ate the
  backslash in `%USERPROFILE%\…`. If a target ever renders `â€”` or loses a backslash, it is this class of
  bug rather than a style change.
- **Shell preference:** `bash` on Linux and Omarchy; Git Bash on Windows for this folder, because
  PowerShell's execution policy blocks scripts and every example then costs an `-ExecutionPolicy Bypass`.
  There is one installer, and it is bash.
- The script is LF-only, which matters because this file family mandates LF everywhere.
- Nothing is installed outside `$HOME` / `%USERPROFILE%`; no sudo, no system paths.
- The block is intentionally short. It is injected into every session's context, so length is a
  recurring cost, not a one-off. Detail belongs in `documentation-style.md`, which is read on demand.
