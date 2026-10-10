# Git-ignored files local to this clone

Some working-tree files live under paths that `.gitignore` excludes, so they are **not versioned**
and a fresh clone (or another machine) will not have them. This index records what exists, what
changed during the .NET 10 migration work, and how to persist it if it matters.

Rule of thumb: `git status` will **never** show changes to these paths. Use
`git status --ignored` or `git check-ignore -v <path>` to confirm.

## 1. Ignored *and* untracked — local only

Nothing here is in git. Recreating these means re-doing the edit.

| Path | What it is | Changed in this work |
| :--- | :--------- | :------------------- |
| `.claude/commands/install-net10-runtime/SKILL.md` | `/install-net10-runtime` slash command | Renamed from `install-net9-runtime/`; front-matter `name`, .NET 10 wording, points at `install-net10-runtime.ps1` |
| `.claude/commands/publish/SKILL.md` | `/publish` slash command | Renamed `publish-net9/` → `publish-net10/` → `publish/`; now version-agnostic and points at the Node wrapper `publish-selfcontained.mjs` |
| `.claude/rules/csharp-build-verification.md` | Build-verification conventions | `net9.0` execution bullet → `net10.0` / no roll-forward; corrected the stale claim that `core.ignorecase=true` (it is `false`) |
| `CsvTranslations/OllamaTranslatorApp/Properties/launchSettings.json` | VS launch profile | `workingDirectory` `bin\Debug\net9.0` → `net10.0` |

> **Heads-up:** root `CLAUDE.md` points at `.claude/rules/` as the *single source of truth* for
> conventions, but that directory is ignored — so those conventions are not actually versioned.
> Either force-add them (`git add -f .claude/rules`) or stop calling them the source of truth.

## 2. Ignored *but* tracked — versioned, with a trap

These are force-added despite matching `.gitignore`. Edits to them **do** get committed normally,
but a *new* file created inside one of those directories is silently skipped by `git add -A` and
needs `git add -f`.

- `.clinerules`
- `CsvTranslations/.claude/commands/build.md`
- `CsvTranslations/.claude/rules/windows-development.md`
- `CsvTranslations/.claude/settings.json`
- `FilenameTools/.claude/commands/build.md`
- `FilenameTools/.claude/rules/filename-sanitization.md`
- `FilenameTools/.claude/settings.json`

This trap already bit once: three tracked files under `FilenameTools/.claude/` were nearly dropped
by a directory rename (see `analyses/linux-build-audit.md`).

Checking whether a path is tracked before trusting either list:

```bash
git ls-files | grep -E '\.claude/|\.clinerules|launchSettings'   # tracked
git check-ignore -v <path>                                       # which rule ignores it
```

## 3. Ignored dev tooling worth keeping (`local_user_files/`)

Scratch tooling built during the migration. Not versioned, but genuinely reusable.

| Tool | Purpose |
| :--- | :------ |
| `local_user_files/ildump/` | Dumps a .NET assembly's declared types and members **with accessibility**, straight from IL metadata. Used to show that reference assemblies keep public members of internal types but strip `internal` ones — the reason `InternalsVisibleTo` alone doesn't let tests call internal helpers. |
| `local_user_files/compatcheck/` | Resolves every member reference a precompiled binary makes (including generic type-specifications) against a set of assemblies. Used to prove PiperSharp 1.0.7 still binds against NAudio 3.1.0 with zero missing members. |
| `local_user_files/parsecheck/` | Parses the repository's real `translations.csv` through `TranslationTools` and reports languages, entry types and row counts. Used to validate the parser fixes against real data (3077/3077 rows). |
| `local_user_files/nuget/env.sh` | Pre-existing. Redirects NuGet package/HTTP caches into the repo, because the agent sandbox mounts `$HOME` read-only. Source it before any `dotnet` command. |

Run any of them with:

```bash
source local_user_files/nuget/env.sh
dotnet run --project local_user_files/ildump/ildump.csproj -- <assembly.dll> [typeFullName]
```

## Persisting any of this

```bash
git add -f <path>     # force-add despite the ignore rule
```

Prefer that over editing `.gitignore` when only a few specific files should be tracked — the
`.claude/` ignore keeps genuinely personal config out, and force-adding is the established
pattern in this repo (section 2 above).
