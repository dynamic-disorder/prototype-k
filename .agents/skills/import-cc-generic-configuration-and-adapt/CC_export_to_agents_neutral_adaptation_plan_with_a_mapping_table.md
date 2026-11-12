# CC export → agents — neutral adaptation plan with a mapping table

| | |
| :--- | :--- |
| **Need** | A `.claude-generic-*` export is Claude-shaped: skills, rules, references, hooks, scripts and settings in one bundle. The neutral toolkit needs each file classified before any copy, or the result is a renamed Claude tree. |
| **Why** | Every file has a neutral home, a shim home, or no home. The plan makes the port reviewable and keeps credentials, placeholder values and repo-local exceptions out of the public repo. |
| **What** | A source-to-target mapping plus the adaptations for the 2026-11-11 export: 56 files in 16 skills, 6 rules, 7 references, 3 hooks, 12 scripts, 6 libraries and 6 root files. Left out: live Claude state, credentials and the secret-scan allowlist. |
| **DoD** | Every source file has one row with a destination and a mode (merge, new, shim, refuse); the refused set is explicit; the placeholder and standard rewrites are named; each execution phase ends with a verifier run. |
| **Top risk** | A sensitive file or an employer placeholder slips into the public toolkit. Mitigated by the refusal table and `scripts/verify-import-rules.mjs`. |

**TL;DR** — 56 files: 16 skills (6 merge, 10 new), 6 rules, 7 references (6 import, 1 refuse), 3 hooks,
12 scripts, 6 libraries (2 import, 4 refuse), 6 root files (1 merge, 4 shim, 1 refuse). Seven files are
refused.

## Source profile

| Area | Files | Import | Refuse | Shim or merge |
| :--- | ---: | ---: | ---: | ---: |
| Skills | 16 | 9 | 0 | 6 merge, 1 merge into `git-pr-fetch` |
| Rules | 6 | 5 | 0 | 1 merge into `output-style` |
| References | 7 | 6 | 1 | — |
| Hooks | 3 | 2 | 0 | 1 shim |
| Scripts | 12 | 10 | 1 | 1 shim |
| Libraries | 6 | 2 | 4 | — |
| Root files | 6 | 1 | 1 | 4 shim |

The export contains a nested copy of itself (`.claude-generic-*` inside the outer folder). Use the outer
tree and skip the inner one; the verifier reports it as a note.

## Decisions applied

- **Refused:** `claude_placeholder_values.txt`, `lib/env-db.sh`, `lib/env-db.md`, `lib/env-github.sh`,
  `lib/env-github.md`, `reference/git_commit_secret_scan_allowlist.txt`,
  `scripts/windows-credential-store.ps1`.
- `<PRODUCT_NAME>` → the target repository name.
- `<COMPANY_OR_ORGANIZATION_NAME>` → empty, or the public GitHub account name.
- `<PROJECT_TICKET_PREFIX>` → delete; every commit uses Conventional Commits.
- NSubstitute → FakeItEasy; ticket-prefix messages → Conventional Commits; `temp_user_files` →
  `local_user_files`.
- `~/.claude` survives only inside `claude/`; neutral files point at `~/.agents`.

## Skills — 16

| Export skill | Destination | Mode |
| :--- | :--- | :--- |
| `csharp-build-verifier` | `.agents/skills/csharp-build-verify/` | Merge; move its script into the skill |
| `csharp-code-explain` | `.agents/skills/explain/` | Merge |
| `csharp-refactor` | `.agents/skills/csharp-refactor/` | Merge |
| `git-commit` | `.agents/skills/git-commit/` | Merge; Conventional Commits |
| `research-technical-spike` | `.agents/skills/spike/` | Merge; `local_user_files` |
| `test-unit-generate` | `.agents/skills/unit-test-writer/` | Merge; FakeItEasy |
| `csharp-code-reviewer` | `.agents/skills/csharp-code-review/` | New |
| `git-code-review` | `.agents/skills/git-code-review/` | New; with `references/living-lens.md` |
| `git-code-review-resolve-feedbacks` | `.agents/skills/git-code-review-resolve-feedbacks/` | New |
| `git-pr-fetch` | `.agents/skills/git-pr-fetch/` | New |
| `git-pr-description-write` | `.agents/skills/git-pr-description-write/` | New; with `templates.md` |
| `git-pr-squash-message-write` | `.agents/skills/git-pr-squash-message-write/` | New |
| `git-fetch-context` | merge into `git-pr-fetch` | New; one context-fetch skill |
| `output-html-brief-generate` | `.agents/skills/output-html-brief-generate/` | New |
| `output-html-review-generate` | `.agents/skills/output-html-review-generate/` | New; with tests |
| `output-markdown-to-html` | `.agents/skills/output-markdown-to-html/` | New; with tests |

## Global, repository and machine

`~/.agents/AGENTS.md` is per machine. The checkout is shared; the home directory is not. Text written
only there has to be copied to Omarchy by hand, and the copies drift.

The cross-project rules are therefore canonical in `global/AGENTS.shared.md` and installed into each
machine's `~/.agents/AGENTS.md` as one managed block by `node global/install.mjs`, the same pattern as
`output-style`. That gives both machines the same text; machine-specific notes stay in a separate block in
the same file.

| Rule | OS-dependent? | What is actually platform-specific |
| :--- | :--- | :--- |
| `claude_working_habits.md` | No | Claude-only settings and worktree rules; those go to `claude/` |
| `git_handoff_commands.md` | The examples | Shell labels and `cd` forms; the rule is shell-neutral |
| `claude_code_configuration_file_naming_conventions.md` | No | The `~/.claude` scope; apply the same naming to `.agents` |

## Rules — 6

| Export rule | Destination | Mode |
| :--- | :--- | :--- |
| `claude_working_habits.md` | `global/AGENTS.shared.md`; Claude-only parts to `claude/` | Split |
| `git_handoff_commands.md` | `global/AGENTS.shared.md` | Merge; shell table, no OS copy |
| `claude_code_configuration_file_naming_conventions.md` | `global/AGENTS.shared.md` | Merge; apply to `.agents` too |
| `engineering_patterns.md` | new `.agents/skills/engineering-patterns/` | New |
| `bash_patterns_windows.md` | new `.agents/skills/windows-bash/` | New |
| `writing_style_for_markdown.md` | `output-style/` | Merge only unique details |

The three shared rules are installed into `~/.agents/AGENTS.md`; the Omarchy machine runs the same
installer, so no hand copy is needed. Shell-specific examples live in one table, not in a Windows-only
version and a Linux-only version.

## References — 7

| Export reference | Destination | Mode |
| :--- | :--- | :--- |
| `code_review_living_lens.md` | `git-code-review/references/` | Import |
| `code_review_csharp_conventions.md` | `csharp-conventions/references/` | Import |
| `test_anti_patterns.md` | `unit-test-writer/references/` | Import |
| `git_squash_message_examples.md` | `git-pr-squash-message-write/references/` | Import |
| `engineering_patterns_examples.md` | `engineering-patterns/references/` | Import |
| `bash_patterns_windows_reference.md` | `windows-bash/references/` | Import |
| `git_commit_secret_scan_allowlist.txt` | — | **Refuse** |

## Hooks and scripts — 15

| Export item | Destination | Mode |
| :--- | :--- | :--- |
| `hooks/pre-commit-build-check.sh` | `.githooks/pre-commit` | Import; merge with the existing gate |
| `hooks/pre-push-build-check.sh` | `.githooks/pre-push` | Import |
| `hooks/post-edit-dispatcher.sh` | `claude/hooks/` | Shim |
| `scripts/cache-ttl-kv.sh` (+README) | `scripts/` | Import; cache under `~/.agents/cache` |
| `scripts/claude-work-folder-create.sh` | `scripts/work-folder-create.sh` | Import; `local_user_files` |
| `scripts/csharp-build-verifier.sh` | `skills/csharp-build-verify/scripts/` | Import |
| `scripts/csharp-sln-find-nearest.sh` | `skills/csharp-build-verify/scripts/` | Import |
| `scripts/git-commit-context-fetch.sh` | `skills/git-commit/scripts/` | Import; merge with `collect-context.mjs` |
| `scripts/git-commit-secrets-scan.sh` | `scripts/` | Import; drop the export allowlist dependency |
| `scripts/git-fetch-context.sh` | `skills/git-pr-fetch/scripts/` | Import |
| `scripts/setup-gh-cli-check.js` | `scripts/setup/` | Import |
| `scripts/skill_script_delegation.README.md` | `docs/agents/` | Import |
| `scripts/statusline.js` | `claude/` | Shim |
| `scripts/windows-credential-store.ps1` | — | **Refuse** |

15 files across the three hooks and twelve scripts; the cache row covers its script and README.

## Libraries — 6

| Export library | Destination | Mode |
| :--- | :--- | :--- |
| `lib/env-paths.sh`, `lib/env-paths.md` | `scripts/lib/` | Import; parameterise the product name |
| `lib/env-db.sh`, `lib/env-db.md` | — | **Refuse** |
| `lib/env-github.sh`, `lib/env-github.md` | — | **Refuse** |

The three rows cover six files: each library has a script and a guide.

## Root files — 6

| Export | Destination | Mode |
| :--- | :--- | :--- |
| `CLAUDE.md` | `global/AGENTS.shared.md` (installed to `~/.agents/AGENTS.md`) | Merge; global edits need approval |
| `setup_claude_code_guide.md` | `claude/SETUP.md` | Shim |
| `claude_model_strategy.md` | `claude/MODEL_STRATEGY.md` | Shim |
| `claude_environment_variables.md` | `claude/ENV.md` | Shim |
| `settings.json` | `claude/settings.json` | Shim; sanitise `env` |
| `claude_placeholder_values.txt` | — | **Refuse** |

## Target layout

```
agent-skills/
  .agents/skills/        # merged and new skills, each with scripts/ and references/
  scripts/               # tool-neutral scripts and scripts/lib/
  claude/                # Claude-only shim: settings, statusline, post-edit hook, model strategy
  global/                # AGENTS.shared.md plus install.mjs; installed into ~/.agents/AGENTS.md
  output-style/          # one target: ~/.agents/AGENTS.md
```

Consumer repositories receive `.githooks/pre-commit` and `.githooks/pre-push`, not the shim.

Outside the repository, `~/.agents/AGENTS.md` receives the shared block and the style block. The
`agent-skills` repository carries no `AGENTS.md`; a future repository-specific instruction file would be a
separate file, not the global one.

## Phases

1. **Skills and references.** Port the 10 new skills, merge the 6 existing ones, place the 6 references.
   Run the verifier and the ported tests.
2. **Rules, hooks, scripts and libraries.** Put the three rules in `global/AGENTS.shared.md`, run
   `node global/install.mjs` on this machine and on Omarchy, add the two new skills,
   install the two git hooks, move the scripts and `env-paths`.
3. **Claude shim and manifest.** Add `claude/` with settings, statusline, post-edit hook, model strategy,
   environment notes and setup; write the import manifest.

Each phase ends with `node --test .agents/skills/import-cc-generic-configuration-and-adapt/scripts/verify-import-lib.test.mjs .agents/skills/import-cc-generic-configuration-and-adapt/scripts/verify-import-rules.test.mjs`
green and a verifier run on the target.

## Verification

```bash
node --test .agents/skills/import-cc-generic-configuration-and-adapt/scripts/verify-import-lib.test.mjs \
  .agents/skills/import-cc-generic-configuration-and-adapt/scripts/verify-import-rules.test.mjs
node .agents/skills/import-cc-generic-configuration-and-adapt/scripts/verify-import.mjs \
  --source <source> --target <target>
node --test global/lib/managed-block.test.mjs
node global/install.mjs --check
```

Expected: both suites green; the verifier reports the seven refusals as the only source issues, notes the
nested copy, and reports `0 issues` on the target once the port is complete; the shared block is installed
and current on every machine that runs the installer.

## Open items

- `git_commit_secret_scan_allowlist.txt` is refused; the ported scan must use the target repository's gate
  or the `secret-scan:allow` line marker.
- `code_review_living_lens.md` and `lib/env-paths.md` need a review for employer specifics before they enter
  a public repo.
- The `claude/` shim is optional; it is not referenced by the neutral skills.
