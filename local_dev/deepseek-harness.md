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

## The build gate needs a per-machine mount

The repo carries both halves of the gate and they are tracked:

- [`.claude/settings.json`](../.claude/settings.json) — the `PreToolUse` hook declaration
- [`.claude/hooks/pre-commit-build-check.sh`](../.claude/hooks/pre-commit-build-check.sh) — the check

**Git carries the configuration; it does not make DSH run it.** Claude Code reads `.claude/settings.json`
natively, so a clone is enough there. DSH needs two things that live outside the repository:

1. **Mount the bridge** in the active DSH profile. `@deepseek-ai/dsh-hooks-claude-code` is *not* part of
   `dsh-base`, so a fresh machine must add it — on this machine that is
   `~/.dsh/profiles/web/cordis.patch.yml`:

   ```yaml
   - id: hooks-claude-code
     name: "@deepseek-ai/dsh-hooks-claude-code"
     config:
       configPath: /absolute/path/to/repo/.claude/settings.json
       projectDir: /absolute/path/to/repo
   ```

2. **Restart DSH.** The bridge reads `configPath` **once at process load**. Editing that path, or the
   settings file it points at, has no effect on a running process — this is the step that catches
   people out. (Per-session discovery of a project-local hook config is still a TODO in the bridge,
   which is why the profile needs an absolute path while the repo file stays path-free.)

The split is deliberate: the repository uses `${CLAUDE_PROJECT_DIR}/…`, so the tracked file contains no
machine path, and the one absolute path lives only in the machine-local profile.

### Why the matcher is `bash|Bash`

Claude Code names the tool `Bash`; DSH names it `bash`. The bridge compares a literal matcher (word
characters and `|`, as in `CLAUDE_LITERAL`) by **exact, case-sensitive membership**, so `Bash` alone
matches nothing in DSH — a hook that looks wired and silently never runs. The alternation satisfies
both.

### Scope

- The mount is **process-wide with a single `configPath`**, so it belongs to one repository. The hook
  re-checks the session `cwd` from the payload and exits early when a session is outside this repo, so
  a commit made elsewhere cannot trigger a build here.
- The hook only acts when `.cs`, `.csproj`, `.props` or `.targets` are staged. Documentation commits
  skip it, and a C# commit runs a `--no-incremental` build of the nearest solution first — failing the
  build blocks the commit, with the compiler output as the reason.
- Machine-local DSH configuration (`~/.dsh/`, `~/.agents/`) is outside this repository and outside the
  agent sandbox's writable area: writing there needs per-operation approval, and conversational
  permission does not lift that.

## Verifying the gate fires

```bash
printf 'class T {}\n' > FilenameTools/FilenameSanitizer/__probe.cs
git add FilenameTools/FilenameSanitizer/__probe.cs
git commit --dry-run     # expect "[pre-commit] staged C# — building …" then "build OK"
git reset -q FilenameTools/FilenameSanitizer/__probe.cs && rm FilenameTools/FilenameSanitizer/__probe.cs
```

No `[pre-commit]` line means the hook did not run: check the mount, then that DSH has been restarted
since the mount was added.

To disable the gate temporarily, remove the `hooks` key from `.claude/settings.json` (Claude Code), or
unmount `hooks-claude-code` (DSH). Note that `git commit --no-verify` does **not** bypass it — these
are harness hooks, not git hooks.

## Related

- [`git-ignored-local-files.md`](git-ignored-local-files.md) — what is ignored, what is force-added
  despite the ignore rules, and what is deliberately disposable
- [`README.md`](README.md) — repository scripts and tools, including the path resolvers
