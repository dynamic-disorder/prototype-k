---
name: import-cc-generic-configuration-and-adapt
description: Import a sanitized Claude Code claude-generic export into the neutral .agents layout, rewriting placeholders and current standards. Use when given a .claude-generic-* folder to port into agent-skills or a project; refuses credentials and secrets.
---

# import-cc-generic-configuration-and-adapt

## Executive Summary

Port one `.claude-generic-*` export into the neutral `.agents` convention without carrying live Claude Code
state, credentials or secrets. The skill classifies every source file, merges skills by purpose, rewrites
placeholders and the current standards, keeps Claude-only pieces in a `claude/` shim, and verifies the
result before anything is committed.

## When to Use

- A `.claude-generic-<date>_<time>` folder is handed over for reuse.
- A hackathon machine needs the same skills, hooks and scripts as this one.
- A Claude Code configuration is being retired in favour of `AGENTS.md` + `.agents/skills`.

**Not for:** live `~/.claude` state (history, sessions, `.claude.json`, `.credentials*`), or copying
secrets. **Anti-pattern:** copying the export wholesale into `.agents/` and renaming folders. The export is
a Claude-shaped bundle; the neutral layout is a classification, not a rename.

## Prerequisites & Setup

| Requirement | Why | Check | If missing |
| :--- | :--- | :--- | :--- |
| Node.js 20+ | Verifier and imported `.mjs` scripts | `node -v` prints `v20` or higher | Stop; the verifier cannot run. |
| Git target checkout | Merge and commit need history and status | `git -C <target> rev-parse` succeeds | Stop; clone or initialise first. |
| Clean target worktree | Imported files must not mix with unrelated work | `git -C <target> status --porcelain` prints nothing | Commit or stash; the skill refuses to mix. |
| Read access to the export | Source of the port | `test -d <source>` / `Test-Path <source>` | Stop. |
| Bash (Git Bash on Windows) | Shell scripts and hooks | `bash --version` | Stop hook and script work; the rest may proceed. |

## Functional Requirements

**Inputs:** `SOURCE` (the `.claude-generic-*` folder), `TARGET` (repository root; `agent-skills`
recommended), `--repo-name <name>`, `--company <name>` (optional), `--write` (default is plan only),
`--only <path>` for one item.

**Outputs:** new or merged `.agents/skills/<name>/`; `global/AGENTS.shared.md` for cross-project rules,
installed into each machine's `~/.agents/AGENTS.md` (or a repository's own `AGENTS.md` for
repository-specific ones); `.githooks/pre-commit` and
`.githooks/pre-push`; `scripts/` and skill-local `scripts/`; `claude/` shim; `IMPORT-PLAN.md` (dry run) or
`local_user_files/imports/<date>-claude-generic.md` (applied manifest).

### Refusals — never imported

| Path | Why |
| :--- | :--- |
| `claude_placeholder_values.txt` | Maps placeholders to real identities |
| `lib/env-db.sh`, `lib/env-db.md`, `lib/env-github.sh`, `lib/env-github.md` | Read credentials from stores |
| `scripts/windows-credential-store.ps1` | Windows Credential Manager helper |
| `reference/git_commit_secret_scan_allowlist.txt` | Repo-local secret-scan exceptions; not shared |
| `.credentials*`, `.claude.json`, `history.jsonl`, `projects/`, `sessions/`, `*.key`, `*.pem` | Live state or secrets |

Any file matching a secret pattern stops the import. Name the file and the rule; never print the match.

### Mapping

**Skills**

| Export | Destination | Mode |
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
| `git-pr-description-write` | `.agents/skills/git-pr-description-write/` | New; with `TEMPLATES.md` |
| `git-pr-squash-message-write` | `.agents/skills/git-pr-squash-message-write/` | New |
| `git-fetch-context` | merge into `git-pr-fetch` | One context-fetch skill |
| `output-html-brief-generate` | `.agents/skills/output-html-brief-generate/` | New |
| `output-html-review-generate` | `.agents/skills/output-html-review-generate/` | New; with tests |
| `output-markdown-to-html` | `.agents/skills/output-markdown-to-html/` | New; with tests |

**Rules**

| Export | Destination |
| :--- | :--- |
| `claude_working_habits.md` | `global/AGENTS.shared.md`; Claude-only parts to `claude/` |
| `engineering_patterns.md` | new `.agents/skills/engineering-patterns/` |
| `bash_patterns_windows.md` | new `.agents/skills/windows-bash/` |
| `git_handoff_commands.md` | `global/AGENTS.shared.md`; shell table, no OS copy |
| `writing_style_for_markdown.md` | `agent-skills/output-style/`; merge only unique details |
| `claude_code_configuration_file_naming_conventions.md` | `global/AGENTS.shared.md`; apply to `.agents` too |

**References**

| Export | Destination |
| :--- | :--- |
| `code_review_living_lens.md` | `git-code-review/references/` |
| `code_review_csharp_conventions.md` | `csharp-conventions/references/` |
| `test_anti_patterns.md` | `unit-test-writer/references/` |
| `git_squash_message_examples.md` | `git-pr-squash-message-write/references/` |
| `engineering_patterns_examples.md` | `engineering-patterns/references/` |
| `bash_patterns_windows_reference.md` | `windows-bash/references/` |

**Hooks, scripts and libraries**

| Export | Destination |
| :--- | :--- |
| `hooks/pre-commit-build-check.sh` | `.githooks/pre-commit`; merge with the existing gate |
| `hooks/pre-push-build-check.sh` | `.githooks/pre-push` |
| `hooks/post-edit-dispatcher.sh` | `claude/hooks/` |
| `scripts/cache-ttl-kv.sh` (+README) | `scripts/`; cache under `~/.agents/cache` |
| `scripts/claude-work-folder-create.sh` | `scripts/work-folder-create.sh`; writes `local_user_files/` |
| `scripts/csharp-build-verifier.sh`, `csharp-sln-find-nearest.sh` | `skills/csharp-build-verify/scripts/` |
| `scripts/git-commit-context-fetch.sh` | `skills/git-commit/scripts/`; merge with `collect-context.mjs` |
| `scripts/git-commit-secrets-scan.sh` | `scripts/` publication gate; drop the export's allowlist dependency |
| `scripts/git-fetch-context.sh` | `skills/git-pr-fetch/scripts/` |
| `scripts/setup-gh-cli-check.js` | `scripts/setup/` |
| `scripts/statusline.js` | `claude/` |
| `scripts/skill_script_delegation.README.md` | `docs/agents/` |
| `lib/env-paths.sh`, `lib/env-paths.md` | `scripts/lib/`; parameterise the product name |

**Root files**

| Export | Destination |
| :--- | :--- |
| `CLAUDE.md` | `global/AGENTS.shared.md` (installed to `~/.agents/AGENTS.md`) | Merge; global edits need approval |
| `setup_claude_code_guide.md` | `claude/SETUP.md` |
| `claude_model_strategy.md` | `claude/MODEL_STRATEGY.md` |
| `claude_environment_variables.md` | `claude/ENV.md` |
| `settings.json` | `claude/settings.json`; sanitise `env`, keep no secrets |
| `claude_placeholder_values.txt` | **refused** |

### Adaptation rules

- `<PRODUCT_NAME>` → the target repository name (`--repo-name`, or the `origin` URL basename).
- `<COMPANY_OR_ORGANIZATION_NAME>` → empty; use the GitHub account name only when `--company` is public.
- `<PROJECT_TICKET_PREFIX>` → delete the ticket-prefix rule; use Conventional Commits, subject under 50.
- `NSubstitute` → `FakeItEasy` (`A.Fake`, `A.CallTo`, `MustHaveHappened`).
- `temp_user_files` → `local_user_files`.
- The ported `git-commit-secrets-scan.sh` uses the target repository's own gate or the `secret-scan:allow`
  line marker; the export's `git_commit_secret_scan_allowlist.txt` is refused.
- `~/.claude` → `~/.agents` in neutral files; `~/.claude` survives only under `claude/`.
- Remove Claude-only frontmatter (`model`, `allowed-tools`, `user-invocable`, `context`, `agent`) from
  neutral `SKILL.md`; keep `name` and `description`, add `whenToUse` when it helps.
- Model names (`haiku`, `sonnet`, `opus`) belong in `claude/MODEL_STRATEGY.md`, not in neutral skills.
- Claude's `$ARGUMENTS` becomes an explicit input in the skill body.

### Requirement → check → failure

| Requirement | Check | Failure |
| :--- | :--- | :--- |
| No refused file | verifier blocklist | Stop the import |
| No secret value | verifier secret scan | Stop; name the file, never the match |
| No placeholder left | verifier scan for `<PRODUCT_NAME>`, `<COMPANY_OR_ORGANIZATION_NAME>`, `<PROJECT_TICKET_PREFIX>` | Fail |
| No NSubstitute | verifier scan | Fail |
| No ticket-prefix rule | verifier scan for ticket-prefix wording | Fail |
| No `temp_user_files` | verifier scan | Fail |
| No `~/.claude` outside the shim | verifier path scan | Fail |
| Every skill valid | frontmatter `name` + `description`; name matches `^[a-z0-9]+(-[a-z0-9]+)*$` | Fail |
| Scripts parse | `bash -n`, `node --check` | Fail |
| Verifier unit suite is green | `node --test .agents/skills/import-cc-generic-configuration-and-adapt/scripts/verify-import-lib.test.mjs .agents/skills/import-cc-generic-configuration-and-adapt/scripts/verify-import-rules.test.mjs` | Fail |
| Existing skills preserved | `git diff` review before commit | Fail unless merged deliberately |

**Escape hatch:** the default is a dry run. `--write` applies only after `IMPORT-PLAN.md` is approved;
`--only <path>` limits the run to one item. **Tolerated losses:** statusline, permissions, model routing and
hook wiring stay Claude-only in `claude/`; neutral skills lose Claude-specific invocation metadata.

## Execution Workflow

1. **Inventory.** List the source tree and classify every path as skill, rule, reference, hook, script,
   library, shim, or refused. Skip symlinks. If the export contains a nested `.claude-generic-*` copy, use
   only the outer tree and record the inner one as skipped. Do not read the refused files.
2. **Refuse.** Remove the refused set from the plan. Run the verifier's secret scan on the remaining source
   files; a hit stops the import.
3. **Plan.** Write `IMPORT-PLAN.md` with one row per source file: action (merge, port, shim, skip), target
   path, and the adaptation needed. Include a diff summary for every existing skill that would change.
4. **Skills.** For each new skill, copy the folder to `.agents/skills/<name>/`, strip Claude-only
   frontmatter, rewrite paths, and keep `scripts/` and `references/` inside it. For an existing skill,
   merge only the unique content; the repository's current standard wins on conflicts.
5. **Rules.** Merge cross-project rules into `global/AGENTS.shared.md`, then run `node global/install.mjs`
   on each machine and `--check` it; keep OS-specific notes in the machine block. Use a repository's own
   `AGENTS.md` only for repository-specific instructions. Never duplicate `output-style`; merge
   only markdown details it does not already cover.
6. **References.** Move each reference into the owning skill's `references/` directory.
7. **Hooks.** Copy `pre-commit` and `pre-push` into `.githooks/`, keep them executable (`100755`), and keep
   `post-edit-dispatcher.sh` under `claude/hooks/`.
8. **Scripts and libraries.** Move them to `scripts/` or the skill's `scripts/`; rewrite `~/.claude` and
   `temp_user_files`; keep credentials out.
9. **Claude shim.** Put `settings.json`, `MODEL_STRATEGY.md`, `ENV.md`, `SETUP.md`, `statusline.js` and the
   post-edit hook under `claude/`. It is optional and never imported by the neutral paths.
10. **Adapt.** Apply the placeholder, FakeItEasy, Conventional Commits and `local_user_files` rules to
    every ported text file.
11. **Verify.** Run the commands in the next section. Fix every failure before proposing a commit.
12. **Report and commit.** Present the diff and the manifest. Commit only after approval; one commit per
    phase (skills, infrastructure, shim).

## Error-Handling Playbook

| Symptom / Exit | Root cause | Autonomous correction |
| :--- | :--- | :--- |
| Verifier reports a secret | A real value sits in a source file | Stop; move the file to `local_user_files/`; never commit it |
| Refused filename appears in the plan | Classification skipped it | Remove it and rerun the verifier |
| Nested `.claude-generic-*` copy | The export carries a duplicate of itself | Use the outer tree; skip the inner one and compare counts before deciding |
| Existing skill differs | The export carries an older copy | Show the diff; merge by hand; keep the repo standard |
| Placeholder remains | A file was copied without adaptation | Apply the mapping table; rerun the verifier |
| `NSubstitute` remains | Test skill copied verbatim | Replace with FakeItEasy, then rerun |
| Ticket-prefix wording remains | Commit skill copied verbatim | Replace with Conventional Commits |
| `~/.claude` remains | Script path not rewritten | Point neutral files at `~/.agents` or move to `claude/` |
| `bash -n` fails | Shell syntax from another shell | Fix the syntax or drop the script |
| `node --check` fails | ESM/CJS mismatch | Match the file extension and module type |
| Frontmatter invalid | Missing `name`/`description` | Add them; match the folder name |
| CRLF appears | Copied from a Windows tree | Normalise to LF before commit |

## Verification & Outputs

Run from the target repository:

```bash
node --test .agents/skills/import-cc-generic-configuration-and-adapt/scripts/verify-import-lib.test.mjs \
  .agents/skills/import-cc-generic-configuration-and-adapt/scripts/verify-import-rules.test.mjs
node .agents/skills/import-cc-generic-configuration-and-adapt/scripts/verify-import.mjs \
  --source <source> --target <target>
node global/install.mjs --check
bash -n .githooks/pre-commit .githooks/pre-push
node --check scripts/*.mjs
git -C <target> diff --check
git -C <target> status --short
```

Expected: the unit suite is green; the verifier exits 0 and prints `0 issues`; a nested export is reported
as a `note`, not an issue; every ported script passes its syntax check; the diff is additions and deliberate
merges only.

**Outputs:** the ported and merged skills, `global/AGENTS.shared.md` and its installed block, the two git
hooks, `scripts/` and the
`claude/` shim, plus the manifest. **Exit criteria:** no refused file, no secret, no placeholder, no
NSubstitute, no ticket prefix, no `temp_user_files`, no `~/.claude` outside `claude/`, and all skills valid.

**Files:** `SKILL.md`; `scripts/verify-import.mjs` is the CLI entry point, `scripts/verify-import-lib.mjs`
holds the filesystem checks, `scripts/verify-import-rules.mjs` holds the pure rules,
`scripts/verify-import-lib.test.mjs` covers the library and `scripts/verify-import-rules.test.mjs` covers the
pure rules. The full source-to-target table and the adaptation decisions are in
`CC_export_to_agents_neutral_adaptation_plan_with_a_mapping_table.md`.
