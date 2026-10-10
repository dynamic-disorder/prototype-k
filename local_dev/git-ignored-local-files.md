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
   model-invoked behaviour — everything lives under `.claude/skills/`, triggerable by the user or the
   AI. Directory-scoped skills can also be referenced from another directory or from root
   instructions (e.g. "read `folderX/CLAUDE.md`, then run the skills in it").

Current inventory (11 files, none tracked):

| Path | Note |
| :--- | :--- |
| `.claude/skills/*/SKILL.md` (10) | `csharp-conventions`, `csharp-build-verify`, `csharp-refactor`, `explain`, `git-commit`, `unit-test-writer`, `issue-investigate`, `spike`, `publish`, `install-net10-runtime` |
| `.claude/settings.local.json` | Local permission allow-list only |

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

The pre-cleanup state is preserved at `local_user_files/claude-config-pre-cleanup-20261010-160731/`.

## 2. Ignored *but* tracked — already public, same review applies

Force-added before the policy above was remembered, so these **are in the remote history** and deserve
the same review as `.claude/`:

- `.clinerules`
- `CsvTranslations/.claude/commands/build.md`
- `CsvTranslations/.claude/rules/windows-development.md`
- `CsvTranslations/.claude/settings.json`
- `FilenameTools/.claude/commands/build.md`
- `FilenameTools/.claude/rules/filename-sanitization.md`
- `FilenameTools/.claude/settings.json`

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

## 4. Ignored dev tooling worth keeping (`local_user_files/`)

Scratch tooling built during the migration. Not versioned, but genuinely reusable.

| Tool | Purpose |
| :--- | :------ |
| `local_user_files/ildump/` | Dumps a .NET assembly's declared types and members **with accessibility**, straight from IL metadata. Used to show that reference assemblies keep public members of internal types but strip `internal` ones — the reason `InternalsVisibleTo` alone doesn't let tests call internal helpers. |
| `local_user_files/compatcheck/` | Resolves every member reference a precompiled binary makes (including generic type-specifications) against a set of assemblies. Used to prove PiperSharp 1.0.7 still binds against NAudio 3.1.0 with zero missing members. |
| `local_user_files/parsecheck/` | Parses the repository's real `translations.csv` through `TranslationTools` and reports languages, entry types and row counts. Used to validate the parser fixes against real data (3077/3077 rows). |
| `local_user_files/nuget/env.sh` | Pre-existing. Redirects NuGet package/HTTP caches into the repo, because the agent sandbox mounts `$HOME` read-only. Source it before any `dotnet` command. |

```bash
source local_user_files/nuget/env.sh
dotnet run --project local_user_files/ildump/ildump.csproj -- <assembly.dll> [typeFullName]
```

## Removed during this work

All untracked, so unrecoverable from git — deliberately, they enforced the abandoned CRLF policy:

- `.claude/scripts/*.ps1` — 7 line-ending / string-literal fixers
- `.claude/hooks/normalize-line-endings.ps1` **and** `.sh`

Two rule files (`csharp-conventions.md`, `repository-structure.md`) were found with **CRLF** endings —
leftovers from that same policy. They were normalised to LF, and a scan now reports **zero CRLF text
files** in the working tree. That fix stands regardless of whether the files are ever versioned.

## Persisting any of this

`.claude/` has now been sanitised, so versioning it is a legitimate choice — it is currently kept
local by preference, not because it is unsafe. If you do version it:

```bash
git add -f .claude/skills          # force-add despite the ignore rule
```

Add `settings.local.json` only if you want the local permission list shared; it is per-machine by
design. The rest of the entries in this file (per-machine IDE state, scratch tooling) should stay
untracked.
