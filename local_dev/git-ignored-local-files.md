# Git-ignored files local to this clone

Some working-tree paths are excluded by `.gitignore`. That is **deliberate** in two different ways,
and the reasons matter because "it's ignored" is not the same as "it's disposable".

Rule of thumb: `git status` will **never** show changes to these paths. Use
`git status --ignored` or `git check-ignore -v <path>` to confirm.

## 1. `.claude/` — excluded on purpose, **do not force-add yet**

This tree is ignored because it is **not safe to publish as-is**:

1. **Personal / work configuration.** It has been modified for a work Claude Code setup. It must be
   reviewed and sanitised before any of it can go into a shared repository.
2. **Outdated.** It was written months ago; the owner's practice has moved on since.
3. **The layout has changed.** Claude Code no longer separates user-initiated *commands* from
   model-invoked behaviour — everything now lives under `.claude/skills/`, triggerable by the user or
   by the AI. Directory-scoped skills can also be referenced from another directory or from the root
   instructions (e.g. "read `folderX/CLAUDE.md`, then run the skills in it").

> ⚠️ **Correction:** an earlier revision of this file recommended `git add -f .claude/rules`. That was
> wrong and has been reverted — the files were briefly staged and then removed from the index, and
> the unpushed commit was rewritten so no `.claude` content ever reached the remote. Keep them local
> until they have been sanitised.

Inventory (29 files, none tracked):

| Area | Files | Notes |
| :--- | :---- | :---- |
| `.claude/rules/` | 5 | Convention docs; `CLAUDE.md` refers to them as the conventions source of truth — but they are local, not versioned |
| `.claude/commands/` | 6 | **Legacy shape.** Includes the repo-relevant `/publish` and `/install-net10-runtime` |
| `.claude/skills/` | 12 | Current shape; includes `personal-cc-exporter` |
| `.claude/hooks/` | 3 | bash hooks; `.clinerules` references `pre-commit-build-check.sh` |
| `.claude/lib/` | 1 | `project-env.sh` |
| `.claude/settings.json`, `settings.local.json` | 2 | `settings.json` is empty and nothing is wired |

### Sanitisation checklist for `.claude/`

- **Absolute / machine-specific paths.** `settings.local.json` contains
  `D:/code/GitHub/My/prototype-k/.claude/scripts/statusline.js` — a *different machine's* drive letter,
  and a script that has since been deleted.
- **User, machine and org identifiers** (`makh`, `prototype-k`, drive letters, hostnames).
- **Secrets / tokens / keys** — none found on the last scan, but re-check after edits.
- **References to deleted files.** The CRLF fixers and the statusline script
  (`.claude/scripts/…`) are gone; `personal-cc-exporter` and `settings.local.json` still point at
  `scripts/statusline.js`.
- **Legacy layout.** `commands/` should become `skills/`; when doing that, decide what to do about the
  two repo-relevant skills, since tracked docs (`CsvTranslations/CLAUDE.md`) reference them by name.

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

Review and sanitise first — for `.claude/`, prefer migrating to the current `skills/` layout before
versioning anything. Then:

```bash
git add -f <path>     # force-add despite the ignore rule
```
