# Git-ignored files local to this clone

Some working-tree paths are excluded by `.gitignore`. That is **deliberate** in two different ways,
and the reasons matter because "it's ignored" is not the same as "it's disposable".

Rule of thumb: `git status` will **never** show changes to these paths. Use
`git status --ignored` or `git check-ignore -v <path>` to confirm.

## 1. `.claude/` — excluded, now sanitised and reduced

**State (2026-10-10): reviewed, sanitised and cut from 29 files / 67,271 chars to 11 files /
14,038 chars (−79%).** It is still untracked by choice, not because it is unsafe.

Why it was ignored originally, and why the cleanup was needed:

1. **Personal / work configuration.** It had been adapted for a work Claude Code setup and carried
   machine paths, a work username, a ticket-tracker key and work-domain example types.
2. **Outdated.** Written months earlier; practice had moved on, and several rules contradicted the
   repo's own `.editorconfig` and code.
3. **The layout had changed.** Claude Code no longer separates user-initiated *commands* from
   model-invoked behaviour — everything is a skill, triggerable by the user or the AI. Directory-scoped
   skills can also be referenced from another directory or from root instructions (e.g. "read
   `folderX/CLAUDE.md`, then run the skills in it").

The ten skills that survived that cleanup were later **promoted out of this ignored tree** to
`.agents/skills/`, where they are tracked — see "How other harnesses reach this tree" below. What is
left here now:

| Path | Note |
| :--- | :--- |
| `.claude/settings.local.json` | Personal overlay on the shareable `settings.json` — permission allow-list only. Must stay ignored (see below) |
| `.claude/skills` | A **symlink** to `../.agents/skills` so Claude Code finds the tracked skills. Covered by the `.claude/` rule; it owns no content of its own |

Also present in the tree but **tracked**, so not part of the ignored set:
`.claude/settings.json` and `.claude/hooks/pre-commit-build-check.sh` — the build gate. See section 2.

Deleted: the entire `commands/` (6, legacy layout) and `rules/` (5, folded into skills or generic),
`skills/csharp-code-reviewer`, `skills/html-review-generator`, `skills/personal-cc-exporter`,
`skills/unit-test-generator`, `skills/git-commit-message-writer`, `hooks/` (3, never wired),
`lib/project-env.sh`, `settings.json` (0 bytes).

### What the sanitisation removed

- A **work username** in `settings.local.json`, plus `D:` drive-letter paths and a dead
  `outputStyle`.
- The owner **surname**, `whoami` and a personal `C:\_myFiles` path from `personal-cc-exporter`.
- A **work ticket key** (`REV-…`) and branch convention; work-domain example types
  (patient/health, `BatchConsumer`/`IConsumerMessage`).
- References to files that no longer exist (`scripts/statusline.js`, the CRLF fixers) and to a
  non-existent `temp_user_files/` (the real directory is `local_user_files/`).
- **Rules that contradicted the repo** — corrected with evidence rather than kept: the `int`/`Int32`
  rule (backwards vs `.editorconfig`), a blanket "no `Async` suffix" rule (the codebase uses it
  everywhere), "XML docs on every `[Fact]`" (the code documents the test class only), and a claimed
  pre-commit build hook that was never wired.
- **Micromanagement** — the step-by-step build-discovery recipes, prescribed output strings, long
  report templates, and rules restating what `.editorconfig` or the analyzer already enforce.

> **Correction:** an earlier revision of this file recommended `git add -f .claude/rules`. That was
> wrong and was reverted — the files were briefly staged and then unstaged, and the unpushed commit
> was rewritten so no `.claude` content ever reached the remote. Now that the tree is sanitised,
> versioning it is a legitimate choice; force-add if wanted.

A temporary snapshot of the pre-cleanup tree sits in the git-ignored scratch directory
(`local_user_files/claude-config-pre-cleanup-20261010-160731/`, 29 files). It is the **only** copy of
the deleted skills and commands — they were never tracked, so git history cannot recover them. It is
also the unsanitised personal configuration, which is why it must not be committed. Scratch is
disposable by policy: treat the snapshot as a convenience, not an archive, and copy anything worth
keeping somewhere durable before clearing `local_user_files/`.

### How the two harnesses share this repository

`.claude/` is Claude Code's layout; DeepSeek Harness (DSH) uses the tool-neutral `AGENTS.md` +
`.agents/skills/` convention. Both are served from a single copy:

| | Claude Code | DeepSeek Harness | Shared how |
| :--- | :--- | :--- | :--- |
| Instructions | `CLAUDE.md` | `AGENTS.md` **and** `CLAUDE.md` (plus the `.local.md` overlays), chained from the project root (`.git` marker) down to the working directory | The existing `CLAUDE.md` files load in both — no second file to maintain |
| Skills | `.claude/skills/` | Project roots `.dsh/skills/` and `.agents/skills/`; user roots `~/.dsh/skills/` and `~/.agents/skills/`, where this machine's `diagnose-crash` and `omarchy` live | Canonical **tracked** copy at `.agents/skills/`; Claude Code reaches it through a local symlink |

```bash
# canonical and tracked:  .agents/skills/<name>/SKILL.md
ln -sfn ../.agents/skills .claude/skills   # local glue, ignored via the .claude/ rule
```

`.agents/skills/` is DSH's native project root *and* tool-neutral, so it is the better home for the
canonical copy; `.claude/` stays ignored, holding only personal settings and that symlink. DSH
discovers a skill as `<name>/SKILL.md` at the *top level* of a scanned root — nested `**/SKILL.md` is
deliberately not discovered — and it follows symlinked directories, which is why the shim works.

Verified end to end: DSH's catalog picked up `csharp-conventions`, `csharp-build-verify`,
`unit-test-writer`, `issue-investigate` and `spike`, and correctly **withheld** `git-commit`,
`publish`, `explain`, `csharp-refactor` and `install-net10-runtime` because they declare
`disable-model-invocation: true` — so that frontmatter is portable between the two harnesses.

A **user-global** bridge was deliberately not created: these skills encode this repository
(`FilenameTools` paths, its `.editorconfig`, its commit scopes), so placing them in
`~/.agents/skills/` would make them fire in unrelated projects. Omarchy uses that mechanism for the
distro's own machine-level skills, which is the right scope for them.

Two related notes:

- **The build gate's configuration is shared; its activation is not.** `.claude/settings.json` and
  `.claude/hooks/pre-commit-build-check.sh` are tracked, so every clone has them — but DSH only runs
  them once `dsh-hooks-claude-code` is mounted in the machine's profile *and* DSH has been restarted.
  The mechanism, the `bash|Bash` matcher subtlety and the verification steps are documented in
  [`deepseek-harness.md`](deepseek-harness.md).
- **User-global DSH config is outside this repository** — `~/.dsh/` (settings, profiles, sessions) and
  `~/.agents/skills/` — and outside the agent sandbox's writable area. Granting permission in
  conversation does **not** lift that: writes there are refused unless elevated sandbox access is
  approved per operation, so treat those paths as the user's to edit.

## 2. Ignored *but* tracked — already public, same review applies

Force-added despite the ignore rules, so these **are in the remote history**:

- `.clinerules`
- `.claude/settings.json` — the shareable settings layer; now carries the `PreToolUse` build gate
- `.claude/hooks/pre-commit-build-check.sh` — the enforcement itself
- `CsvTranslations/.claude/commands/build.md`
- `CsvTranslations/.claude/rules/windows-development.md`
- `CsvTranslations/.claude/settings.json`
- `FilenameTools/.claude/commands/build.md`
- `FilenameTools/.claude/rules/filename-sanitization.md`
- `FilenameTools/.claude/settings.json`

This matters for the hook in particular: it was **untracked** when it existed before, which is exactly
why it was unrecoverable and had to be rewritten. A new file in these directories is still skipped by
`git add -A` and needs `git add -f`.

A scan for personal markers in these found only a generic Windows path *example* in
`CsvTranslations/.claude/rules/windows-development.md` (`C:\Users\...`) — no real leak. They are still
worth an out-of-date check.

**Trap:** a *new* file inside one of those directories is silently skipped by `git add -A` and needs
`git add -f`. This already bit once: three tracked files under `FilenameTools/.claude/` were nearly
dropped by a directory rename (see `analyses/linux-build-audit.md`).

## 3. Per-machine state

| Path | Note |
| :--- | :--- |
| `CsvTranslations/OllamaTranslatorApp/Properties/launchSettings.json` | `workingDirectory` `bin\Debug\net9.0` → `net10.0`. Left untracked deliberately: per-machine IDE state that VS regenerates |

## 4. Ephemeral scratch (`local_user_files/`)

Disposable by design — nothing here is versioned, and nothing durable should live here. The directory
is ignored with `local_user_files/*` **plus a negation** (`!local_user_files/README.md`), so that
README is tracked while everything else inside is not. That is why `git check-ignore local_user_files`
reports the *directory* as not ignored even though its contents are — and
`git add -A local_user_files/` finds nothing.

| Present in scratch | Purpose | Durable? |
| :--- | :------ | :------- |
| `nuget/`, `dotnet-home/`, `dotnet-tools/`, `xdg/` | Package/runtime caches and tool installs for the sandbox (see `../memory/omarchy-tool-substitutions.md` for how to recreate `pwsh`). `nuget/env.sh` is pre-existing and still needed: it redirects the caches because `$HOME` is read-only. | No — all reproducible |
| `compatcheck/` | One-off: resolved every member reference PiperSharp 1.0.7 makes against NAudio 3.1.0 to prove zero missing members. | No — the finding is recorded in `analyses/linux-build-audit.md` |
| `parsecheck/` | One-off: ran the real `translations.csv` through `TranslationTools` to validate the parser fixes (3077/3077 rows). | No — the finding is recorded in the audit |
| `CSV files/`, `samples/`, `*.bundles`, `tmp-rewrite.git/`, `dot-git-backup/`, `*.md` | Local data, backups and notes. | Deliberately local |

**Promoted out of scratch:** the .NET assembly inspector `ildump` moved to
[`tools/ildump/`](tools/ildump/) once it was judged reusable rather than one-off — the rule being that
anything wanted later belongs in `local_dev/`, not here.

## Removed during this work

All untracked, so unrecoverable from git — deliberately, they enforced the abandoned CRLF policy:

- `.claude/scripts/*.ps1` — 7 line-ending / string-literal fixers
- `.claude/hooks/normalize-line-endings.ps1` **and** `.sh`

Two rule files (`csharp-conventions.md`, `repository-structure.md`) were found with **CRLF** endings —
leftovers from that same policy. They were normalised to LF, and a scan now reports **zero CRLF text
files** in the working tree. That fix stands regardless of whether the files are ever versioned.

## Persisting any of this

The **skills** are no longer part of this question — they were promoted to the tracked
`.agents/skills/`, so nothing has to be force-added for them.

What stays untracked, and should:

- `settings.local.json` — the personal overlay on the shareable `settings.json` (Claude Code's own
  layering), so it belongs in `.gitignore` permanently.
- The `.claude/skills` symlink — local glue pointing at the tracked skills.
- Per-machine IDE state (`launchSettings.json`) and everything in `local_user_files/`.

If something else here genuinely needs versioning, `git add -f <path>` is the escape hatch — but
prefer moving it somewhere durable, as was done for `ildump` (to `local_dev/tools/`) and for the
skills (to `.agents/skills/`).

### The two settings files

| File | Role | Tracked? |
| :--- | :--- | :------- |
| `settings.json` | Shareable project settings — permissions, hooks, whatever the repo agrees on | **Tracked** where it exists: the root (the build gate), `CsvTranslations/.claude/`, `FilenameTools/.claude/` |
| `settings.local.json` | Personal overlay, applied on top of `settings.json`. Per-machine by definition | **Never.** Ignored at the root, in `CsvTranslations/.claude/` and in `CsvTranslations/TextToSpeechApp/.claude/` |

Their permissions are local only; sharing the file would push one machine's allow-list onto everyone.
`.gitignore` lists `settings.local.json` explicitly *in addition to* the blanket `.claude/` rule, so
that narrowing the blanket rule later (for example to version skills) cannot accidentally expose it.
