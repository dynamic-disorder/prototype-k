# Skills that only run a script

**Executive summary:** Mechanical work lives in a script, so the skill is a short delegator and the
model does no reasoning on it. The script owns the logic, the skill owns the trigger and the report.

## Skill to script map

| Skill | Scripts |
| :--- | :--- |
| `csharp-build-verify` | `scripts/csharp-build-verifier.mjs`, `scripts/csharp-sln-find-nearest.sh` (inside the skill) |
| `git-pr-fetch` | `fetch-pr.mjs`, `filter-unresolved.mjs`, `git-fetch-context.mjs` (inside the skill; the context fetch was merged into this skill) |
| `git-commit` (context step) | `scripts/git-commit-context-fetch.mjs` (inside the skill) |
| `git-code-review` | `resolve-review-target.mjs`, `lens-append.mjs` (inside the skill) |
| `git-code-review-resolve-feedbacks` | `resolve-feedback.mjs` (inside the skill) |
| `git-pr-description-write` | `extract-pr-context.mjs` (inside the skill) |
| `unit-test-writer` | `extract-unit-test-context.mjs` (inside the skill) |
| `output-markdown-to-html` | `convert-markdown.mjs` (inside the skill) |
| `output-html-review-generate` | `generate-html.mjs` (inside the skill) |

A script that one skill owns lives inside that skill's folder, so the skill moves as one unit.

## Shared helpers

| Helper | What it does |
| :--- | :--- |
| `scripts/cache-ttl-kv.sh` | a small TTL cache, used by `git-pr-fetch` |
| `scripts/work-folder-create.mjs` | prints this task's folder under `local_user_files/` and creates it |
| `scripts/lib/repo-env-paths.sh` | host paths for the repository and a wiki clone |
| `scripts/setup-gh-cli-check.js` | proves the `gh` CLI is installed and authenticated |

## Skills that reason

These carry judgement, not a script call: `csharp-code-review`, `git-code-review`,
`git-code-review-resolve-feedbacks`, `git-pr-description-write`, `git-pr-squash-message-write`,
`output-html-brief-generate`, `engineering-patterns`, `explain`, `csharp-refactor`.

## Running a script directly

```bash
node ~/.agents/skills/csharp-build-verify/scripts/csharp-build-verifier.mjs
node ~/.agents/skills/git-pr-fetch/git-fetch-context.mjs <PR-URL | branch | commit>
```

## Maintenance

- Hooks and scripts make no model calls; keep them that way.
- Update a script when git conventions or the build process change; the skill text stays as it is.
- The pattern is the one `engineering-patterns` states: pure logic in `<script>-lib.mjs`, a thin runner
  beside it, and a `node:test` file next to the pair.
