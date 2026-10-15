# Consolidation & multi-repository split plan

**Status:** approved 2026-10-15 · **Scope:** this mono-repo and its meta layer

## Executive summary

| | |
| :--- | :--- |
| **Problem** | One repository carries five unrelated projects, a per-machine agent/harness layer, and personal notes. One `.gitignore`, one build gate and one instruction tree serve all of it, and two areas need different visibility. |
| **Value** | Per-project visibility (start with private `ai_offline`), independent history and issues, a `.gitignore` per project, and a smaller AI-context per repo. |
| **Change** | Three phases: (1) cleanup in place, (2) consolidation of the root/meta layer, (3) split into five project repositories plus a thin umbrella. |
| **Verify** | `./local_dev/scripts/build-all-linux.sh --test` after each phase, a link/reference sweep, and a fresh-clone check per new repository before its first push. |

The current history is a **single import commit** plus three small doc/cfg commits, so the split needs
**no history rewrite** — it is a copy-and-init, not a `filter-repo` job.

## Decisions (2026-10-15)

| ID | Decision | Consequence |
| :--- | :--- | :--- |
| **D1** | `CliUtils` becomes **its own repository and a NuGet package**; consumers switch from `ProjectReference` to `PackageReference` | 8 reference edges in 7 `.csproj` files are rewritten; `CliUtils` gains packaging metadata and a release step; every consuming clone needs the feed configured |
| **D2** | `csv-translations`, `filenametools`, `mediarenamer` are **public**; `ai_offline` is **private** | The Finnish dictionary and CSV corpora are published — accepted |
| **D3** | `prototype-k` becomes a **thin public umbrella** (README linking the split repos, no code) | Existing links keep working; the umbrella hosts the cross-project summary |
| **D4** | **No `dev-config` repo** — the meta layer is duplicated per project repository, trimmed to what that repo needs | Skills, tooling and notes are copied 4-5×; each copy must be kept in sync by hand |

## 1. Inventory (evidence)

| Area | Tracked files | Notes |
| :--- | ---: | :--- |
| `CsvTranslations/` | 142 | 13 projects, the dictionary (212 KB `translations.csv`), Windows-only TTS |
| `FilenameTools/` | 38 | 3 projects, own 60-line `.gitignore` |
| `ai_offline/` | 33 | Docker stacks, GPU/RAM guides, Cline/Ollama model notes |
| `local_dev/` | 19 | 7 scripts, 4 tools files, 2 analyses, 3 plans, 4 references |
| `MediaRenamer/` | 17 | 3 projects, WPF (runs on Windows only) |
| `.agents/skills/` | 10 | repo-specific skills, shared by Claude Code via a symlink |
| `CliUtils/` | 7 | library, **no solution**, one consumer |
| `memory/` | 4 | durable notes |
| `.github/`, `.claude/`, `.vscode/`, `.githooks/` | 3 + 2 + 1 + 1 | instruction/gate files |
| root files | 12 | `.editorconfig` (24 KB), `Directory.Build.props`, README, CLAUDE, launchers |
| `translations_csv/` | 2 | stub — backlog item 1 |
| `local_user_files/` | 1 | scratch README only |

**Coupling map** (the only cross-project edge is about to become a package edge):

```text
CsvTranslations ──8 ProjectReference edges──▶ CliUtils   → becomes PackageReference
FilenameTools   ─── internal only
MediaRenamer    ─── internal only
ai_offline      ─── docs only (links to the translator app)
```

`Directory.Build.props` at the root is **byte-identical** to `CsvTranslations/Directory.Build.props`.

## 2. Phase 1 — cleanup in place (no structural moves)

| # | Item | Status |
| ---: | :--- | :--- |
| 1 | `translations_csv/` stub + 24 stale references | **Done** (`3d95c00`): stub deleted, references retargeted, dead `TryEntryAssemblyPath` removed |
| 2 | `memory/README.md` stale index | **Done**: now points at `omarchy-tool-substitutions.md` |
| 3 | Misplaced documents inside code projects | **Done**: the raw AddEntryApp analysis left the repo (kept in `local_user_files/`); the TTS hosting/DI note moved to `local_dev/plans/tts-hosting-and-di-notes.md` |
| 4 | Duplicate Ollama guides | **Open** — see below |
| 5 | `.claude/commands/build.md` files | **Not an issue**: the `!`-prefixed lines are slash-command execution, not stale snapshots; only the test counts were stale and are now corrected |
| 6 | Duplicated build props | **Deferred**: the files are identical, but every repo gets its own copy at split time, so deduping now is churn |

### Item 4 — why the guides are not merged yet

`ai_offline/ollama-integrations-with-claude-code-2026-07-10.md` is a superset of the undated file
**except** for two things it lacks: the environment-variable explanations
(`CLAUDE_CODE_ATTRIBUTION_HEADER`, `CLAUDE_CODE_BLOCKING_LIMIT_OVERRIDE`,
`CLAUDE_CODE_MAX_OUTPUT_TOKENS`) and the `ministral-3` pull/launch commands. The two also disagree
about the machine:

| | Undated file | Dated (2026-07-10) file |
| :--- | :--- | :--- |
| VRAM | 12 GB | 24 GB (2× 12 GB) |
| System RAM | 96 GB DDR3 | ~48 GB |
| CPU | dual Xeon E5-2690 v2 | Xeon E5-2660 v4 |

Merging needs to know which spec is current; until then both files stay.

Verification: `./local_dev/scripts/build-all-linux.sh --test` + `ai-context-token-estimate.mjs`.

## 3. Phase 2 — consolidation of the root/meta layer

Because D4 rejects a shared config repo, the layer model is **template + per-repo copy**:

| Layer | Lives in | Contents |
| :--- | :--- | :--- |
| **Project-owned** | each project repo | code, `README.md`, `CLAUDE.md`, `.gitignore`, `.gitattributes`, `.editorconfig`, `Directory.Build.props`, its own `.github/copilot-instructions.md` |
| **Copied scaffolding** | every project repo, trimmed | the `local_dev/scripts/` pairs a repo actually uses, the relevant `.agents/skills/` subset, the build-gate hook if the repo wants it |
| **Durable notes** | every repo that needs them, trimmed | `memory/` entries relevant to that repo |
| **Personal scratch** | `local_user_files/` (git-ignored) | never a migration source; the 2026-10-10 archives remain the backup of record |

Consolidation rules:

1. **Root of a project repo holds only** `README.md`, `CLAUDE.md`, `.gitignore`, `.gitattributes`,
   `.editorconfig`, `Directory.Build.props`, the source folders, and optionally `.github/`.
2. **The 30 KB `local_dev/Claude_Code_*guide*.md` vendor reference leaves the repositories** — it is
   third-party material, not repo context; keep it outside git or drop it.
3. **Plans are archived on completion**; finished plans do not stay as AI context in a repo.
4. **Box-level notes** (`memory/omarchy-tool-substitutions.md`) describe this machine, not a project.
   Under D4 they would be copied into every repo; recommend keeping such notes user-global
   (`~/.claude/`) and copying only project-level notes. *Confirm before Phase 2.*
5. **Every cross-layer link is rewritten.** `FilenameTools/CLAUDE.md`, `CsvTranslations/CLAUDE.md`,
   `ai_offline/CLAUDE.md` and the root `CLAUDE.md` all point into `../local_dev/…` today.

## 4. Phase 3 — multi-repository target

| Repository | Contents | Visibility | Depends on |
| :--- | :--- | :--- | :--- |
| `cliutils` | `CliUtils/**` + `PackageId`, `Version`, `RepositoryUrl`; pack + push release step | public | — |
| `csv-translations` | `CsvTranslations/**` (no `CliUtils` folder) | public | `CliUtils` **package** |
| `filenametools` | `FilenameTools/**` | public | — |
| `mediarenamer` | `MediaRenamer/**` | public | — |
| `ai-offline` | `ai_offline/**`, `Modelfile`, `cc.cmd` | **private** | — |
| `prototype-k` | thin umbrella README linking the above; cross-project docs | public | — |

**Open sub-decision (D1a): which NuGet feed.** GitHub Packages (`nuget.pkg.github.com`) requires a
PAT for **restore** even though the packages are public, which adds friction to every clone and to
CI; nuget.org needs no auth to consume but publishes globally and permanently; a committed local
`packages/` folder avoids any feed but puts binaries in git.

Per-repo `.gitignore` (customized, not copied wholesale):

| Repository | Must ignore |
| :--- | :--- |
| `cliutils` | `[Bb]in/`, `[Oo]bj/`, `.vs/`, `*.user`, `*.nupkg` (keep the package output out of git) |
| `csv-translations` | `[Bb]in/`, `[Oo]bj/`, `.vs/`, `*.user`, `launchSettings.json`, `/publish/`, `TextToSpeechApp/models/`, `TextToSpeechApp/piper/`, generated CSV outputs |
| `filenametools` | its existing 60-line file, plus `/publish/` |
| `mediarenamer` | `[Bb]in/`, `[Oo]bj/`, `.vs/`, `*.user`, `/publish/` |
| `ai-offline` | `**/open_webui_data/*` (+ README negation), real `.env` files, `**/ollama_data/`, `**/models/` |
| `prototype-k` | `local_user_files/`, `.claude/` (with the shared-path negations already in place) |

## 5. Phase 4 — split mechanics

`CliUtils` first, so its package exists before its consumer is split:

```bash
# 1. cliutils: own repo, packaged
mkdir cliutils && cd cliutils && git init -b main
# copy CliUtils/**, add .gitignore, .gitattributes, .editorconfig, Directory.Build.props,
# README.md, CLAUDE.md, LICENSE, and PackageId/Version/RepositoryUrl metadata
dotnet pack -c Release
gh repo create dynamic-disorder/cliutils --public --source . --push

# 2. each consumer repo: copy subtree, swap the reference, verify, push
<PackageReference Include="CliUtils" Version="x.y.z" />   # replaces the ProjectReference
dotnet build && dotnet test
gh repo create dynamic-disorder/<repo> --public|--private --source . --push

# 3. prototype-k: strip code, keep the umbrella README
```

Guards before the first push of each repo:

- `git ls-files` reviewed against an exclusion list (`local_user_files/`, `.venv/`, `bin`, `obj`,
  `models/`, `piper/`, `publish/`, real `.env` files).
- Build and tests green on this box.
- No `../local_dev/…` or `../CliUtils/…` references left in code, docs or `.csproj` files.
- For `csv-translations`: `CliUtils` resolves from the feed, not from a sibling folder.

## 6. Risks

| Risk | Mitigation |
| :--- | :--- |
| NuGet feed auth blocks restores on a fresh clone | Decide D1a with that cost in mind; prefer a feed that needs no auth for a public library |
| `CliUtils` version drift between its repo and `csv-translations` | Tag releases; bump the `PackageReference` deliberately; never reference a project path |
| Publishing the dictionary by accident | `git ls-files` review before the first push (D2 accepted public, so this is about unintended files, not the CSV itself) |
| D4 duplicates the meta layer 4-5× | Keep each copy minimal; box-level notes stay user-global (rule 4); revisit `dev-config` if the duplication starts to hurt |
| Cross-repo links break in ~6 docs and several `CLAUDE.md` files | Sweep for `local_dev/`, `CliUtils/`, `translations_csv/` strings after each move |
| AI-context cost multiplies across repos | Per-repo instructions trimmed to the project |
| Windows-only projects cannot run here | Per-repo verification is build/test on Linux only; document the Windows runtime step |
