# output-style — one writing style for every AGENTS.md-aware tool

Installs the writing rules into the shared user-global instructions at `$DSH_AGENTS_HOME/AGENTS.md`
(default `~/.agents/AGENTS.md`), so every project and every tool that reads `AGENTS.md` uses the same
voice. One voice, three modes: a direct answer stays signal-only and budgeted, a document opens with an
executive summary, a message uses the simplest register and puts the ask first.

Canonical rules: `documentation-style.md`. Injected text: `managed-block.md`. Edit one of those two,
then re-run the installer on each machine.

---

## Executive summary

| | |
| :--- | :--- |
| **Need** | The style was copied into each harness's own config file. Every copy could drift, and a tool that was not installed got nothing. |
| **Why** | One source, one target, one `--check`: the style lives in the file every AGENTS.md-aware tool already reads. |
| **What** | `install.mjs` upserts one managed block in `~/.agents/AGENTS.md`. No harness-specific copies are written. A tool that reads only its own file gets a one-line pointer, if it is used at all. |
| **DoD** | `--check` exits 0 with the block present once; a re-run changes nothing; editing `managed-block.md` makes `--check` exit 1 until the installer runs. |
| **Top risk** | A tool that does not read `AGENTS.md` gets no style. That is deliberate: the fix is a pointer to the shared file, not a second copy of the rules. |

---

## What it writes

One target receives **one** block delimited by

```
<!-- BEGIN managed: documentation-style -->
<!-- END managed: documentation-style -->
```

Everything outside those markers is untouched, so your own notes survive.

| Target | Read by |
| :--- | :--- |
| `~/.agents/AGENTS.md` (or `$DSH_AGENTS_HOME/AGENTS.md`) | DeepSeek Harness and every tool that reads `AGENTS.md` |

A tool with its own instruction file needs a pointer, not a copy:

- **Claude Code** — `@~/.agents/AGENTS.md` in `~/.claude/CLAUDE.md`.
- **Cline / Continue** — a one-line rule file that points at `AGENTS.md`, if that tool is used.

The credential guardrail is not appended here: it travels in the shared-agent-notes block owned by
`global/install.mjs`. This installer prints a note when that block is missing, so a machine set up in
the wrong order says so instead of silently lacking the rule.

---

## Usage

Run with Node 20 or newer from the repository root:

```bash
node output-style/install.mjs             # install or update the block
node output-style/install.mjs --dry-run   # show what would change, write nothing
node output-style/install.mjs --check     # exit 1 if the block is missing or stale
node output-style/install.mjs --help
```

Each machine has its own `$HOME`, so the block is installed per machine. The checkout can sit on a
shared data disk; the installer is the step that repeats, and nothing is copied between machines.

`--check` is the drift detector. Run it after editing the rules, or from a weekly timer, so a reset
config shows up as a failure rather than being silently lost.

---

## Changing the rules

1. Edit `documentation-style.md` (the human-readable rules) and `managed-block.md` (the exact text
   injected — keep it terse; it is loaded on every session).
2. Re-run `node output-style/install.mjs` on each machine.
3. Restart the harness. Tools read `AGENTS.md` at session start, so a running session keeps the old
   block.

---

## Notes

- **Encoding is part of the contract.** `managed-block.md` is UTF-8 without a BOM. The installer reads
  and writes UTF-8 and preserves the target's line endings, so a CRLF file stays CRLF. A non-UTF-8
  target is decoded, not passed through byte-for-byte — keep the file UTF-8.
- **Runtime:** Node, not bash, so the same command works in PowerShell, Git Bash and Omarchy. `bash`
  in PowerShell resolves to WSL on Windows and would check the wrong home directory.
- The block is LF-only in the repository, which matters because this file family mandates LF everywhere.
- Nothing is installed outside `$HOME` / `%USERPROFILE%`; no sudo, no system paths.
- The block is intentionally short. It is injected into every session's context, so length is a
  recurring cost, not a one-off. Detail belongs in `documentation-style.md`, read on demand.
