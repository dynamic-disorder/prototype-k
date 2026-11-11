# Umbrella → template and neutral agents export

| | |
| :--- | :--- |
| **Need** | `prototype-k` still holds the project, its scratch and its tooling, so it cannot serve as the neutral configuration you carry to an empty machine. |
| **Why** | One checkout that carries the agent rules, the skills, the build templates and the export turns a bare hackathon laptop into a configured one in minutes, instead of a hand-rebuilt setup. |
| **What** | Move `CsvTranslations` out as `csv-translations` with `local_dev/` and `local_user_files/`, copy the `agent-skills` content into `prototype-k`, and add an export that packages the neutral configuration. |
| **DoD** | A filtered copy of `csv-translations` builds, tests, publishes one app, and `git add` tracks no ignored asset; `prototype-k` holds no C# and no project scratch; `scripts/export-agents.mjs --check` is green; a bundle installs into a throwaway agents home and both installers pass `--check`. |
| **Top risk** | The `.gitignore` rule for scratch is anchored to the repository root, so the move would expose every ignored cache file as untracked. Fixed first in Phase 1. |

**TL;DR** — Two moves and one export: the project leaves with its scratch, tooling and every file it needs to stand alone; the umbrella becomes the neutral template; a script turns that template into a bundle for an empty machine.

## Target state

```
$DYNAMIC_DISORDER_ROOT/
  agent-skills/            # source of truth for .agents; unchanged
  csv-translations/        # moved out of prototype-k; a repository when you make it one
    AGENTS.md  LICENSE  CsvTranslations.sln  Directory.Packages.props  README.md
    .agents/  .githooks/  .gitignore  .gitattributes  .editorconfig  Directory.Build.props
    local_dev/            # tooling, plans, analyses, ildump
    local_user_files/     # private scratch and tool caches (ignored)
    <projects>/  scripts/  translations.csv
  prototype-k/             # umbrella and the neutral template
    AGENTS.md  README.md  LICENSE  docs/
    .agents/               # synced skills and the build-gate hook
    global/                # shared rules and their installer
    output-style/          # writing style and its installer
    scripts/               # install, export and publication gate
    .editorconfig  Directory.Build.props  .gitattributes  .gitignore  .githooks/
```

`prototype-k` keeps `.editorconfig`, `Directory.Build.props` and `.gitattributes` as the templates a new
project copies; `csv-translations` gets its own copies before it leaves, because MSBuild and the editor
walk up to the nearest file and lose it the moment the directory moves out.

## What `csv-translations` needs to work

Every row is proved by the rehearsal in Phase 2, not assumed.

| Need | Source | Proof |
| :--- | :--- | :--- |
| Build inheritance (`net10.0`, analyzers, symbols, Windows targeting) | `Directory.Build.props` copied to the project root | `dotnet build` from the project root |
| Editor and analyzer style, with `root = true` | `.editorconfig` copied | `dotnet build` (warnings behave as before) |
| LF everywhere, `*.csv binary` | `.gitattributes` copied | `git ls-files --eol` reports `i/lf w/lf` for a tracked source file |
| Ignore rules for artifacts, models, scratch and `.agents` | `.gitignore` written for the project | `git ls-files` omits models, Piper, caches |
| Solution, projects, dictionary, data scripts | already inside the folder | `dotnet test` |
| Tooling: build, publish, runtime installer, env resolvers, token estimate, ildump | `local_dev/` moved in | `build-all-linux.sh --test`, `publish-selfcontained.mjs --help`, `repo_paths.py` |
| Scratch and tool caches | `local_user_files/` moved in | `sandbox-env.sh` writes there; git ignores it |
| License | root `LICENSE` copied | file present at the root |
| Agent skills, build gate, publication gate | `.agents/`, `.githooks/`, `local_dev/scripts/scan-publication-leaks.sh` | `git config core.hooksPath` and one commit |
| Drift check against the source of truth | `agent-skills/sync.json` gains a `csv-translations` target | `sync-skills.mjs --target csv-translations` reports 0 differences |
| Path resolvers that no longer assume the umbrella | `repo_paths.py`, `publish-selfcontained.mjs`, four data scripts | Phase 1 edits and the rehearsal |
| Editor workspace entry | `dynamic-disorder.code-workspace` (outside the repository) | folder list includes `csv-translations` |

## Decisions

| # | Decision | Why |
| :--- | :--- | :--- |
| D1 | `agent-skills` stays the source of truth; `prototype-k` and `csv-translations` are synced targets. | The sync script, lock and pre-commit drift check already exist; a second source would silently diverge. |
| D2 | Copy everything from `agent-skills` except `.git/`, `sync.json`, `sync-lock.json` and `scripts/sync-skills.mjs`. | The three files describe this checkout's sibling targets, and `.git/` is never copied. A template that claims to be the source of other repositories is wrong on an empty machine. |
| D3 | `local_user_files/` moves whole, caches included, as asked. | One move, no split logic. The cost is a few hundred MB of regenerable caches (measured 2026-11-11: about 414 MB) inside a checkout that will become public — see the last risk. |
| D4 | The publication scanner keeps `local_dev/scripts/` in the project and gains a copy at `scripts/` in the template; both derive their own path. | The git hook and the synced `git-commit` skill must work in either layout, and a fixed `SELF` literal makes `--all` flag the pattern list itself. |
| D5 | `publish` and `install-net10-runtime` move to `csv-translations`, not to the template. | Their wrappers live in that checkout's `local_dev/scripts/`; they ship one project, not a neutral configuration. |
| D6 | `deck-card-video-generate` stays in `prototype-k` and is excluded from the export. | It depends on an untracked `node_modules/` and a Playwright browser; it is not reproducible from git today. |
| D7 | The export is configuration plus project templates, never credentials or harness logins. | A USB stick with keys on it is the one leak that cannot be rotated in time. |

**D4 in practice.** The scanner's `SELF='local_dev/scripts/scan-publication-leaks.sh'` line is what makes
`--all` skip its own pattern list. Replace it with a path derived from the script's location, and update the
usage lines that still spell the old path:

```bash
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
root="$(git rev-parse --show-toplevel)" || exit 2
SELF="${script_dir#"$root"/}/$(basename -- "${BASH_SOURCE[0]}")"
```

## Phase 1 — make `CsvTranslations` self-contained

Run from `$DYNAMIC_DISORDER_ROOT/prototype-k`. Start only when `git status --short` is empty.

1. **Record the baseline.** `./local_dev/scripts/build-all-linux.sh --test` must pass before anything moves.

2. **Fix the scratch ignore rule first.** In `.gitignore`, replace the root-anchored pair:

   ```diff
   -local_user_files/*
   -!local_user_files/README.md
   +**/local_user_files/*
   +!**/local_user_files/README.md
   ```

   A pattern containing a `/` is anchored to the `.gitignore`'s directory, so the old pair does not cover
   `CsvTranslations/local_user_files/`. Without this edit the move exposes every cache file as untracked.

   Prove it: `git check-ignore -v CsvTranslations/local_user_files/README.md` names the negated rule, and
   `git check-ignore -v CsvTranslations/local_user_files/nuget/packages` names the ignored rule.

3. **Copy the project layer into `CsvTranslations/`.** Each file exists for a reason the new repository
   cannot get after the move:

   | File | Source | Why it must be copied |
   | :--- | :--- | :--- |
   | `.editorconfig` | repository root | Editor settings are found by walking up; the parent is gone after the move. It carries `root = true`, so the copy is self-contained |
   | `Directory.Build.props` | repository root | The `TargetFramework`, analyzer and symbol settings the solution inherits |
   | `.gitattributes` | repository root | LF everywhere, `*.csv binary` — the new repository has no root to inherit from |
   | `.gitignore` | new file | The block below |
   | `LICENSE` | repository root | A published repository without a license is not reusable |
   | `.agents/skills/`, `.agents/hooks/` | repository root | The eight managed skills and the build gate, at the paths the hook expects; `deck-card-video-generate` and `pdf-to-markdown-and-assets-extract` stay in the umbrella |
   | `.githooks/pre-commit` | repository root, copied | Scan at `local_dev/scripts/`, then the build gate — unchanged, because the project keeps that layout |
   | `local_dev/scripts/scan-publication-leaks.sh` | `local_dev/scripts/`, edited | The publication gate; it moves with the tooling, and the derived `SELF` (D4) lets the template keep the same file at `scripts/` |

   The eight managed skills are `csharp-build-verify`, `csharp-conventions`, `csharp-refactor`,
   `explain`, `git-commit`, `issue-investigate`, `spike` and `unit-test-writer` — the list
   `agent-skills/sync.json` gives for `prototype-k`.

   The project `.gitignore`:

   ```gitignore
   # Build output and IDE state
   **/obj/
   **/bin/
   *.user
   .vs/
   *.code-workspace
   [Tt]est[Rr]esult*/
   *.trx
   *.sln.docstates
   *_wpftmp.csproj
   .vscode/
   __pycache__/
   .venv/
   venv/

   # Distribution output
   publish/
   artifacts/

   # Runtime assets, downloaded on first use (~190 MB on disk, not reproducible from git)
   **/TextToSpeechApp/models/
   **/TextToSpeechApp/piper/

   # Private scratch: contents ignored, README kept
   **/local_user_files/*
   !**/local_user_files/README.md

   # Agent configuration: track the shared layer only
   **/.agents/*
   !**/.agents/commands/
   !**/.agents/hooks/
   !**/.agents/rules/
   !**/.agents/skills/
   **/.agents/settings.local.json
   **/.agents/agent-memory-local/
   AGENTS.local.md
   CLAUDE.local.md

   # Personal tool configuration
   .continue
   .aider*
   ```

   Move the two project skills in the same step:
   `git mv .agents/skills/publish CsvTranslations/.agents/skills/publish` and the same for
   `install-net10-runtime`. Their `local_dev/scripts/` references become correct once `local_dev` moves.

   `prototype-k` needs the scanner now, not later: its `.githooks/pre-commit` runs on the Phase 1 commit.
   Copy the current hook and scanner into the project first, then edit the umbrella's own copies: place the
   edited scanner at `scripts/scan-publication-leaks.sh` and change the hook's `scan=` line to
   `$root/scripts/scan-publication-leaks.sh`. The project keeps its own copy in `local_dev/scripts/`, where
   its existing hook already looks.

4. **Move the folders.**

   ```bash
   git mv local_dev CsvTranslations/local_dev
   mv local_user_files CsvTranslations/local_user_files
   git add -A -- local_user_files
   ```

   `git mv` carries the tracked files and any untracked build output under `local_dev`; the scratch
   folder moves on disk because all but its `README.md` is ignored.

5. **Fix the path assumptions the move invalidates.** These are correct once `local_dev` is inside the
   project, and stay correct when the project moves out. Nothing else in the tooling hard-codes the
   umbrella.

   | File | Old | New |
   | :--- | :--- | :--- |
   | `local_dev/scripts/repo_paths.py` | `repo_root() / "CsvTranslations" / "translations.csv"` | `repo_root() / "translations.csv"` |
   | `local_dev/scripts/repo_paths.py` docstring | `parents[2] / "local_dev"` for a caller in `scripts/` | `parents[1] / "local_dev"` |
   | `local_dev/scripts/repo-env.ps1` docstring | `"$RepoRoot\CsvTranslations\CsvTranslations.sln"` | `"$RepoRoot\CsvTranslations.sln"` |
   | `local_dev/scripts/publish-selfcontained.mjs` | `'CsvTranslations/AddEntryApp/AddEntryApp.csproj'` and its three siblings | the same paths without the `CsvTranslations/` prefix |
   | `scripts/make_append.py`, `make_csv.py`, `sort_translations.py`, `unify_english.py` | `Path(__file__).resolve().parents[2] / "local_dev" / "scripts"` | `parents[1]` |
   | `local_dev/README.md` | "in this umbrella that finds `CsvTranslations/CsvTranslations.sln`" | "in this repository that finds `CsvTranslations.sln`"; "from the umbrella repository root" → "from the repository root" |
   | `local_dev/deepseek-harness.md` | "uses the umbrella's" | the project's own tree |

6. **Update the two project docs.** `CsvTranslations/AGENTS.md`: drop the `cd CsvTranslations` step and
   point the build-gate reference at `.agents/skills/csharp-build-verify/SKILL.md` instead of the
   non-existent `.agents/commands/build.md`. `CsvTranslations/README.md` already uses project-relative
   paths and needs no edit.

7. **Verify from inside the moved directory.**

   ```bash
   cd CsvTranslations
   ./local_dev/scripts/repo-env.sh          # repository: .../CsvTranslations
   ./local_dev/scripts/build-all-linux.sh --test
   python3 local_dev/scripts/repo_paths.py  # dictionary: .../CsvTranslations/translations.csv
   python3 -m py_compile scripts/*.py
   grep -n 'parents\[1\] / "local_dev"' scripts/*.py
   node --check local_dev/scripts/publish-selfcontained.mjs
   grep -rn "CsvTranslations/" local_dev/scripts/*.mjs || echo "no stale prefix"
   ```

   `repo-env.sh` walks two levels up from `local_dev/scripts/`, so it resolves the new root with no edit.
   `build-all-linux.sh` now finds exactly one solution.

8. **Draft the commit and wait for approval.** Suggested subject:
   `refactor(project): make CsvTranslations self-contained`; it carries the moves, the ignore fix, the path
   fixes and the new project layer.

## Phase 2 — move `csv-translations` out

1. **Move the directory out.**

   ```bash
   mv CsvTranslations ../csv-translations
   git add -A -- CsvTranslations
   ```

   PowerShell: `Move-Item -LiteralPath CsvTranslations -Destination ..\csv-translations`.

2. **Verify the umbrella.** From `prototype-k`: `find . -name '*.sln' -o -name '*.csproj'` returns
   nothing outside `.agents/`, and `git status --short` shows the staged deletions only.

3. **Register the new checkout as a sync target.** In `agent-skills/sync.json`, add a `csv-translations`
   entry with the same eight skills and hook as the other project repositories, then from `agent-skills`:

   ```bash
   node scripts/sync-skills.mjs --write --target csv-translations
   node scripts/sync-skills.mjs --target csv-translations    # 0 differences
   ```

   This is what makes the new checkout's drift check name it instead of printing "not managed by
   agent-skills — skipping". Commit `agent-skills` separately with its lock.

4. **Rehearse the standalone checkout.** Copy the project without its runtime assets and caches, then prove
   the whole list above from the copy:

   ```bash
   tmp="$(mktemp -d)/csv-translations"
   mkdir -p "$tmp"
   tar -C "$DYNAMIC_DISORDER_ROOT" -cf - \
     --exclude='csv-translations/TextToSpeechApp/models' \
     --exclude='csv-translations/TextToSpeechApp/piper' \
     --exclude='csv-translations/local_user_files/nuget' \
     --exclude='csv-translations/local_user_files/dotnet-home' \
     --exclude='csv-translations/local_user_files/xdg' \
     --exclude='*/bin' --exclude='*/obj' \
     csv-translations | tar -C "$tmp" -xf -

   mkdir -p "$tmp/TextToSpeechApp/models" "$tmp/TextToSpeechApp/piper" "$tmp/local_user_files"
   printf 'probe\n' > "$tmp/TextToSpeechApp/models/probe.bin"
   printf 'probe\n' > "$tmp/TextToSpeechApp/piper/probe"
   printf 'scratch\n' > "$tmp/local_user_files/README.md"

   cd "$tmp"
   dotnet build CsvTranslations.sln
   dotnet test  CsvTranslations.sln
   node local_dev/scripts/publish-selfcontained.mjs AddEntryApp   # proves the project map
   python3 local_dev/scripts/repo_paths.py

   git init -q
   git add -A
   git ls-files --eol TextToSpeechApp/TextToSpeechApp.csproj
   git ls-files | grep -E '^TextToSpeechApp/(models|piper)/' && echo "IGNORE BROKEN" || echo "models ignored"
   git ls-files | grep -q '^local_user_files/README.md' && echo "scratch README tracked"
   git ls-files .agents/skills | head -1
   git config core.hooksPath .githooks
   git -c user.name=probe -c user.email=probe@example.com commit -q -m probe
   git status --short
   ```

   Expected: build and tests green; the publish run writes `publish/AddEntryApp/...` and nothing else; no
   model, Piper or cache file is listed by `git ls-files`; the scratch README and the managed skills are
   listed; the probe commit passes the publication gate and the build gate, and leaves `git status --short`
   empty. Delete the copy afterwards.

5. **Update the editor workspace.** `$DYNAMIC_DISORDER_ROOT/dynamic-disorder.code-workspace` is outside
   every repository: add `{ "path": "csv-translations" }` to its folder list so the editor sees the new
   checkout beside the others.

6. **Draft and commit** the deletion with
   `refactor: move the project checkout to csv-translations`. The publication gate runs; the build gate
   finds no solution and exits 0 after its skill-drift check, which is correct — the umbrella has no code.

## When you make it a repository

The folder is ready before this step; these commands only make it a git repository and connect a remote.

```bash
cd "$DYNAMIC_DISORDER_ROOT/csv-translations"
git init
git branch -M main
git config core.autocrlf false        # LF in the working tree, as .gitattributes expects
git config core.ignorecase false      # the umbrella's clone rule, kept for path-case safety
git config core.hooksPath .githooks
git add -A
git update-index --chmod=+x .githooks/pre-commit .agents/hooks/pre-commit-build-check.sh
git commit -m "Initial commit"
git remote add origin <remote-url>    # when the remote exists
git push -u origin main
```

The `--chmod=+x` call is not optional on a Windows checkout: without it the two hooks enter the index as
`100644`, the clone on Omarchy cannot execute them, and the gate silently does nothing.

## Phase 3 — `prototype-k` becomes the template

1. **Copy `agent-skills` in.**

   ```bash
   git -C ../agent-skills archive -o ../agents-copy.tar HEAD
   tar -xf ../agents-copy.tar
   rm ../agents-copy.tar
   rm sync.json sync-lock.json scripts/sync-skills.mjs
   ```

   The archive brings `global/`, `output-style/`, `scripts/` and the full `.agents/skills/` set, and
   overwrites the eight managed skills with byte-identical copies. Keep the scanner already placed under
   `scripts/` in Phase 1.

2. **Register the new skill in the sync config, and widen two path references.** In
   `agent-skills/sync.json`, add `skills/import-cc-generic-configuration-and-adapt` to the `prototype-k`
   list, then `node scripts/sync-skills.mjs --write --target prototype-k` from `agent-skills`. In the same
   edit, widen the synced `git-commit` skill: it names `local_dev/scripts/scan-publication-leaks.sh` and the
   root variable from `local_dev/scripts/repo-env.sh`, and the template has neither. Name both scanner
   locations, and the root variable without a file path. Commit that repository separately: it is the
   source, and the lock must match.

3. **Rewrite the umbrella documents.** `AGENTS.md` and `README.md` describe a template, not a product: the
   project table lists `csv-translations` as a sibling, `local_dev` and `local_user_files` are gone, the
   export is named, and the build commands become the template's own verification. `docs/README.md` drops
   the "belongs in `local_dev/`" paragraph, because those folders now live with the project.

4. **Adjust the ignore rules.** Keep `**/.agents/*` and `**/local_user_files/*`; add `dist/` for the export
   output; drop the `TextToSpeechApp` model and Piper rules, which belong to the project's own
   `.gitignore`.

5. **Verify.**

   ```bash
   node ../agent-skills/scripts/sync-skills.mjs --target prototype-k   # 0 differences
   node global/install.mjs --check                                      # shared block current
   node output-style/install.mjs --check                                # style block current
   bash scripts/scan-publication-leaks.sh --all                         # 0 FAIL hits
   node --test scripts/lib/managed-block.test.mjs scripts/lib/install-block.test.mjs
   ```

6. **Draft and commit** `feat(agents): make prototype-k the neutral template`.

**Do not run `scripts/install-global.mjs --write` in `prototype-k` on this machine.** It would repoint
`~/.agents/skills` from `agent-skills` to the template copy; the two are identical today, so nothing would
break, and the next edit to either would. The bundle runs that command on the new machine, where pointing
at the bundle is exactly the intent.

## Phase 4 — the export

1. **Add `scripts/export-agents.mjs`** and a pure `scripts/lib/export-plan.mjs` (the file list, the
   exclusions, the leak check) with `node:test` coverage. Node first, so the same command runs on Omarchy
   and in PowerShell.

   | Mode | Behaviour |
   | :--- | :--- |
   | `--out <dir>` | Write the bundle, default `dist/agents-export` |
   | `--check` | Rebuild into a temporary directory and compare file lists and hashes to `--out` |
   | `--archive` | Also write `dist/agents-export-<date>.tar.gz` |

2. **Bundle layout.** Two parts, so the install steps and the project seed are not confused:

   ```
   agents-export/
     README.md                 # the runbook: prerequisites, install commands, what to do for a new project
     MANIFEST.json             # relative path + sha256 for every file
     global/                   # AGENTS.shared.md, install.mjs, README.md
     output-style/             # managed-block.md, documentation-style.md, install.mjs, README.md
     scripts/                  # install-global.mjs, lib/managed-block.mjs, lib/install-block.mjs
     .agents/skills/           # the eight managed skills plus the import and PDF skills
     .agents/hooks/            # pre-commit-build-check.sh
     docs/agents/              # the skill-authoring specs
     claude/CLAUDE.md          # one line: @~/.agents/AGENTS.md
     project-seed/             # .editorconfig, Directory.Build.props, .gitattributes, .gitignore,
                               # .githooks/pre-commit, scripts/scan-publication-leaks.sh
   ```

   Excluded and why: `sync.json`, `sync-lock.json`, `scripts/sync-skills.mjs` (they describe this
   checkout's siblings), `deck-card-video-generate` (D6), every `node_modules/` and `test-results/`,
   `dist/` itself, `.git/`, and everything in `local_user_files/` or a harness config directory.

3. **Make the bundle installable and prove it.** The runbook is:

   ```bash
   # on the empty machine, after installing git and Node 20+
   cp -R agents-export ~/agent-config        # %USERPROFILE%\agent-config on Windows
   cd ~/agent-config
   node global/install.mjs
   node output-style/install.mjs
   node scripts/install-global.mjs --write
   node global/install.mjs --check
   node output-style/install.mjs --check
   node scripts/install-global.mjs
   ```

   Verification on this machine, in a throwaway home:
   `DSH_AGENTS_HOME=$(mktemp -d)`, run the three installers against the bundle, confirm both `--check`
   exit 0 with no network access. Then remove the links with `--remove` and the temporary home.

4. **Leak check.** The export scans every text file it writes for the three FAIL shapes — profile path,
   mount root, home directory — and refuses on a hit. It skips the scanner copy in `project-seed/`, which
   contains the patterns by design, the same exemption the scanner gives itself.

5. **Archive.** `tar -czf dist/agents-export-<date>.tar.gz -C dist agents-export`; `tar` ships with
   Windows 10 and every Linux. The archive is the thing on the USB stick.

6. **Write `docs/agents/export-runbook.md`** with the Phase 5 table and the install commands, and point
   the bundle's `README.md` at the same steps. Two readers, one instruction set: the person at the
   laptop, and an agent asked to set the laptop up.

7. **Draft and commit** `feat(agents): export the neutral configuration bundle`.

## Phase 5 — the hackathon runbook

The bundle's `README.md` carries this, and so does `docs/agents/export-runbook.md`:

| Step | Action | Who |
| :--- | :--- | :--- |
| 1 | Install git, Node 20+, and the .NET 10 SDK if the project needs it | Owner |
| 2 | Copy `agents-export` to `%USERPROFILE%\agent-config` (Windows) or `~/agent-config` | Owner |
| 3 | Run the three installers from that folder | Owner or agent |
| 4 | Sign in to the harness with its own command; never copy a credential | Owner |
| 5 | New project: copy the contents of `project-seed/`, dotfiles included, to its root, then `git config core.hooksPath .githooks` | Owner |
| 6 | Write the project's `AGENTS.md` from `docs/agents/` | Agent |

The export is rebuilt, not edited: change `prototype-k`, run the export, carry the new archive.

## Reference updates

| File | Change |
| :--- | :--- |
| `.gitignore` (umbrella) | `**/local_user_files/*`, add `dist/`, drop project-specific model rules |
| `.githooks/pre-commit` (template) | Scan at `scripts/scan-publication-leaks.sh`; the project's copy keeps `local_dev/scripts/` |
| `scripts/scan-publication-leaks.sh` | Path-independent `SELF`; the template copy lives at `scripts/`, the project copy at `local_dev/scripts/` |
| `agent-skills/.agents/skills/git-commit/SKILL.md` | Name both scanner locations; the root variable without a file path |
| `AGENTS.md`, `README.md` | Rewrite for the umbrella/template; project table, no `local_dev` |
| `docs/README.md` | `local_dev/` and `local_user_files/` now live in the project checkout |
| `local_dev/scripts/repo_paths.py` | Dictionary at the repository root; docstring index |
| `local_dev/scripts/repo-env.ps1` | Docstring solution path |
| `local_dev/scripts/publish-selfcontained.mjs` | Project map without the `CsvTranslations/` prefix |
| `scripts/make_append.py`, `make_csv.py`, `sort_translations.py`, `unify_english.py` | `parents[1]` for the resolver import |
| `CsvTranslations/AGENTS.md` | Build command; build-gate reference |
| `.agents/skills/publish`, `install-net10-runtime` | Moved to the project checkout |
| `agent-skills/sync.json` | `prototype-k` gains the import skill; `csv-translations` is a new target |
| `dynamic-disorder.code-workspace` (outside git) | Add the `csv-translations` folder |
| `local_dev/**`, dated plans | Left as written; they are dated records, not live references |

## Risks

| Risk | Mitigation |
| :--- | :--- |
| Root-anchored scratch ignore exposes the entire ignored scratch tree as untracked | Phase 1 step 2, proved with `git check-ignore` before the move |
| Project loses `Directory.Build.props` and `.editorconfig` inheritance | Copied into the project before it moves; the Phase 1 build proves it |
| A path assumption survives the move and fails only when someone publishes or runs a data script | Phase 1 step 5 fixes the four known families; the Phase 2 rehearsal runs each one |
| Runtime assets enter the new repository | `.gitignore` rules for `models/` and `piper/`; the rehearsal checks `git ls-files` |
| Template copies drift from `agent-skills` | `.agents` is synced and drift-checked; the export's `--check` compares the rest |
| The scratch caches sit inside a future public repository | Ignore rules plus a pre-publish step that moves the caches out and repoints `sandbox-env.sh` |
| The publication gate silently skips the removal commit | The template's scanner and hook are in place before anything is staged (D4) |
| Export includes a machine path or a credential | The export's own leak scan refuses on a hit; harness logins are out of scope (D7) |

## Out of scope

- Creating the remote and pushing; the repository commands are listed for when you choose to run them.
- Renaming the solution or the project directories.
- Retiring `agent-skills` or moving `sync.json` ownership into `prototype-k`.
- Carrying harness credentials, session state or model configuration.

## How to start

Paste this into a session opened at `prototype-k`:

```
Read docs/plans/2026-11-11_umbrella-to-template-and-agents-export-plan.md and execute Phase 1 only.
Follow the commit rule in ~/.agents/AGENTS.md: draft, ask, wait for approval.
Touch only the paths the phase lists; do not start Phase 2 in the same turn.
```
