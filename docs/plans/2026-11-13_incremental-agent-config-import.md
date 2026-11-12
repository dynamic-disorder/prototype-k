# Incremental import of a Claude Code generic export

| | |
| :--- | :--- |
| **Need** | A new `.claude-generic-<date>` export arrives and the home already holds the last one. Re-importing everything would re-copy files that did not change, re-open decisions already settled, and bury the real delta in noise. |
| **Why** | The imported configuration is now the machine's configuration: every file in it is installed by links, exported to the portable bundle and read by every session. A change must land once, in the same place, with the same checks — and nothing else may move. |
| **What** | A delta procedure: manifest the export, diff it against the last manifest, and apply only the added, changed and deleted paths through the mapping, adaptation and verification rules this home established on 2026-11-13. Deliberately out of scope: live `~/.claude` state, credentials, the Claude shim, and any file the refusal list names. |
| **DoD** | The run reports one line per source state (added / changed / deleted / unchanged / refused); only the non-unchanged paths are touched; the seven verification commands below pass; the bundle is regenerated and its container proof is green; the manifest is updated for the next run. |
| **Top risk** | An unchanged file is rewritten "to be safe" and a local fix made on 2026-11-13 is silently undone. Fixed by the diff being the only source of work, and by `--check` reporting drift instead of a blind copy. |

**TL;DR** — Diff, do not copy. The export's manifest decides the work; the mapping decides the destination; the checks decide whether it is done.

## The five states

Every source path is in exactly one state. Only three of them cause work.

| State | Meaning | Action |
| :--- | :--- | :--- |
| **added** | In the new export, absent from the last manifest | Map, adapt, add to the destination |
| **changed** | Present in both, different sha256 | Merge into the destination; our body wins, unique content is taken |
| **deleted** | In the last manifest, absent from the new export | Delete the destination **after** checking nothing references it |
| **unchanged** | Same sha256 in both | **Touch nothing.** Not a formatting pass, not a re-adapt |
| **refused** | On the refusal list, in any state | Never opened, never copied, named in the report |

## State: the manifest

The last import's state is the manifest, one JSON file:

```text
local_user_files/imports/generic_export_2026-11-12.json
{
  "source": "<folder name of the export>",
  "takenAt": "2026-11-13",
  "files": { "<path inside the export>": "<sha256>" }
}
```

It is git-ignored on purpose: it is working state, and the tree is one shared directory, so both
machines read it at the same path. A fresh clone has none; then every file is **added** and the whole
mapping applies — say so in the report instead of pretending it is a delta.

A run starts by writing the new manifest to a temporary path and diffing it against this one. The diff is
the only source of work.

## Step 1 — refuse before reading

Check every source path against the refusal list first. A match stops the run for that path, and the
path is never opened:

| Path | Why |
| :--- | :--- |
| `claude_placeholder_values.txt` | maps placeholders to real identities |
| `lib/env-db.sh`, `lib/env-db.md`, `lib/env-github.sh`, `lib/env-github.md` | read credentials from a store |
| `lib/repo-env-db.*`, `lib/repo-env-github.*` (the 2026-11-12 spelling) | the same |
| `scripts/windows-credential-store.ps1`, `-lib.mjs`, `.mjs` | Windows Credential Manager helper |
| `reference/git_commit_secret_scan_allowlist.txt` | repo-local secret-scan exceptions |
| `.credentials*`, `.claude.json`, `history.jsonl`, `projects/`, `sessions/`, `*.key`, `*.pem` | live state or secrets |

## Step 2 — diff

For each source path, hash the file and compare with the manifest. Produce four lists — added, changed,
deleted, refused — and one count for unchanged. Print them before touching anything; that listing is the
reviewable unit of the run.

## Step 3 — map

| Source | Destination | Notes |
| :--- | :--- | :--- |
| `skills/<name>/` | `.agents/skills/<name>/` | Renamed skills: `csharp-build-verifier`→`csharp-build-verify`, `csharp-code-explain`→`explain`, `research-technical-spike`→`spike`, `test-unit-generate`→`unit-test-writer`, `csharp-code-reviewer`→`csharp-code-review`, `git-fetch-context`→ merged into `git-pr-fetch` |
| `rules/<name>.md` | `global/AGENTS.shared.md` section, or `output-style/documentation-style.md`, or a skill | See the rule table below |
| `reference/<name>.md` | the owning skill's `references/`, snake_case name | The living lens belongs to `git-code-review` |
| `scripts/<name>.mjs`, `.sh`, `.js` | `scripts/`, or the owning skill's folder | A script one skill calls lives inside that skill |
| `lib/<name>.sh`, `.md` | `scripts/lib/` | Only the neutral ones; the credential readers are refused |
| `hooks/pre-commit-build-check.sh` | merged into `.agents/hooks/pre-commit-build-check.sh` | Ours is more capable; take nothing unless the diff shows a new check |
| `hooks/pre-push-build-check.sh` | **not imported** | The machine-level `pre-push` delegates to a repository's own gate |
| `hooks/post-edit-dispatcher.sh`, `settings.json`, `agent_model_strategy.md`, `claude_environment_variables.md`, `setup_agent_guide.md`, `scripts/statusline.js` | **not imported** | The `.claude` layer is legacy; the bundle carries no `~/.claude` |
| `AGENTS.md` | the shared block, via the rule table | Its machine notes never travel |

**Rules.** `agent_configuration_file_naming_conventions.md` → naming section. `git_handoff_commands.md` →
hand-offs section. `claude_working_habits.md` → only repository trust, large inputs; the em-dash ban, "no
trailing summary", `MEMORY.md` and the worktree rule contradict the installed rules. `engineering_patterns.md`
and `bash_patterns_windows.md` → skills of the same names. `writing_style_for_markdown.md` → the style
guide's unique details only.

## Step 4 — apply by state

- **added**: copy, then adapt (Step 5). A new skill needs a `SKILL.md` with `name` matching its folder and a
  description under 1024 characters.
- **changed**: read the destination first. Keep its body; take only what the diff adds that the home does not
  already say. A changed rule is merged a section at a time, never replaced wholesale.
- **deleted**: `git rm` the destination, then grep the whole tree for its name — a skill, script or reference
  that something still names is a broken home, not a clean deletion.
- **unchanged**: skip. If a file feels wrong, it is a separate defect with its own commit, not this run.

## Step 5 — adapt every new or changed text file

| Source form | House form |
| :--- | :--- |
| the `<PRODUCT_…>` and `<COMPANY_…>` placeholders | the repository resolved from the remote (`gh repo view --json nameWithOwner`), or `$REPO`/`$OWNER`/`$NAME` with a setup block |
| a `<PROJECT_…>` ticket placeholder | an issue id such as `ABC-1234`; commit wording is Conventional Commits |
| the `NSub…` mocking library the source names | `FakeItEasy` |
| a temporary scratch path such as `local_dev/local_user_files` | `local_user_files` |
| `~/.claude`, `.claude/` | **absent** from every neutral file; name the directory in words if the text must refer to it |
| `$ARGUMENTS` | an explicit `## Input` paragraph |
| `model:`, `allowed-tools:`, `user-invocable:`, `context:`, `agent:` in frontmatter | removed; `name` and `description` stay |
| `bin/<name>` or a bare `<name>.md` reference | `references/<snake_case>.md`, and the name must match the file on disk |
| a Claude-only dependency (`review-independent`, an agent type, `MEMORY.md`) | rewritten as a self-contained instruction |

## Step 6 — repair the source's own defects

The 2026-11-12 export needed four repairs, and a new one will need its own. Look for them before verifying:

- **A fixture that disagrees with its code.** An anonymised URL carrying a real number, a placeholder branch
  name, a missing `origin/` prefix. The test's expectation, not the code, is what moves.
- **A dependency on something that does not exist** here — a skill, an agent type, a memory file.
- **A regex or pattern list that carries the banned strings** and trips the verifier on its own side.
- **A script path that assumes the old layout** (`local_dev/scripts/…` from a repository root, a
  `parents[2]` that is now `parents[1]`).

## Step 7 — renames

A rename inside a skill is a `git mv`. A **case-only** rename (`TEMPLATES.md` → `templates.md`) needs two
steps and a check, or Windows leaves both spellings tracked and a clone creates a second copy:

```bash
git mv A tmp && git mv tmp b
git ls-files <dir> && git ls-tree HEAD <dir>   # both must show only the new spelling
```

Update every reference in the same commit: the `SKILL.md`, any template mention, and the import record.

## Step 8 — verify

Run all seven; each has one expected result.

```bash
node .agents/skills/import-cc-generic-configuration-and-adapt/scripts/verify-import.mjs --target .
# 0 issues (it skips dist/ and the importer's own pattern files)

node scripts/check-skills.mjs            # frontmatter, references, Skill() names, naming, leaks
# 0 hard findings; soft ones are listed and judged

node --test .agents/skills/*/*.test.mjs .agents/skills/*/*/*.test.mjs scripts/lib/*.test.mjs
# every suite passes; no file skipped

node --check on every new .mjs, bash -n on every new .sh
# no syntax error

node scripts/install-global.mjs && node global/install.mjs --check && node output-style/install.mjs --check
# 28 ok / up to date / up to date

node scripts/export-agents.mjs --check
# no drift, once the bundle is regenerated after the change

# the container proof in export/README.md, against node:22-slim
# settings parse, every manifest path resolves, scripts pass, the gate exits 0
```

`scripts/check-skills.mjs` exists as of this plan: it reports frontmatter names and descriptions, leftover
source text, machine identifiers, references that do not resolve, `Skill()` names with no folder, and the
naming rule. It skips the importer skill, whose files define the patterns it looks for, and it is not
bundled — it checks this checkout, like the installer and the exporter do.

## Step 9 — publish the change

Regenerate the bundle (`node scripts/export-agents.mjs --archive`), remove the superseded `dist/` pair, run
`--check`, and run the container proof. The installed blocks reach the other machine only when it runs
`node global/install.mjs`; say so in the report, because a rule added here is not live there until then.

## Step 10 — commit

Draft, ask, wait. One commit per unit: the skills, then the rules and tools, then any document that
describes them. Name the files by folder. Report the hashes; push only what was approved.

## Traps met on 2026-11-13

| Symptom | Cause | Check that catches it |
| :--- | :--- | :--- |
| 35 verifier issues after an export | the verifier walked `dist/` | it now skips `dist` |
| verifier refuses a skill | `~/.claude` left in a neutral file | the refusal list, and `grep -rn '\.claude/'` |
| the same class twice in one bundle | a folder-name exclusion (`publish/`) also dropped a skill named `publish` | diff the bundle's skill list against `.agents/skills` |
| a clone creates a file that is absent on disk | case-only rename left both paths tracked | `git ls-tree HEAD <dir>` |
| a test fails only here | headless console (`Console.WindowWidth`) or a PATH-dependent player | run the same suite in the pre-move tree; identical failures mean environment |
| a reference 404s in a skill | `references/living-lens.md` vs the real file name | the reference check in Step 8 |
| the bundle carries a pattern-bearing file | the scanner must carry its own patterns | the exporter's leak check exempts only `scripts/scan-publication-leaks.sh` |

## How to start

```
Read docs/plans/2026-11-13_incremental-agent-config-import.md in prototype-k. The new export is at
<path>. Run it: refuse first, diff against local_user_files/imports/generic_export_2026-11-12.json, and
touch only added, changed and deleted paths. Follow the commit rule in ~/.agents/AGENTS.md.
```

## State inherited

- **Imported 2026-11-13** from `.agents-generic-2026-11-12_20-26`: 9 new skills, 6 merged, 2 built from its
  rules, 7 references, 8 scripts, 4 rule sections, the style details.
- **Repaired the same day**: the review skill's Claude-only path, the verifier's `dist/` walk, two
  naming violations, and a case-only rename that left both spellings tracked.
- **Manifest**: `local_user_files/imports/generic_export_2026-11-12.json`.
