# prototype-k

An umbrella repository. `CsvTranslations/` lives here; the other four projects each have their own
repository with its own `.gitignore`, README and instruction files. Beyond the project, this repository
holds the cross-project picture, the tooling templates, and the complete history of how everything was
built.

## Projects

| Project | Repository | What it is | Visibility |
| :--- | :--- | :--- | :--- |
| **CliUtils** | [dynamic-disorder/cliutils](https://github.com/dynamic-disorder/cliutils) | Console output utilities — coloured output, Spectre.Console wrappers, an in-memory logger. Packaged as `DynamicDisorder.CliUtils` | public |
| **CsvTranslations** | `CsvTranslations/` — **in this repository** | English-Finnish dictionary tooling — Ollama translation, Windows TTS, CSV management | public |
| **FilenameTools** | [dynamic-disorder/filenametools](https://github.com/dynamic-disorder/filenametools) | Filename sanitization — invalid characters, Unicode normalization, batch CLI | public |
| **MediaRenamer** | [dynamic-disorder/mediarenamer](https://github.com/dynamic-disorder/mediarenamer) | WPF tool that renames media files from their EXIF metadata | public |
| **ai_offline** | [dynamic-disorder/ai-offline](https://github.com/dynamic-disorder/ai-offline) | Locally-hosted AI stack — Ollama, Open WebUI, proxy and harness compose setups, GPU tuning guides | **private** |

## What lives here

| Path | Purpose |
| :--- | :--- |
| `CsvTranslations/` | The project that lives here: solution, apps, tests, scripts and the dictionary |
| `local_dev/` | Shared tooling and documentation: environment resolvers, the cross-platform build script, the sandbox cache redirection, analyses, and the consolidation/split plan |
| `.agents/skills/` | The agent skills used across the projects; each project repository carries the subset it needs |
| `.editorconfig`, `.gitattributes`, `Directory.Build.props` | The canonical formatting, line-ending and build-property templates the project repositories were created from |
| `.github/`, `.clinerules`, `.claudeignore`, `.claude/`, `.githooks/` | Instruction and gate configuration, kept as the template for new repositories |
| `local_user_files/` | Git-ignored scratch. Nothing durable belongs here |

Machine- and user-level notes — tools missing on this box, environment workarounds — deliberately do
not live in this repository: they belong to the machine, in user-global agent configuration.

## Working on the projects

`CsvTranslations/` is worked on in place. The other four are cloned side by side, and you work in the
repository that owns the code:

```text
My/
├── ai-offline/
├── cliutils/
├── filenametools/
├── mediarenamer/
└── prototype-k/          ← this repository, which also contains CsvTranslations/
```

Each project builds, tests and publishes on its own. There are no cross-repository relative paths:
reference another project by repository name, or by its package.

## History

The complete history lives here, including every commit that built the projects before the split —
each project repository starts from a single import commit. `CsvTranslations` was split out on
2026-10-15 and merged back here on 2026-10-16. How and why the split happened, with the
decisions behind it, is in
[`local_dev/plans/2026-10-15_consolidation-and-multi-repo-plan.md`](local_dev/plans/2026-10-15_consolidation-and-multi-repo-plan.md).

## License

Each project repository carries its own license file. This umbrella repository does not declare one.
