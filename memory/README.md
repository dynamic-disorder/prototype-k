# Memory

Personal notes, references, and configuration snippets for development tooling
and environment setup. This folder is committed to git and serves as **stable,
long-lived reference** — not ephemeral session memory.

## Role (deliberate distinction)

| Memory type | Where it lives | Contents |
| :---------- | :------------- | :------- |
| **Stable reference** | `memory/` (committed) | Tooling notes, environment setup, fallback instructions, reference configs |
| **Ephemeral, cross-session facts** | Claude Code auto-memory (`~/.claude/projects/<hash>/memory/`) — git-ignored | "Today I decided X", "Cline ticket open", short-lived context |

Rule: if a note is still true in 3 months, it belongs in `memory/`. If it is a
passing observation, use Claude Code auto-memory instead.

## Contents

- `MEMORY.md` — index with 1-line summaries (agents read this first, then the file they need)
- `non-programmable-fallback.md` — fallback configuration notes
- `statusline-setup.md` — terminal/editor statusline configuration

## Usage for AI agents

Read `MEMORY.md` for the index; open only the specific file you need. Keep this
folder lean — total AI context from `memory/` should stay under ~500 tokens.