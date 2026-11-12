# AGENTS.md — <project>

**TL;DR** — <one sentence: what this repository is and what it produces.>

**Verify everything:** <the command that builds, and the command that tests. Report the exit code; do
not restate a count.>

## Executive summary

| | |
| :--- | :--- |
| **Problem** | <the situation that makes this repository necessary.> |
| **Value** | <what changes once it exists.> |
| **Change** | <the bounded scope of what this repository does.> |
| **Verify** | <the command that proves it works, and what it prints on success.> |
| **Top risk** | <the mistake a session is most likely to make here.> |

## Layout

| Path | Holds |
| :--- | :--- |
| `<source folder>/` | <the code and what it is responsible for> |
| `local_dev/` | Developer notes and tooling, tracked |
| `local_user_files/` | Git-ignored scratch; nothing durable belongs here |

## Build and test

```bash
<build command>
<test command>
```

Where `$HOME` is not writable — the agent sandbox — source the cache redirect first, if the repository
carries one; an unredirected restore fails on a read-only NuGet cache.

## Conventions

- **LF everywhere**, repository and working tree (`.gitattributes`). Never introduce CRLF.
- **Never hard-code a machine path** — derive it, or use the repository's root variable.
- **A commit message is public text**: no drive letter, home or profile path, account, user or host name,
  and no description of content that was removed.
- **No document records how many tests exist** — the test command is the number.

## The commit gate

The gate is machine-level: `core.hooksPath` is global and points at `~/.agents/githooks`, so every commit
runs the shared publication scan and then the build gate. This repository carries no hook file of its own,
and sets no local `core.hooksPath`.

If the gate is missing, install it once on the machine from the checkout that owns the configuration:

```bash
node scripts/install-global.mjs --write
```

## Where work is recorded

Investigation and research output goes to `local_user_files/<task>/`, which is git-ignored except for its
README. A finding that only the owner can confirm stays an open item in the reply, not a claim in a file.

Documentation: this file is the agent entry point.
