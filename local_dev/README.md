# local_dev — working notes about this repository

**TL;DR** — The tracked notes that are *about* this checkout rather than part of it: the plan records, the
build audit, the harness details, the ignore reference and the open follow-ups. The runnable tooling left
with the project on 2026-11-13.

## Organization guidelines

- **Plans**: a dated record of a structural change goes in `plans/`. It stays after the work as the record
  of what was decided and why.
- **Analyses**: an audit, a measurement or a technical assessment goes in `analyses/`.
- **Completed work leaves the tree**: a finished plan or a third-party reference is archived to the
  git-ignored `local_user_files/archive/`; git history keeps it recoverable.
- **Personal or raw material** goes to `local_user_files/` at the repository root, never here.
- **No secrets, credentials or network calls** in this folder.

## What lives here

| Path | Holds |
| :--- | :--- |
| `plans/` | The consolidation and split plan |
| [`analyses/linux-build-audit.md`](analyses/linux-build-audit.md) | The cross-platform build audit of 2026-10-10: per-solution results, the case-sensitive `ProjectReference` and `EnableWindowsTargeting` failures, the `core.ignorecase` rename trap |
| [`deepseek-harness.md`](deepseek-harness.md) | How the harnesses consume this checkout: instruction and skill discovery, and the machine-level gate |
| [`git-ignored-local-files.md`](git-ignored-local-files.md) | What `.gitignore` excludes, what is tracked-but-ignored, and what is deliberately disposable |
| [`TODOS.md`](TODOS.md) | Open verification and release follow-ups, each naming what closes it and who acts |
| `CLI_Library_Recommendation_Spectre.Console.md` | The CLI library comparison the console projects were built from |

## Where the tooling went

The project's tooling left with it on 2026-11-13 and lives in the `csv-translations` checkout:
`local_dev/scripts/` there holds the environment resolvers (`repo-env.sh`, `repo-env.ps1`, `repo_paths.py`),
`sandbox-env.sh`, `build-all-linux.sh`, `publish-selfcontained.mjs`, `install-net10-runtime.ps1`, the
AI-context token estimator and the VS Code cache cleaner; `local_dev/tools/ildump/` holds the assembly
inspector.

What stayed here is machine-level and sits at the repository root, not in `local_dev/`:
[`scripts/install-global.mjs`](../scripts/install-global.mjs) (the links and `core.hooksPath`),
[`scripts/export-agents.mjs`](../scripts/export-agents.mjs) (the portable bundle) and
[`scripts/scan-publication-leaks.sh`](../scripts/scan-publication-leaks.sh) (the publication gate). Their
usage is in `../AGENTS.md` and `../README.md`.

## Documentation

Written here: the files in the table above. `../AGENTS.md` is the entry point and links back to this folder.
