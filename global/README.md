# global — the shared agent rules, installed per machine

Installs the cross-project rules into `$DSH_AGENTS_HOME/AGENTS.md` (default `~/.agents/AGENTS.md`)
as one managed block. The checkout is shared between machines; `$HOME` is not, so the installer is
the step that repeats and no rule is ever copied by hand.

Canonical text: `AGENTS.shared.md`. Installer: `install.mjs`. Edit the first, run the second on each
machine, and `--check` proves the two homes match.

---

## Executive summary

| | |
| :--- | :--- |
| **Need** | The binding rules lived only in each machine's `~/.agents/AGENTS.md`. Two independent copies drift, and a rule learned in one session never reaches the other machine. |
| **Why** | One canonical file in the shared checkout plus one installer per machine turns drift into a failed `--check` instead of a forgotten edit. |
| **What** | `install.mjs` upserts one block, `<!-- BEGIN managed: shared-agent-notes -->`, and touches nothing outside it. Machine notes stay in the same file, outside the block. |
| **DoD** | `--check` exits 0 on both machines; a re-run changes nothing; editing `AGENTS.shared.md` makes `--check` exit 1 until the installer runs. |
| **Top risk** | A machine-specific path or a credential enters the public repository. Mitigated by `--check` refusing a block without the credential guardrail, and by the unit tests scanning the canonical file for drive letters and mount roots. |

---

## What it writes

One target receives **one** block delimited by

```
<!-- BEGIN managed: shared-agent-notes -->
<!-- END managed: shared-agent-notes -->
```

Everything outside those markers is untouched. The target file holds three parts, in this order:

| Part | Owner | Installed |
| :--- | :--- | :--- |
| Shared rules | `global/AGENTS.shared.md` | Yes, by this installer |
| Machine notes | The machine, under `## Machine notes` | Never |
| Output style | `output-style/managed-block.md` | Yes, by `output-style/install.mjs` |

The credential guardrail is part of the shared block. `output-style/install.mjs` no longer appends it;
it only notes when the heading is absent, because the shared installer is the owner. Both installers
share `scripts/lib/install-block.mjs` and `scripts/lib/managed-block.mjs`, so each owns only its block
kind and its guardrail.

---

## Usage

Run with Node 20 or newer from the repository root:

```bash
node global/install.mjs             # install or update the block
node global/install.mjs --check     # exit 1 when the target is missing or stale
node global/install.mjs --dry-run   # report the status, write nothing
node global/install.mjs --remove    # remove the block this installer owns
```

`DSH_AGENTS_HOME` overrides `~/.agents`, which is what the unit tests and a staging run use.

`--check` is the drift detector. Run it after editing the rules, or from a weekly timer, so a reset
config shows up as a failure rather than being silently lost.

---

## What belongs where

| Text | Home | Why |
| :--- | :--- | :--- |
| Rules true on every machine and every project | `AGENTS.shared.md` | Installed everywhere, one source |
| A path, shell or tool that exists on one machine | The target file's `## Machine notes` | Never installed, never overwritten |
| Writing style for chat answers and documents | `output-style/` | Separate installer, separate markers |
| A Claude-only setting or worktree rule | `claude/` | The neutral skills do not read it |

---

## Changing the rules

1. Edit `AGENTS.shared.md`.
2. Run `node global/install.mjs` on Windows and on Omarchy.
3. Restart the harness. `AGENTS.md` is read at session start, so a running session keeps the old
   block.

Run the unit tests after a change:

```bash
node --test scripts/lib/managed-block.test.mjs scripts/lib/install-block.test.mjs
```

## Notes

- **UTF-8, no BOM.** The installer reads and writes UTF-8, so a BOM would make the block read as
  stale forever.
- **Line endings are preserved.** A CRLF target stays CRLF; a comparison and a rewrite both use the
  file's own convention.
- **The block is loaded every session, so length is a recurring cost.** Detail that only matters for
  one project belongs in that project's `AGENTS.md`, not here.
