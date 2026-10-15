# DeepSeek Harness (DSH) in this repository

How this repository is consumed by DeepSeek Harness, what it shares with Claude Code, and — the part
that surprises people — **what has to be set up per machine before the build gate actually fires**.

Checked against `@deepseek-ai/dsh` 0.2.0-rc.2 (`dsh-agent-instructions`, `dsh-skill-filesystem`,
`dsh-hooks-claude-code`, `dsh-hook-protocol`).

## What DSH reads from here

| Input | Where it comes from | Shared with Claude Code? |
| :---- | :------------------ | :----------------------- |
| Instructions | `AGENTS.md` **and** `CLAUDE.md`, plus the `AGENTS.local.md` / `CLAUDE.local.md` overlays, chained from the project root down to the session working directory | Yes — the committed `CLAUDE.md` files serve both, so there is no duplicate `AGENTS.md` to maintain |
| Skills | Project roots `.dsh/skills/` and `.agents/skills/`; user roots `~/.dsh/skills/` and `~/.agents/skills/` | Yes — canonical copy is the tracked [`.agents/skills/`](../.agents/skills/); Claude Code reaches it through the local `.claude/skills` symlink |
| Hooks | **Not natively** — an extra package has to be mounted per machine (below) | No — the configuration is shared, the *activation* is not |

Details worth knowing:

- The project root is located by the `.git` marker, so the instruction chain starts here regardless of
  which subdirectory a session runs in.
- A skill is either `<name>/SKILL.md` or a flat `<name>.md`, and only at the **top level** of a scanned
  root — nested `**/SKILL.md` is deliberately not discovered. Symlinked directories *are* followed,
  which is what makes `.claude/skills` work.
- Frontmatter: `name` and `description` are required; `whenToUse`, `metadata`,
  `disable-model-invocation` and `user-invocable` are optional and **mean the same thing they do in
  Claude Code**, so the same files gate identically in both harnesses.
- `dsh-base` already supplies the instruction loader (64 KB budget) and the filesystem skill provider
  with those roots, so no profile configuration is needed for instructions or skills.

## The build gate

One script is the whole gate — [`.claude/hooks/pre-commit-build-check.sh`](../.claude/hooks/pre-commit-build-check.sh) —
and it serves two entry points:

| Entry point | Activated by | Status |
| :---------- | :----------- | :----- |
| **Git hook** — [`.githooks/pre-commit`](../.githooks/pre-commit), a thin wrapper that `exec`s the gate | `git config core.hooksPath .githooks` (repo-local, one line per clone) | **Working, and the path to rely on.** Verified: a passing build commits, a failing build aborts the commit with the compiler output. Gates your commits *and* an agent's. |
| **Harness hook** — a `PreToolUse` entry in [`.claude/settings.json`](../.claude/settings.json) | Claude Code reads that file natively | Works in Claude Code. In DSH it has **never been observed to run** (see below), so it is a bonus rather than the mechanism. |

The gate is dual-mode, which is why one file suffices: on a harness call it reads the tool-call JSON
from stdin and gates on `git commit`; as a git hook there is no payload at all, and it treats that as
"this is a commit, check it". It never reads stdin unconditionally — a git hook run from a terminal
inherits a TTY, and a bare `cat` would hang the commit.

It acts only when `.cs`, `.csproj`, `.props` or `.targets` are staged, and a C# commit runs a
`--no-incremental` build of the nearest solution first, blocking with the compiler output on failure.

### DSH's hook bridge: mounted, but not firing

DSH ships `@deepseek-ai/dsh-hooks-claude-code`, which can run Claude Code command hooks. Getting it
mounted involves three traps, all of which cost real time to find:

1. **It is not part of `dsh-base`**, and a patch entry alone does not mount a plugin — it must be a
   profile dependency:
   `dsh plugin --profile web add @deepseek-ai/dsh-hooks-claude-code@0.2.0-rc.2`
2. **Pin the version.** The registry's `latest` tag is stale (`0.0.1-rc.5`, a different release line
   whose peers conflict with the runtime), while the matching build is on **`next`** (`0.2.0-rc.2`).
   A bare `add <pkg>` is rejected by DSH's version guard.
3. **A new plugin must be *inserted*, not overridden.** A patch entry with an `id` and no `insert` is an
   override targeting an existing entry — since this plugin is in no bundle, that form fails with
   `patch: entry … not found`. The working shape in `~/.dsh/profiles/web/cordis.patch.yml`:

   ```yaml
   - insert:
       - name: "@deepseek-ai/dsh-hooks-claude-code"
         config:
           configPath: /absolute/path/to/repo/.claude/settings.json
           projectDir: /absolute/path/to/repo
   ```

   `--dump-config` then composes it, and the bridge reads `configPath` **once at process load**, so a
   restart is required after any change.

**Even so, no hook has ever been observed to execute under DSH** — probed repeatedly across a restart,
with staged C# and a matching command, and with no hook-run record in the session log. The mount is
harmless and left in place in case a later DSH release honours it; the git hook is what actually
enforces the build.

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
case-sensitive membership** — so `Bash` alone would silently never fire in DSH.

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

To disable it: `git config --unset core.hooksPath` (git route) or drop the `hooks` key from
`.claude/settings.json` (Claude Code). `git commit --no-verify` skips the git hook.

## Related

- [`git-ignored-local-files.md`](git-ignored-local-files.md) — what is ignored, what `.gitignore`
  deliberately re-includes, and what is deliberately disposable
- [`README.md`](README.md) — repository scripts and tools, including the path resolvers
