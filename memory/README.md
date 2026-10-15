# Memory

Personal notes, references, and configuration snippets for development tooling and environment
setup. **Machine- and user-level, not project-level**: when this repository splits, these notes
belong in user-global configuration rather than being copied into every repository. That decision
is recorded in `../local_dev/plans/2026-10-15_consolidation-and-multi-repo-plan.md`.

## Index

Read this file first, then open only the note you need.

- [Non-Programmable Fallback](non-programmable-fallback.md) — when programmatic execution is
  impossible (permissions/environment), provide manual instructions with the exact commands.
- [Omarchy Tool Substitutions](omarchy-tool-substitutions.md) — tools missing on this Arch box
  (`bc`, IL disassemblers, CSV CLI, `filterdiff`, …) and the verified alternatives to reach for;
  includes how to get `pwsh` without root.

## Role (deliberate distinction)

| Memory type | Where it lives | Contents |
| :---------- | :------------- | :------- |
| **Stable reference** | `memory/` (committed) | Tooling notes, environment setup, fallback instructions, reference configs |
| **Ephemeral, cross-session facts** | Claude Code auto-memory (`~/.claude/projects/<hash>/memory/`) — git-ignored | "Today I decided X", short-lived context |

Rule: if a note is still true in 3 months, it belongs here. If it is a passing observation, use
Claude Code auto-memory instead.

Keep this folder lean — total AI context from `memory/` should stay under ~500 tokens.
