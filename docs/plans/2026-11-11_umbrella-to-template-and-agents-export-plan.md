# Umbrella → template and neutral agents export

| | |
| :--- | :--- |
| **Need** | `prototype-k` still holds the project, its scratch and its tooling, and the agent configuration exists as six vendoried copies that drift. Neither can serve as the one configuration you install on an empty machine. |
| **Why** | One canonical home, installed by links, is the only arrangement where a rule learned once is the rule every repository runs, and where the hackathon bundle is the same bytes as the machine you work on. |
| **What** | Merge `agent-skills` into `prototype-k`, delete every vendored copy, move the project out as `csv-translations` with only what it owns, and build an export from the single home. |
| **DoD** | No repository carries a shared skill, hook or style copy; every repository's commits run the same machine-level hook; `~/.agents/skills` points at one checkout; the export's tree passes `--check`, and a copy of it installs into a throwaway home with its hooks and scripts green. |
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

Machine-level. The working machine reads the checkout through links; the portable machine runs the export,
which is the same tree copied to the same root:

```
# working machine (links into the checkout)
~/.agents/AGENTS.md          shared rules + style blocks
~/.agents/skills/<name>   -> prototype-k/.agents/skills/<name>
~/.agents/hooks           -> prototype-k/.agents/hooks
~/.agents/scripts         -> prototype-k/scripts
~/.agents/githooks        -> prototype-k/.githooks
git config --global core.hooksPath  ->  ~/.agents/githooks

# portable machine (the export, as its setup guide installs it)
%USERPROFILE%\.agents\
  AGENTS.md  settings.json  rules/  skills/  scripts/  hooks/  lib/  reference/
```

The export inspected for this plan carries no `CLAUDE.md`: its `settings.json` addresses `$HOME/.agents/...`
directly, and its setup guide copies the tree into `%USERPROFILE%\.agents\`. The plan follows that shape;
a `~/.claude/CLAUDE.md` pointer is legacy, not part of the target.

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
| D5 | The working machine reads the canonical files through links; the portable export is that tree copied to `~/.agents`, regenerated, never edited. | One set of files, two views: the live checkout and the snapshot that travels. |
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

## Phase 2 — the portable export

The reference artifact is the `.agents-generic-<date>` folder the export process writes; the 2026-11-12
copy was inspected for this plan:

```
.agents-generic-<date>/
  AGENTS.md                    # the global rules, one file
  settings.json                # Claude Code settings; hooks and statusline point at $HOME/.agents
  rules/                       # 6 rules
  skills/                      # 16 skills with their scripts and references
  scripts/  hooks/  lib/       # what the skills and hooks call
  reference/                   # 7 references
  agent_model_strategy.md  claude_environment_variables.md  setup_agent_guide.md
  claude_placeholder_values.txt
```

There is no `CLAUDE.md` and no `~/.claude` layer. The bundle keeps this shape; `README.md` and
`MANIFEST.json` are the only additions, plus `project-seed/` for a new repository.

1. **Add `scripts/export-agents.mjs`** and a pure `scripts/lib/export-plan.mjs` (file list, exclusions,
   leak check) with `node:test` coverage.

   | Mode | Behaviour |
   | :--- | :--- |
   | `--out <dir>` | Write the tree, default `dist/.agents-generic-<date>` |
   | `--check` | Rebuild and compare file lists and hashes; report drift, never write |
   | `--archive` | Also write the matching `.tar.gz` |

2. **Generate the tree from the canonical home.** `AGENTS.md` is the canonical rules without the machine
   notes; `rules/`, `scripts/`, `hooks/`, `lib/` come from the checkout; `settings.json` is the export's,
   which holds model names and hook wiring, never credentials; `project-seed/` holds `AGENTS.md`,
   `.editorconfig`, `Directory.Build.props`, `.gitattributes` and `.gitignore`. The import skill must have
   run first: the export's 16 skills and 6 rules are its output, not `agent-skills`'s.

3. **Refuse the files the export carries and the configuration must not**: `claude_placeholder_values.txt`,
   `lib/repo-env-db.{sh,md}`, `lib/repo-env-github.{sh,md}`, `reference/git_commit_secret_scan_allowlist.txt`,
   `scripts/windows-credential-store.ps1` and its `-lib.mjs` / `.mjs` siblings.

4. **Prove the install path**, not just the files:

   ```bash
   tmp="$(mktemp -d)"
   cp -R dist/.agents-generic-<date> "$tmp/.agents"
   node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'))" "$tmp/.agents/settings.json"
   find "$tmp/.agents" -name '*.mjs' -exec node --check {} \;
   find "$tmp/.agents" -name '*.sh'  -exec bash -n {} \;
   HOME="$tmp" bash "$tmp/.agents/hooks/pre-commit-build-check.sh" </dev/null
   ```

   Expected: the JSON parses, every script passes its syntax check, the hook exits 0 with no payload, and
   the export's own leak scan reports no profile path, mount root or home directory. Repeat in a clean
   Linux container with Node, so case and permission problems surface here.

5. **Archive.** `tar -czf dist/.agents-generic-<date>.tar.gz -C dist .agents-generic-<date>`; `tar` ships
   with Windows 10 and every Linux.

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

4. **Move in one pass, one umbrella commit.** `prototype-k` is still the repository; `../csv-translations`
   is outside its worktree, so git records only what leaves the umbrella.

   ```bash
   mv CsvTranslations ../csv-translations
   mkdir -p ../csv-translations/local_dev/analyses
   mv local_dev/scripts  ../csv-translations/local_dev/scripts
   mv local_dev/tools    ../csv-translations/local_dev/tools
   mv local_dev/analyses/tts_analysis.md ../csv-translations/local_dev/analyses/

   # stages the removals from prototype-k; the moved files are not added anywhere here
   git add -A -- CsvTranslations local_dev
   ```

   `git add -A -- CsvTranslations local_dev` stages the deletions of the tracked files under those
   pathspecs. A pathspec of `csv-translations` would match nothing: the folder is not inside this
   repository. It becomes tracked when it is initialised as its own repository. `local_user_files` is not
   in the list because only untracked analyses leave it; its one tracked file, the README, stays.

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
| `~/.claude` left in place while the export installs to `~/.agents` | The export's `settings.json` and `AGENTS.md` are read from `~/.agents`; confirm the config root there and leave the old `~/.claude` data untouched |
| The merge leaves `agent-skills` referenced somewhere | `readlink` of every link, plus the global hooks path, checked before archiving |
| Export drifts from the working install | The tree is regenerated from the canonical home; `--check` recomputes file lists and hashes |

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
