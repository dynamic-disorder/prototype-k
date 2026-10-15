# Git-ignored files local to this clone

Some working-tree paths are excluded by `.gitignore`. That is **deliberate** in two different ways,
and the reasons matter because "it's ignored" is not the same as "it's disposable". Section 2 covers
the mirror image: the shared `.claude/` files the rules deliberately *re-include*.

Rule of thumb: `git status` will **never** show changes to the paths in sections 1, 3 and 4. Use
`git status --ignored` or `git check-ignore -v <path>` to confirm.

## 1. `.claude/` — excluded, now sanitised and reduced

**State (2026-10-10): reviewed, sanitised and cut from 29 files / 67,271 chars to 11 files /
14,038 chars (−79%).** It is still untracked by choice, not because it is unsafe.

Why it was ignored originally, and why the cleanup was needed:

1. **Personal / work configuration.** It had been adapted for a work Claude Code setup as well as for
   this repository, so it mixed two kinds of machine state: the author's own Windows profile path and
   drive letters, and a ticket-tracker key with work-domain example types. The tracked files under
   `.agents/skills/`, `.clinerules` and `.claudeignore` were reviewed for exactly these markers at the
   same time; the unsanitised snapshot stayed out of git.
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
| `.claude/skills` | A **symlink** to `../.agents/skills` so Claude Code finds the tracked skills. Covered by the `**/.claude/*` rule; it owns no content of its own |

Also present in the tree but **tracked**, so not part of the ignored set:
`.claude/settings.json` and `.claude/hooks/pre-commit-build-check.sh` — the build gate. See section 2.

Deleted: the entire `commands/` (6, legacy layout) and `rules/` (5, folded into skills or generic),
`skills/csharp-code-reviewer`, `skills/html-review-generator`, `skills/personal-cc-exporter`,
`skills/unit-test-generator`, `skills/git-commit-message-writer`, `hooks/` (3, never wired),
`lib/project-env.sh`, `settings.json` (0 bytes).

### What the sanitisation removed

- The author's own Windows profile path (`C:\Users\…` — a personal machine account, not an employer
  identity) in `settings.local.json`, plus `D:` drive-letter paths and a dead `outputStyle`.
- The owner **surname**, `whoami` and a personal `C:\_myFiles` path from `personal-cc-exporter`.
- A **work ticket key** and branch convention, and work-domain example types: ticket-tracker IDs and
  domain model names taken from an employer codebase. The literals are deliberately not repeated here.
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

A **user-global** bridge was deliberately not created: these skills encode a repository's layout
and conventions, so placing them in `~/.agents/skills/` would make them fire in unrelated projects.
Each project repository therefore carries its own copy. Omarchy uses that mechanism for the
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

## 2. Shared Claude Code config — tracked, *and* `.gitignore` now says so

These were originally force-added *despite* the ignore rules. That worked, but it left the tracked
state contradicting the rules and made `git add -A` silently skip every new file in those
directories. **Fixed 2026-10-15:** `.gitignore` now ignores the *contents* of each `.claude/`
directory and re-includes the shared paths explicitly, so the rule and the tracked state agree.

| Path | Role |
| :--- | :--- |
| `.claude/settings.json` | Shareable settings layer; carries the `PreToolUse` build gate |
| `.claude/hooks/pre-commit-build-check.sh` | The enforcement itself |
| the per-project `CsvTranslations/…`, `FilenameTools/…` entries | Commands, rules and settings for a project. **Moved with their projects on 2026-10-15** — they live in those repositories now, which carry the same ignore and re-include rules |
| `.clinerules` | Cline rules, shared on purpose |
| `.claudeignore` | Claude Code's file-exclusion list for this repository |

The rules that carry it:

```gitignore
**/.claude/*          # contents only, so re-inclusion below is possible at all
!**/.claude/settings.json
!**/.claude/commands/
!**/.claude/hooks/
!**/.claude/rules/
**/.claude/settings.local.json
```

Two details that are easy to get wrong:

- **`**/.claude/*`, not `.claude/`.** Git cannot re-include a file whose parent directory is
  excluded, so the directory itself must stay un-ignored and only its contents ignored.
- **`**/` prefix.** One rule covered the root and every nested project directory while the projects
  lived here, without repeating near-identical blocks. The projects have moved out; the prefix stays
  so the rule keeps working if a project directory ever reappears.

This matters for the hook in particular: it was **untracked** when it existed before, which is exactly
why it was unrecoverable and had to be rewritten.

A scan for personal markers in these found only a generic path *example* in one project rule file —
no real leak. That file has since moved to its project repository, where the example was reworded.

**Still skipped by `git add -A`:** everything else inside a `.claude/` directory —
`settings.local.json`, the `.claude/skills` symlink, `agent-memory-local/`. A new *shared* file added
directly under `.claude/` (not in `hooks/`, `commands/` or `rules/`) is skipped too: put it in one of
those folders, or `git add -f` it. Getting this wrong already bit once — three tracked files under
`FilenameTools/.claude/` were nearly dropped by a directory rename
(see `analyses/linux-build-audit.md`).

**Verify the two sets stay consistent** (2026-10-15: reported zero ignored-but-tracked paths):

```bash
git ls-files | git check-ignore -v --no-index --stdin || true   # expect no output
```

## 3. Per-machine state

| Path | Note |
| :--- | :--- |
| `launchSettings.json`, any project | Per-machine IDE state that VS regenerates, deliberately untracked everywhere. The instances that were here moved out with their projects |

## 4. Ephemeral scratch (`local_user_files/`)

Disposable by design — nothing here is versioned, and nothing durable should live here. The directory
is ignored with `local_user_files/*` **plus a negation** (`!local_user_files/README.md`), so that
README is tracked while everything else inside is not. That is why `git check-ignore local_user_files`
reports the *directory* as not ignored even though its contents are — and
`git add -A local_user_files/` finds nothing.

| Present in scratch | Purpose | Durable? |
| :--- | :------ | :------- |
| `nuget/`, `dotnet-home/`, `dotnet-tools/`, `xdg/` | Package/runtime caches and tool installs for the sandbox, created by [`scripts/sandbox-env.sh`](scripts/sandbox-env.sh), which points every cache variable here because `$HOME` is read-only. | No — all reproducible |
| `compatcheck/` | One-off: resolved every member reference PiperSharp 1.0.7 makes against NAudio 3.1.0 to prove zero missing members. | No — the finding is recorded in `analyses/linux-build-audit.md` |
| `parsecheck/` | One-off: ran the real `translations.csv` through `TranslationTools` to validate the parser fixes (3077/3077 rows). | No — the finding is recorded in the audit |
| `*.md` analyses and spike write-ups | Notes the investigation and spike skills leave here. | Deliberately local |

A second scratch directory lived in the retired mono-repo clone: sentence corpora, full-history
bundles, a `.git` copy and a pre-cleanup configuration snapshot. The loose copy was deleted on
2026-10-16; none of it was tracked. Most of it survives in the **2026-10-10 archives** kept beside
the repositories, which hold the corpora under `local_user_files/CSV files/`, both history bundles
and the `.git` backup. Only the pre-cleanup configuration snapshot — purged deliberately, see
`prototype-k-2026-10-10-archive-purge.md` — one capture script and the one-off probe directories
are gone. The pre-split history also survives as ancestors of this repository's own history.

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
| `settings.json` | Shareable project settings — permissions, hooks, whatever the repo agrees on | **Tracked** where it exists: here at the root (the build gate), and in the project repositories that keep one |
| `settings.local.json` | Personal overlay, applied on top of `settings.json`. Per-machine by definition | **Never.** Ignored here and in every project repository |

Their permissions are local only; sharing the file would push one machine's allow-list onto everyone.
`.gitignore` lists `settings.local.json` explicitly *in addition to* the blanket `.claude/` rule, so
that narrowing the blanket rule later (for example to version skills) cannot accidentally expose it.
