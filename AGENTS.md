# AGENTS.md — umbrella, template and agent-configuration home

**TL;DR** — This repository holds no application. It is the one home of the agent configuration this
machine installs — the skills, the shared rules, the style block, the git gates and the scripts that put
them all in place — and it keeps the cross-project documentation, the templates a new repository starts
from, and the history of the projects that were built here before they split out.

**Verify everything:** `node scripts/install-global.mjs` (links and hooks path), `node global/install.mjs
--check` and `node output-style/install.mjs --check` (the installed blocks), `node scripts/export-agents.mjs
--check` (the portable bundle). Each project verifies in its own repository.

## Executive summary

| | |
| :--- | :--- |
| **Problem** | The agent configuration existed as copies in six repositories, so every rule edit had to be repeated and a copy that drifted taught the old rule silently. The five projects also shared one working tree, one gate and one ignore list. |
| **Value** | Skills, rules, style and gates now have one physical copy, installed by links, so a rule learned once reaches every repository on the machine. Each project owns its own code, build and history. |
| **What** | The configuration, its installers, the export for a second machine, the canonical templates, the cross-project documentation and the dated plan records. Deliberately not here: product code, project tooling, machine notes. |
| **Verify** | The three `--check` commands above exit 0, and a commit in any repository prints the gate's `PASS` line. |
| **Top risk** | Editing a project file here, or a copy of the configuration in a project repository. Neither exists any more; if one appears, it is the defect. |

## Non-negotiables

- **LF line endings everywhere** — repository *and* working tree (`.gitattributes`: `* text=auto eol=lf`, `core.autocrlf=false`).
- **Never hard-code a machine path** — derive it from the file's own location, or use `DYNAMIC_DISORDER_ROOT` when a sibling checkout is meant. The project repositories carry the same rule.
- **Everything committed is public** — files and commit messages alike. Never a drive letter, home or profile path, account/user/host name, or employer/ticket identifier, masked or not: write `%USERPROFILE%\…` on Windows and `~/…` on Linux/macOS. The gate scans every commit; the rules and the command are in `.agents/skills/git-commit/SKILL.md`.
- **No cross-repository relative paths** — reference another project by repository name or by its package, never by `../`.
- **Match on-disk path case exactly** in every `ProjectReference` / `Include` a template produces — wrong-case paths are silently skipped during restore on Linux.
- **Keep git `core.ignorecase=false`** in this clone.

## Projects

None of these lives in this repository. Work in the checkout that owns the code, and read that
repository's own `AGENTS.md`.

| Project | Where the code is | What it is |
| :--- | :--- | :--- |
| **CliUtils** | [dynamic-disorder/cliutils](https://github.com/dynamic-disorder/cliutils) | Console output utilities — coloured output, Spectre.Console wrappers, an in-memory logger. Packaged as `DynamicDisorder.CliUtils` |
| **CsvTranslations** | [dynamic-disorder/csv-translations](https://github.com/dynamic-disorder/csv-translations) (**private**) | English–Finnish dictionary tooling — Ollama translation, cross-platform Piper TTS, CSV management |
| **FilenameTools** | [dynamic-disorder/filenametools](https://github.com/dynamic-disorder/filenametools) | Filename sanitization — invalid characters, Unicode normalization, batch CLI |
| **MediaRenamer** | [dynamic-disorder/mediarenamer](https://github.com/dynamic-disorder/mediarenamer) | WPF tool that renames media files from their EXIF metadata |
| **ai_offline** | [dynamic-disorder/ai-offline](https://github.com/dynamic-disorder/ai-offline) (**private**) | Locally-hosted AI stack — Ollama, Open WebUI, proxy and harness compose setups, GPU tuning guides |

## What lives here

| Path | Purpose |
| :--- | :--- |
| `.agents/skills/` | The canonical agent skills — one copy; `scripts/install-global.mjs` links each into `~/.agents/skills/<name>` for every repository on the machine |
| `.agents/hooks/` | The build gate, run by the git gate and by harness tool-call hooks |
| `.githooks/` | `pre-commit` (publication scan, then the build gate) and `pre-push` (forwards to a repository's own `git_tools/pre-push`) |
| `global/`, `output-style/` | The shared rules and the style block, with the installers that upsert them into `~/.agents/AGENTS.md` |
| `scripts/` | `install-global.mjs` (the links and `core.hooksPath`), `export-agents.mjs` and its planner (the portable bundle), `scan-publication-leaks.sh`, and the shared libraries |
| `export/` | The portable bundle's own inputs: its `settings.json`, its `README.md` and the `project-seed/` templates |
| `.editorconfig`, `.gitattributes`, `Directory.Build.props`, `LICENSE` | The canonical templates a new project repository starts from |
| `docs/` | The public documentation tier: the skill-authoring specs and the dated plans |
| `local_dev/` | The harness notes, the cross-platform build audit, the plan records and the working TODOs — documentation about this repository, not tooling |
| `local_user_files/` | Git-ignored scratch. Nothing durable belongs here |

## How the configuration reaches a machine

One checkout, many links. Nothing is copied, so nothing can drift:

```
~/.agents/skills/<name>  ->  <this checkout>/.agents/skills/<name>
~/.agents/hooks          ->  <this checkout>/.agents/hooks
~/.agents/scripts        ->  <this checkout>/scripts
~/.agents/githooks       ->  <this checkout>/.githooks
git config --global core.hooksPath  ->  ~/.agents/githooks
```

`node scripts/install-global.mjs --write` creates them and writes the global hooks path; run the same
command with no option to check. The rules and the style block are installed separately by
`node global/install.mjs` and `node output-style/install.mjs`, which own one managed block each in
`~/.agents/AGENTS.md`.

A machine that cannot see this checkout copies the portable bundle instead:
`node scripts/export-agents.mjs --archive` writes `dist/.agents-generic-<date>/` and its `.tar.gz`, and
the receiving machine copies that folder to `~/.agents` and sets `core.hooksPath` to its `githooks`.

## Verify

Run in Bash, from this repository:

```bash
node scripts/install-global.mjs            # every link and the hooks path; exit 0 when installed
node global/install.mjs --check            # shared rules block current
node output-style/install.mjs --check      # style block current
node scripts/export-agents.mjs --check     # the newest export matches the checkout
node scripts/check-skills.mjs              # skill frontmatter, references, names and leftovers
bash scripts/rehearse-linux-install.sh     # the whole install path against a throwaway HOME (Linux or WSL)
node --test scripts/lib/*.test.mjs         # the planner and block libraries
```

The git gate runs `scripts/scan-publication-leaks.sh` and then the build gate on every commit. A
repository with no staged C# costs a scan only; the gate exits 0 and prints `PASS`.

## Where to look next

- **Installing or repairing a machine**: `scripts/install-global.mjs` and the `global/` and `output-style/` installers; the machine notes in `~/.agents/AGENTS.md` cover what differs per box.
- **The portable bundle**: `export/README.md` — what it holds, what it refuses, and how to install it.
- **Skill authoring**: `docs/agents/README.md` — the four specs, not a paraphrase.
- **The split and its rationale**: `local_dev/plans/2026-10-15_consolidation-and-multi-repo-plan.md`.
- **The merge, the export and the move**: `docs/plans/2026-11-11_umbrella-to-template-and-agents-export-plan.md` and its neighbours in `docs/plans/`.
- **Cross-platform build facts**: `local_dev/analyses/linux-build-audit.md`.
- **Harness details**: `local_dev/deepseek-harness.md` — what the harnesses read here, and how the gate is activated.
- **Git-ignored files**: `local_dev/git-ignored-local-files.md` — what stays out of version control and why.
- **Working on a project**: clone the repository and read its own `AGENTS.md`.

## Environment & style

- **Platforms**: Omarchy Linux (Arch-based, primary since Oct 2026) and Windows 11.
- **SDK**: .NET 10.0.x. The templates target `net10.0`; the project repositories carry their own target frameworks.
- **Shell**: bash on Linux; PowerShell (preferred) or Git Bash on Windows. Every installer here is Node, so it runs in any of them.
- **Node**: 20 or newer — the installers, the exporter and the planner tests all use it.
- **Line endings**: **LF everywhere** per `.gitattributes` with `core.autocrlf=false`. The old Windows-first CRLF-for-`.cs` policy was dropped in Oct 2026.

Machine- and user-level notes — tools missing on a box, environment workarounds, mount points — live in
the machine notes of `~/.agents/AGENTS.md`, never in this repository.

## History

This is the original working tree. It built all five projects until the split on 2026-10-15, merged
`CsvTranslations` back on 2026-10-16, moved it out again on 2026-11-13, and became the single home of the
agent configuration the same day. How and why: `local_dev/plans/2026-10-15_consolidation-and-multi-repo-plan.md`.
