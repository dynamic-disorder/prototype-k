# Umbrella → template and neutral agents export

| | |
| :--- | :--- |
| **Need** | `prototype-k` still holds the project, its scratch and its tooling, and the agent configuration exists as six vendoried copies that drift. Neither can serve as the one configuration you install on an empty machine. |
| **Why** | One canonical home, installed by links, is the only arrangement where a rule learned once is the rule every repository runs, and where the hackathon bundle is the same bytes as the machine you work on. |
| **What** | Merge `agent-skills` into `prototype-k`, delete every vendored copy, move the project out as `csv-translations` with only what it owns, and build an export from the single home. |
| **DoD** | No repository carries a shared skill, hook or style copy; every repository's commits run the same machine-level hook; `~/.agents/skills` points at one checkout; the export installs into a throwaway home and passes `--check`. |
| **Top risk** | A vendored copy survives in a directory nobody checked, and the next rule edit silently skips that repository. Fixed by the deletion inventory, verified with `git ls-files`. |

**TL;DR** — Stop copying. One checkout owns the skills, hooks and style; every repository gets them through links installed once per machine; the project leaves with only its own files.

## Target state

```
$DYNAMIC_DISORDER_ROOT/
  prototype-k/             # umbrella, template, single source of agent config
    AGENTS.md  README.md  docs/
    .agents/skills/        # canonical skills
    .agents/hooks/         # canonical harness hook
    .githooks/             # canonical git gate
    global/  output-style/ # rules and style blocks, with installers
    scripts/               # install, export, publication scanner
    .editorconfig  Directory.Build.props  .gitattributes  .gitignore
  csv-translations/        # the project, moved out; no agent copies
    AGENTS.md  LICENSE  CsvTranslations.sln  README.md
    .editorconfig  Directory.Build.props  .gitattributes  .gitignore
    local_dev/  local_user_files/  <projects>/  scripts/  translations.csv
  cliutils/  filenametools/  mediarenamer/  snaerf/
                           # project files only; no .agents/skills, no .githooks
```

Machine-level, installed once and identical on Windows and Omarchy:

```
~/.agents/AGENTS.md          shared rules + style blocks
~/.agents/skills/<name>   -> prototype-k/.agents/skills/<name>
~/.agents/hooks           -> prototype-k/.agents/hooks
~/.agents/scripts         -> prototype-k/scripts
~/.agents/githooks        -> prototype-k/.githooks
git config --global core.hooksPath  ->  ~/.agents/githooks
~/.claude/CLAUDE.md          one import line: @~/.agents/AGENTS.md
~/.claude/skills          -> ~/.agents/skills
```

## The rule

- **One physical copy of the common configuration.** Skills, hooks, rules, style and drafting instructions
  live in `prototype-k` and nowhere else.
- **Repositories carry project instructions only.** A project's `AGENTS.md` says what is true of that
  project; it does not restate the shared rules, and it does not carry a skill the other repositories use.
- **A project-specific skill or command may stay in its repository** only when no other repository can
  use it. `snaerf`'s engineering-standards skill is the example. Everything shared is deleted from the
  repository.
- **Hooks are machine-level.** `core.hooksPath` points at the canonical hooks once; repositories have no
  `.githooks` and no `core.hooksPath` of their own.
- **Memory is machine-level.** No checkout carries a memory directory today; the rule keeps it that way.

## Decisions

| # | Decision | Why |
| :--- | :--- | :--- |
| D1 | `prototype-k` is the single home: merge `agent-skills` into it, then archive `agent-skills`. | Two homes means one of them is stale. The umbrella is what you carry; the tool repository is redundant once its files live there. |
| D2 | Delete the vendoring machinery: `sync.json`, `sync-lock.json`, `scripts/sync-skills.mjs`, and the hook's drift check. | They exist to keep copies identical. With no copies, they are the mechanism of the problem. |
| D3 | Hooks and scripts become machine-level links under `~/.agents`, wired by one global `core.hooksPath`. | A repository should not need a hook file to be gated; a new clone is gated by being on the machine. |
| D4 | Project-specific entries are kept; shared ones are deleted. | `snaerf`'s standards skill and `filenametools`' rule are not copies; the seven-skill sets in three repositories are. |
| D5 | The export builds from the single home and installs by link, never by copy. | The bundle on the USB stick is the same bytes the working machine runs, not a snapshot that diverges. |
| D6 | `local_dev/` and `local_user_files/` are classified before moving: project parts go with the project, machine and umbrella notes stay. | `local_dev/TODOS.md` is CliUtils follow-ups, and the mount notes carry literal mount paths; moving them into a project repository misplaces both. |
| D7 | The export never contains credentials or harness logins. | A USB stick with keys cannot be rotated in time. |
| D8 | A DSH plugin is an optional adapter, never the source of the configuration. | The configuration must load in any harness that reads `AGENTS.md`; a plugin is DSH-only and would be the only copy on a machine without it. |

**Why this is not a DSH plugin.** DSH already implements instructions, skills, commands and hooks as
plugins that read directories and settings — `agent-instructions`, `skill-filesystem`, `commands`, and the
hook bridge. A plugin carrying the same rules would be a second implementation, and it would load in no
other harness. The split:

| Rule | Layer | Why |
| :--- | :--- | :--- |
| Answer shape, recap order, commit approval, follow-ups | Prompt | Judgment; no code decides whether a report is honest |
| Never read the credential file | Hook | Deterministic, and the loss is irreversible |
| No machine path in a commit | Hook (scanner) | Already code, already runs |
| Build before commit | Hook | Already code |
| Skills, commands, instructions | Files plus links | Every harness reads them; a plugin only re-registers them |

A plugin earns its place only as a thin adapter: register the canonical root, add `/commit`, `/export` and
`/install`, wire the two guards. It copies nothing, and removing it loses no configuration. Build it after
the merge, not before: DSH is `0.2.2-rc.1`, and the checkout path recorded in the session context no longer
resolves — the API is still moving.

## Phase 1 — one home, no copies

Run from `$DYNAMIC_DISORDER_ROOT/prototype-k`. Start when the tree is clean.

1. **Merge `agent-skills` into the umbrella.**

   ```bash
   git -C ../agent-skills archive -o ../agents-copy.tar HEAD
   tar -xf ../agents-copy.tar
   rm ../agents-copy.tar
   ```

   This adds `.agents/skills/` (the nine), `global/`, `output-style/` and `scripts/`. The eight skills
   `prototype-k` already had are byte-identical, so the copy is a no-op for them.

2. **Move the scanner and the hook to their canonical places.** `git mv local_dev/scripts/scan-publication-leaks.sh scripts/`
   and derive its `SELF` from its own location (the pattern list must still skip the file itself). Edit
   `.githooks/pre-commit` to call `"$HOME/.agents/scripts/scan-publication-leaks.sh"` and
   `"$HOME/.agents/hooks/pre-commit-build-check.sh"`. Delete the sync-drift block from the build gate:
   there is nothing left to sync. Update the canonical `git-commit` skill to name that machine-level
   scanner path, and the root variable without assuming `local_dev/scripts/repo-env.sh` exists in every
   repository.

3. **Extend `scripts/install-global.mjs`.** It already links `~/.agents/skills`; add:

   | Link | Target |
   | :--- | :--- |
   | `~/.agents/hooks` | `<repo>/.agents/hooks` |
   | `~/.agents/scripts` | `<repo>/scripts` |
   | `~/.agents/githooks` | `<repo>/.githooks` |
   | `~/.claude/skills` | `~/.agents/skills` (only when `~/.claude` exists) |

   Then write `git config --global core.hooksPath <absolute ~/.agents/githooks>` and verify it in
   `--check`. Compute the absolute path; do not rely on `~` expansion in git config.

4. **Switch this machine to the new home.**

   ```bash
   node scripts/install-global.mjs --write
   node scripts/install-global.mjs
   node global/install.mjs
   node output-style/install.mjs
   git config --global core.hooksPath "$HOME/.agents/githooks"
   ```

   `readlink ~/.agents/skills/git-commit` must now name the `prototype-k` checkout.

5. **Delete the vendored copies, one repository at a time**, each its own commit:

   | Repository | Remove | Keep |
   | :--- | :--- | :--- |
   | `cliutils` | `.agents/skills/` (7), `.agents/hooks/`, `.githooks/` | `AGENTS.md` |
   | `filenametools` | `.agents/skills/` (8), `.agents/hooks/`, `.githooks/`, `.agents/commands/build.md`, `.agents/rules/` after folding the rule into `AGENTS.md` | `AGENTS.md` |
   | `mediarenamer` | `.agents/skills/` (7), `.agents/hooks/`, `.githooks/` | `AGENTS.md` |
   | `snaerf` | `.dsh/hooks/` (a second copy of the build gate), `.agents/commands/` if no harness reads that path | `.agents/skills/snaerf-engineering-standards/`, `AGENTS.md` |
   | `prototype-k` | nothing — it is the home | everything |

   In each repository, `git config --local --unset core.hooksPath` first, or the local setting keeps
   running the deleted hook and the global one never fires. Then commit; the shared gate runs and prints
   `PASS`.

6. **Delete the sync machinery** from the home: `sync.json`, `sync-lock.json`, `scripts/sync-skills.mjs`.
   The build gate no longer references them.

7. **Verify the absence, not the intention.**

   ```bash
   for r in cliutils filenametools mediarenamer snaerf; do
     printf '%s: %s shared files\n' "$r" "$(git -C ../$r ls-files '*.agents/skills/*' | wc -l)"
   done
   git -C ../cliutils config --local --get core.hooksPath || echo "no local override"
   git config --global --get core.hooksPath
   readlink ~/.agents/skills/git-commit
   ```

   Expected: only `snaerf` lists a skill, no repository has a local `core.hooksPath`, the global one is
   set, and every link resolves into `prototype-k`.

8. **Archive `agent-skills`** once the links and the export are green: archive the GitHub repository and
   remove the checkout. Nothing reads it after step 4. This is a separate, final action.

## Phase 2 — the export

1. **Add `scripts/export-agents.mjs`** and a pure `scripts/lib/export-plan.mjs` (file list, exclusions,
   leak check) with `node:test` coverage.

   | Mode | Behaviour |
   | :--- | :--- |
   | `--out <dir>` | Write the bundle, default `dist/agents-export` |
   | `--check` | Rebuild and compare file lists and hashes; report drift, never write |
   | `--archive` | Also write `dist/agents-export-<date>.tar.gz` |

2. **Bundle layout.** One install part, one project seed:

   ```
   agents-export/
     README.md              # prerequisites, install commands, new-project steps
     MANIFEST.json          # relative path + sha256
     global/                # AGENTS.shared.md, install.mjs, README.md
     output-style/          # managed-block.md, documentation-style.md, install.mjs, README.md
     scripts/               # install-global.mjs, scan-publication-leaks.sh, lib/managed-block.mjs, lib/install-block.mjs
     githooks/pre-commit
     .agents/skills/        # the canonical skills
     .agents/hooks/         # pre-commit-build-check.sh
     docs/agents/           # skill-authoring specs
     claude/CLAUDE.md       # @~/.agents/AGENTS.md
     project-seed/          # AGENTS.md, .editorconfig, Directory.Build.props, .gitattributes, .gitignore
   ```

   Excluded: `sync.json`-era files, `deck-card-video-generate` (its `node_modules/` is untracked), every
   `node_modules/` and `test-results/`, `dist/`, `.git/`, `local_user_files/`, and any harness state.

3. **Prove the install path**, not just the files:

   ```bash
   cp -R agents-export ~/agent-config
   cd ~/agent-config
   node global/install.mjs && node output-style/install.mjs
   node scripts/install-global.mjs --write
   node global/install.mjs --check && node output-style/install.mjs --check && node scripts/install-global.mjs
   ```

   Then repeat it in a clean Linux container with Node, so case, junction and permission problems surface
   here and not on the hackathon laptop.

4. **Leak check and archive.** The export scans its text files for profile paths, mount roots and home
   directories, skipping the scanner itself. `tar -czf dist/agents-export-<date>.tar.gz -C dist agents-export`.

## Phase 3 — move the project out

1. **Classify the two folders before moving anything.**

   | Item | Destination | Why |
   | :--- | :--- | :--- |
   | `local_dev/scripts/` (`build-all`, `repo-env`, `sandbox-env`, `publish`, `install-net10-runtime`, token estimate, VS Code cleaner, `repo_paths`) | `csv-translations` | They run the project |
   | `local_dev/tools/ildump/` | `csv-translations` | It inspects the project's assemblies |
   | `local_dev/analyses/tts_analysis.md` | `csv-translations` | It is about the project |
   | `local_dev/TODOS.md` | stay in the umbrella, or move to `cliutils` | It is a CliUtils release list |
   | `local_dev/deepseek-harness.md`, `git-ignored-local-files.md`, `README.md` | stay in the umbrella | Machine and umbrella documentation |
   | `local_dev/plans/` | stay in the umbrella | Dated records about the umbrella |
   | `local_user_files/*.md` project analyses | `csv-translations` | Project evidence |
   | `local_user_files/omarchy-mount-notes.md`, both OS startup checklists, `handoff-2026-10-31-prototype-k.md` | stay in the umbrella | Machine and umbrella notes; they carry mount paths |

2. **Give the project its build layer**: copy `.editorconfig`, `Directory.Build.props`, `.gitattributes`,
   `LICENSE`, and write its `.gitignore` (artifacts, `publish/`, models and Piper, `local_user_files/`,
   `.agents`). No `.agents`, no `.githooks`, no scanner: the machine provides them.

3. **Fix the path assumptions the move invalidates**: `repo_paths.translations_csv()` drops the
   `CsvTranslations/` segment; the four data scripts use `parents[1]`; `publish-selfcontained.mjs` drops
   the prefix from its four project paths; the `repo-env.ps1` example follows.

4. **Move in one pass, one umbrella commit.**

   ```bash
   mv CsvTranslations ../csv-translations
   mv local_dev/scripts ../csv-translations/local_dev/scripts   # after the classification above
   git add -A -- CsvTranslations local_dev local_user_files
   ```

5. **Rehearse the standalone checkout** in a filtered copy: build, test, publish `AddEntryApp`, print
   `repo_paths.py`, and confirm no machine path or ignored asset is tracked. Expected: green, with the
   gate supplied by the machine rather than the repository.

## Phase 4 — the umbrella documents

Rewrite `AGENTS.md` and `README.md` for a template with no product code; update `docs/README.md`; add
`csv-translations` to `dynamic-disorder.code-workspace`; run the gate and the link check.

## Risks

| Risk | Mitigation |
| :--- | :--- |
| A copy survives and keeps teaching an old rule | Phase 1's `git ls-files` loop; a copy that is not tracked is caught by the rehearsal's `--all` scan |
| A repository keeps a local `core.hooksPath` and skips the new gate | The local `--unset` step, verified with `git config --local --get` |
| Global hooks fire in unrelated repositories | The gate exits 0 when nothing is staged, and the build gate needs staged C#; the machine-level choice is documented |
| Machine notes move into a project repository | The Phase 3 classification table; mount-path notes stay in the umbrella |
| `~/.claude/skills` link missing, so Claude Code sees no skills | The installer creates it and `--check` reports it |
| The merge leaves `agent-skills` referenced somewhere | `readlink` of every link, plus the global hooks path, checked before archiving |
| Export drifts from the working install | The bundle is built from the same files and installed by link; `--check` recomputes hashes |

## Out of scope

- Creating the `csv-translations` remote and its first push.
- Renaming the solution or project directories.
- Deleting `agent-skills` history; the repository is archived, not rewritten.
- Carrying credentials, session state or model configuration.

## How to start

```
Read docs/plans/2026-11-11_umbrella-to-template-and-agents-export-plan.md in prototype-k and execute
Phase 1 only. Follow the commit rule in ~/.agents/AGENTS.md: draft, ask, wait. One repository per commit.
```
