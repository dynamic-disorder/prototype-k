# Script Extraction: skills that only run a script

**Executive summary:** Mechanical work lives in scripts, so a skill is a short delegator and the model does no reasoning on it. Those skills run on Haiku (a model turn is still needed to call the script). Model routing for all skills: `~/.agents/agent_model_strategy.md`.

## Skill to script map

- `csharp-build-verifier` - `scripts/csharp-build-verifier.mjs`
- `git-fetch-context` - `scripts/git-fetch-context.mjs`
- `git-commit` (context step) - `scripts/git-commit-context-fetch.mjs`, plus `scripts/git-commit-secrets-scan.mjs` and `csharp-build-verifier.mjs`
- `claude-config-export` - `skills/claude-config-export/export.sh`
- `git-pr-fetch`, `output-markdown-to-html` - scripts inside their own skill folder

## Shared helpers

- `scripts/csharp-sln-find-nearest.sh` - nearest `.sln` for a changed file; used by both git hooks
- `scripts/claude-work-folder-create.mjs` - per-task work folder under `<PROJECT_ROOT>/local_dev/local_user_files`
- `scripts/cache-ttl-kv.sh` - TTL cache used by `git-pr-fetch`
- `lib/repo-env-paths.sh` - prototype-k repo root and wiki clone resolution

## Skills that need a model

Reasoning or writing for other people, so they run on Sonnet: `csharp-code-reviewer`, `csharp-code-explain`, `csharp-refactor`, `test-unit-generate`, `git-code-review`, `git-code-review-resolve-feedbacks`, `git-pr-description-write`, `research-technical-spike`.

## Running a script directly (no model)

```bash
node ~/.agents/scripts/csharp-build-verifier.mjs
node ~/.agents/scripts/git-fetch-context.mjs <PR_URL|BRANCH|COMMIT>
```

## Maintenance

- Hooks and scripts make no LLM calls; keep them that way.
- Update a script when git conventions or the build process change; the skill text stays as is.
