# prototype-k

**TL;DR** — Umbrella repository: one project lives here (`CsvTranslations/`), the other four are
separate repositories cloned beside this one. This repository holds the cross-project picture, the
tooling templates every project was created from, and the complete pre-split history.

## Projects

| Project | Where the code is | What it is | Visibility |
| :--- | :--- | :--- | :--- |
| **CliUtils** | [dynamic-disorder/cliutils](https://github.com/dynamic-disorder/cliutils) | Console output utilities — coloured output, Spectre.Console wrappers, an in-memory logger. Packaged as `DynamicDisorder.CliUtils` | public |
| **CsvTranslations** | `CsvTranslations/` — **in this repository** | English–Finnish dictionary tooling — Ollama translation, cross-platform Piper TTS, CSV management | public |
| **FilenameTools** | [dynamic-disorder/filenametools](https://github.com/dynamic-disorder/filenametools) | Filename sanitization — invalid characters, Unicode normalization, batch CLI | public |
| **MediaRenamer** | [dynamic-disorder/mediarenamer](https://github.com/dynamic-disorder/mediarenamer) | WPF tool that renames media files from their EXIF metadata | public |
| **ai_offline** | [dynamic-disorder/ai-offline](https://github.com/dynamic-disorder/ai-offline) | Locally-hosted AI stack — Ollama, Open WebUI, proxy and harness compose setups, GPU tuning guides | **private** |

## Layout

The four separate projects are cloned **at the same directory level** as this repository, each with
its own `.gitignore`, README and instruction files. Nothing is nested and nothing is symlinked:

```text
My/
├── ai-offline/
├── cliutils/
├── filenametools/
├── mediarenamer/
└── prototype-k/          ← this repository, which also contains CsvTranslations/
```

Work in the repository that owns the code. Each project is worked on, verified and released on its
own, and there are no cross-repository relative paths: reference another project by repository name,
or by its package.

## What lives here

| Path | Purpose |
| :--- | :--- |
| `CsvTranslations/` | The one project that lives here — `CsvTranslations.sln`, twelve projects (seven source, five test), the dictionary `translations.csv` and its corpora |
| `local_dev/scripts/` | Template tooling: `build-all-linux.sh`, the `repo-env.*` / `repo_paths.py` environment resolvers, `sandbox-env.sh` cache redirection, the self-contained publisher, the AI-context token estimator, the VS Code cache cleaner |
| `local_dev/tools/` | `ildump` — a `System.Reflection.Metadata` assembly inspector |
| `local_dev/analyses/`, `local_dev/plans/` | The cross-platform build audit, the TTS analysis, and the consolidation/split plan |
| `local_dev/*.md` | Tooling index, harness documentation, the git-ignored-files reference |
| `.agents/skills/` | The ten agent skills used across the projects; each project repository carries the subset it needs |
| `global-style/` | The executive-first documentation style installed into every harness's user-global config — `documentation-style.md`, `managed-block.md`, and the `install.ps1` / `install.sh` installers (`-Check` reports drift) |
| `.editorconfig`, `.gitattributes`, `Directory.Build.props` | The canonical formatting, line-ending and build-property templates the project repositories were created from |
| `.github/`, `.clinerules`, `.claudeignore`, `.claude/`, `.githooks/` | Instruction and build-gate configuration, kept as the template for new repositories |
| `local_user_files/` | Git-ignored scratch. Nothing durable belongs here |

Machine- and user-level notes — tools missing on this box, environment workarounds — deliberately do
not live in this repository: they belong to the machine, in user-global agent configuration.

## Working here

`CsvTranslations/` is worked on in place. From this directory, on Linux or macOS:

```bash
./local_dev/scripts/build-all-linux.sh --test      # builds and tests the solution
```

From `CsvTranslations/`, on any platform:

```bash
dotnet build CsvTranslations.sln
dotnet test  CsvTranslations.sln
```

The build script discovers solutions by glob; here that finds `CsvTranslations.sln` only. The four
separate projects verify in their own repositories.

## Instructions for agents

`CLAUDE.md` is the entry point for this repository: non-negotiables, the project table and the
cross-project pointers. `CsvTranslations/CLAUDE.md` covers the solution that lives here. Every other
project carries its own `CLAUDE.md` — clone it and read that one.

## History

The complete history lives here, including every commit that built the projects before the split —
each project repository starts from a single import commit. `CsvTranslations` was split out on
2026-10-15 and merged back here on 2026-10-16. How and why the split happened, with the decisions
behind it, is in
[`local_dev/plans/2026-10-15_consolidation-and-multi-repo-plan.md`](local_dev/plans/2026-10-15_consolidation-and-multi-repo-plan.md).

## License

MIT — see [`LICENSE`](LICENSE). Each project repository carries its own license file.
