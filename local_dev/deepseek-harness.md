# DeepSeek Harness (DSH) in this repository

How this repository is consumed by DeepSeek Harness, what it shares with Claude Code, and — the part
that surprises people — **what has to be set up per machine before the build gate actually fires**.

Checked against `@deepseek-ai/dsh` 0.2.0-rc.2 (`dsh-agent-instructions`, `dsh-skill-filesystem`,
`dsh-hooks-claude-code`, `dsh-hook-protocol`).

## What DSH reads from here

| Input | Where it comes from | Shared with Claude Code? |
| :---- | :------------------ | :----------------------- |
| Instructions | `AGENTS.md`, plus the `AGENTS.local.md` / `CLAUDE.local.md` overlays, chained from the project root down to the session working directory. DSH also reads `CLAUDE.md` where a tree still carries one | Yes — the same files serve both harnesses, so there is no duplicate to maintain |
| Skills | Project roots `.dsh/skills/` and `.agents/skills/`; user roots `~/.dsh/skills/` and `~/.agents/skills/` | Yes — one canonical copy in this checkout's [`.agents/skills/`](../.agents/skills/), linked from `~/.agents/skills/<name>`, so both harnesses and every repository read the same files |
| Hooks | **Not natively** — an extra package has to be mounted per machine (below) | No — the configuration is shared, the *activation* is not |

Details worth knowing:

- The project root is located by the `.git` marker, so the instruction chain starts here regardless of
  which subdirectory a session runs in.
- A skill is either `<name>/SKILL.md` or a flat `<name>.md`, and only at the **top level** of a scanned
  root — nested `**/SKILL.md` is deliberately not discovered. Symlinked directories *are* followed,
  which is what makes `.agents/skills` work.
- Frontmatter: `name` and `description` are required; `whenToUse`, `metadata`,
  `disable-model-invocation` and `user-invocable` are optional and **mean the same thing they do in
  Claude Code**, so the same files gate identically in both harnesses.
- `dsh-base` already supplies the instruction loader (64 KB budget) and the filesystem skill provider
  with those roots, so no profile configuration is needed for instructions or skills.

## The build gate

One script is the whole gate — [`.agents/hooks/pre-commit-build-check.sh`](../.agents/hooks/pre-commit-build-check.sh) —
and one wrapper calls it:

| Entry point | Activated by | Status |
| :---------- | :----------- | :----- |
| **Git hook** — [`.githooks/pre-commit`](../.githooks/pre-commit), a thin wrapper that runs the gate | `git config --global core.hooksPath <absolute ~/.agents/githooks>`, written once per machine by `node scripts/install-global.mjs --write` | **Working, and the path to rely on.** Every repository on the machine runs it, and a clone carries no hook file of its own. |

The harness `PreToolUse` hook was removed on 2026-11-11 with `.agents/settings.json`; the git hook is the only entry point.

### Where the gate lives

This checkout is its only home. `~/.agents/hooks`, `~/.agents/scripts` and `~/.agents/githooks` are
links into it, and `core.hooksPath` points at the last one, so no repository carries a copy of the
gate — or anything else the machine installs. `ai-offline` holds no C# and the gate exits 0 there.

Two changes came out of the earlier distribution and stay in the shared script:

- The script prefers the tracked `local_dev/scripts/sandbox-env.sh` and only falls back to the older
  scratch `local_user_files/nuget/env.sh`, so a repository carrying the tracked script builds on a
  read-only `$HOME` without needing a scratch file.
- A repository holding a single project and no solution is gated too: the script builds that project.
  `cliutils` has no `.sln`, and the script previously found nothing there and let every commit through
  unchecked. Both solution formats are searched: `.sln` and `.slnx`.

Installing it was not cosmetic: the first probe blocked `mediarenamer`, whose repo-root
`Directory.Build.props` had not survived the split, so a plain `dotnet build` there failed with
`NETSDK1100`. That repository was publicly broken on Linux until the file was restored.

To activate it on a machine, from this checkout:

```bash
node scripts/install-global.mjs --write    # links hooks, scripts and githooks; writes core.hooksPath
node scripts/install-global.mjs            # check: every link and the setting
```

The gate is a git hook: it acts only when `.cs`, `.csproj`, `.props`, `.targets`, `.sln` or `.slnx` are
staged, and a C# commit runs a `--no-incremental` build of the nearest solution first, blocking with
the compiler output on failure.

### The harness hook bridge (removed)

`@deepseek-ai/dsh-hooks-claude-code` was mounted to run the gate as a `PreToolUse` hook, but no hook
was ever observed to execute under DSH. The bridge and `.agents/settings.json` were removed on
2026-11-11; the git hook is the only entry point, and the mount instructions are no longer maintained.

### A build the gate could not perform must not block a commit

A hook can be run with a **read-only view of the workspace**. That was observed here: builds launched
from a hook failed with `EROFS` / `MSB3061` on `bin/`/`obj/`, while the identical build run directly
succeeded. The origin was not pinned down (the hook is a grandchild process, and the harness route was
silent), but the consequence is clear — and it must not be a blocked commit. So the gate probes
writability first and, if the workspace is read-only, warns and allows:

```
[pre-commit] workspace is read-only here (…) — skipping the build check
```

One more detail for the harness route: the matcher is `bash|Bash`. Claude Code names the tool `Bash`
and DSH names it `bash`, and a literal matcher (word characters and `|`) is compared by **exact,
case-sensitive membership** — so `Bash` alone would silently never fire in DSH. The route is gone; the
detail is kept for the day it comes back.

### Scope

- The hook re-checks the session `cwd` from the harness payload and exits early when a session is
  outside this repository, so a commit made elsewhere cannot trigger a build here. (In git-hook mode
  there is no payload and no need: git only runs it for a commit in this repository.)
- `git commit --no-verify` does **not** bypass the harness hook — but it *does* skip a git hook, so the
  git route is advisory against a determined user and firm against an agent.
- Machine-local DSH configuration (`~/.dsh/`, `~/.agents/`) is outside this repository and outside the
  agent sandbox's writable area: writing there needs per-operation approval, and conversational
  permission does not lift that.

## Verifying the gate

A real commit is what exercises the git hook — `git commit --dry-run` does **not** run git hooks, and a
`PreToolUse` hook fires only for harness tool calls. Neither substitutes for the other:

```bash
printf 'class T {}\n' > local_dev/__probe.cs
git add local_dev/__probe.cs
git commit -m "probe"      # expect "[pre-commit] staged C# — building …", then "build OK" and a commit
git reset --soft HEAD~1 && git reset -q local_dev/__probe.cs
rm -f local_dev/__probe.cs
```

To watch it block without creating anything, put a failing `dotnet` stub first on `PATH`
(`PATH=/tmp/stub:$PATH git commit -m probe`) and expect exit 2 plus
`build FAILED … the commit is blocked`.

To disable it: `git config --global --unset core.hooksPath`. `git commit --no-verify` skips the git hook.

## Related

- [`git-ignored-local-files.md`](git-ignored-local-files.md) — what is ignored, what `.gitignore`
  deliberately re-includes, and what is deliberately disposable
- [`README.md`](README.md) — repository scripts and tools, including the path resolvers
