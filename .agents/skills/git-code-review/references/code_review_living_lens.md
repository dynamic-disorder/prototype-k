# Living lens

Living document: insights and points of view of the reviewers the user works with, as principles with the PR that taught them. Revise sections as new insights arrive. The final "Learn" stage of `git-code-review` appends bullets (`lens-append.mjs`, cap 220 lines, backups in `reference/.backup/`) with an `(auto YYYY-MM-DD)` tag. Fold each into the bullet that covers its topic and drop the tag, so a section stays one bullet per topic (last consolidation: 2026-11-12).

**Match by diff signal** (find the section from what the diff shows, then read the whole section):
- A command, SQL or path is built from a name, id or remote list: 3 (injection, untrusted names, destructive globs).
- A new file, parser or source sits next to an old one: 2 (shared state, copies), 3 ("Mirrors X"), 4 (callers).
- A count, note or report line changes: 2 (read the sentence around it).
- The PR or commit claims "fixed", "tested", "no change": 2.
- A secret, token, host or config mapping: 5.
- `AGENTS.md`, rule, skill, command or agent file: 6, 8, 10.
- A manual, README or doc: 9.
- A CI workflow, `CODEOWNERS` or governance check: 10.
- C#, migration, shared persistence class: 11.
- Several concerns in one PR: 4.

**Provenance:**
- How to write the review itself (severity labels, comment style, retractions, trade-offs) lives in `skills/git-code-review/SKILL.md`, not here.

## 1. Core principle
Do not fix the surface. Find the root causes of the symptoms.
- Name the cause, show the evidence (`file:line`, log line, reproduction), fix it there.
- Ask whether the same symptom can return through another path.
- A fix that catches a symptom downstream (e.g. swallows an exception the upstream code should not throw) is a finding, even if it works.
- If the cause cannot be shown yet, the first task is an investigation, not a patch.
- An error must never become a valid-looking result: a failed query is not "not found" or "no rows". Return an `error` field, branch on it first, word it "query did not run", and use `psql -v ON_ERROR_STOP=1` (PR #1234).

## 2. Verify, do not infer
- Claims ("fixes X", "no behavior change", "tested on Dev") are hypotheses. Judge code by what it does, not by its name or comment.
- A checkable reference (run link, log query, named test and result) is verification. A bare "tested, works" is an unverified claim.
- Look first at what the Verification section did not exercise (e.g. only `--dry-run`), and at commits added since the last review round: self-directed fixes are the unreviewed part. A path changed twice without being run is the typical failure (PR #1234).
- A passing run proves nothing once its logic changed: scope "verified" to a commit and list re-runs per changed row. A test can also pass for the wrong reason (shared password, same host) (PR #1234). A check must be able to fail: if its WHERE or setup already excludes the case it asserts on, or the seed never creates the case, it passes vacuously. Mutate the input or seed once and confirm the check goes red (PR #1234).
- Verify what a tool does on the invocation path in use. Example: psql `:'var'` interpolation fails with `-c`; use `-f -`. When it cannot be run, cite the source and say it was not reproduced (PR #1234).
- Verify claims about harness behavior before they go into docs ("Claude Code detects skills automatically"). If unverifiable, state only the certain part or drop the claim (PR #1234).
- A leftover whose justification the PR made false is a PR-claim failure: after adding tests, `[ExcludeFromCodeCoverage]` with "not unit tested" defeats the goal (PR #1234).
- If the evidence cannot settle a question, say what is unverifiable. Do not pick a side.
- A hand-written status or enum filter is a hypothesis: list every enum value (pg_enum or the C# enum) and check each against the code that sets the field the query reads, e.g. which statuses keep a file. Do not assume the two obvious values (PR #1234).
- A change that adds to a report is read together with what surrounds it (PR #1234): (a) a new source next to an existing one (TRX beside job log): diff what the old path did to shared state (notes, counts, exit codes) and apply it to the new path, or the report contradicts itself; (b) a printed count or list that gains a part: read the sentence that tells the reader where to verify it, which must name the new part too.

## 3. Tooling scripts (`.sh`, `.mjs`, `.js`, `.ts`, `.py`)
**Security and ops (treat as blocking):**
- No injection by interpolation into `bash -c`, SQL or `execSync`: use `execFileSync(cmd, [args])`. Validate input before the command is built, not after the parse (a heredoc terminator or `eval` makes it too late).
- No secrets in command lines (pass through `env`). Diagnostics print presence, never content or a prefix: `Token: ${VAR:+present}`. Agent stderr lands in the transcript (PR #1234).
- Enforce safety at the enforcement point, not with a text check: a `startsWith('SELECT')` check is not a permission boundary. Set the connection read-only (`PGOPTIONS='-c default_transaction_read_only=on'`) and probe the bypass forms (`WITH x AS (DELETE ... RETURNING *) SELECT`, `SELECT 1; DROP TABLE`) (PR #1234). A note telling the model to confirm is not a gate either.
- Validate input before `rm -rf` or any destructive glob (`^ABC-[0-9]+$`); a deletion glob names only artifacts the script itself creates. When a cleanup flag is narrowed, check what leftovers other tools now read as stale data, and state the scope in the help text (PR #1234).
- No unconditional external writes (comments, dispatches, write APIs): require an opt-in flag or confirmation, in line with the repo `.agents/settings.json` posture (`git commit` behind `ask`, `git push` denied).

**Correctness and portability:**
- `execSync` runs cmd.exe (no `$?`, no `/dev/null`): use `execFileSync` and choose `NUL` or `/dev/null` per platform; `.bat`/`.cmd` needs `shell: true`. If the PR added a `bash()` helper, use it everywhere. `$TEMP` and `cygpath` do not exist on Linux or WSL, and `|| echo "$TEMP"` under `set -u` is an unbound-variable error. Helper scripts get `set -euo pipefail`; a blanket `2>/dev/null` hides failures (PR #1234).
- Native Windows `jq`, `node` and `aws` can end lines in `\r`: strip it from any value that is compared, filled into a form or used as a key.
- A new strict check on input that existing callers already pass is a breaking change: prefer sanitize-with-warning. Check behavior at scale (100k+ items; spread syntax, whole-file reads). Anchor patterns (`"$ID"*` matches `ABC-1234` for `ABC-1234`).
- "Mirrors X" claims are literal: diff the semantics of logic duplicated in `.sh` and `.mjs`, and diff a new script against the CI step that solves the same problem. New code that copies an existing parser (regexes, entity decoding) is diffed against it on purpose, then reused or recorded as a known duplicate, since a later fix reaches only one copy (PR #1234, finding by a peer reviewer). Pitfalls (PR #1234): `LC_COLLATE=C` is overridden by `LC_ALL` (set by CI, WSL, Docker), so use `export LC_ALL=C` where order must match a Node `.sort()`; `readdirSync` with `e.isDirectory()` is false for a symlink while `[ -d ]` follows it.
- Do not decide success from a full URL: `location.href` includes the query string, so `/login?next=/home` matches "logged in". Check `pathname` and `host` separately (PR #1234).
- Match error-text patterns against the real tool messages, not a guess (a `case` on a short phrase misses the CLI's real `Token has expired and refresh failed`), and say whether each was reproduced. Every follow-up `jq` pass needs its own null handling (PR #1234).
- A documented override (env var, explicit CLI flag) is checked first, not as the last fallback. After introducing a resolver (`resolveProductNameRoot()`), grep for hand-rolled equivalents (PR #1234).
- A wrapper enforces what its name says (`gh-cache.sh` ran any `"$@"`). A shared helper in a general-looking path states its contract: internal to X, TTL, how to bust. A TTL cache derives staleness from the payload, not the caller (never cache an in-progress result long), has a bust path and an eviction cap, and keeps stderr out of cached stdout (PR #1234).
- After a behavior change, update usage text, headers and SKILL.md, and grep the old name repo-wide, including legacy forms the code still accepts. Stale docs are non-blocking unless the file loads into every session or the stale text is a copy-paste command (PR #1234, #1234).
- Names read from a remote list (artifact, branch, job) are untrusted input: a new match pattern such as a suffix regex widens what reaches an interpolated `bash -c` command, so charset-filter the name where the list is chosen, not only where the command is built. Run that filter against one live list first, since a too-narrow pattern drops legitimate items silently, e.g. '+' in 'Reqnroll+Xunit' artifact names. Report what the filter skipped (PR #1234).

## 4. Scope and planning
- Keep PRs to the ticket title, and make the title describe the real change ("Fix/cc j meter skill results parsing" for a rewrite of `execution.bat` is wrong). Separate convention or docs decisions, local tooling, and anything that writes to a shared environment; land the last kind last, and gated.
- A change that alters the measured baseline (load plans: think time disabled, samplers removed) ships separately and is called out, because results stop being comparable (PR #1234).
- Split follow-up tickets by design-readiness: one story per gap.
- Map the callers of every new shared file and mode. Zero callers (a `CI=true` branch no workflow calls is dead even when documented): cut or defer, after checking related tickets or asking the owner. One caller that is only a fallback for a path already allow-listed: delete the whole chain, prefer deleting a fallback over hardening it (PR #1234, #1234: ~415 lines cut).
- A new AI skill needs evidence it works in practice and no overlap with existing guidance (e.g. `implement-story`); split unrelated bundles (PR #1234).
- A new class of executable AI tooling needs a discovery entry and an ownership decision (`.github/CODEOWNERS`) as a stated merge condition; if deferred, record decision and ticket on the PR (PR #1234, ABC-1234).
- A doc that names a path existing only in another open PR must wait for it or drop the forward reference. State follow-ups with ticket or PR references (PR #1234).

## 5. Secrets and config (from PR #1234)
- Output is an exposure channel: a fetch that returns a whole secret lands all of it in the tool result and transcript. Filter at the source and return only the field needed. A command's stated rule ("never print the password") must hold for its own steps.
- Values that must agree (service URL and secret) come from one table, not parallel rules. Check config mappings against the code that consumes them, with `file:line`.
- A PR that claims to remove a hardcoded secret greps the whole tree, including fallback defaults (`appsettings`, `.env` samples), not only the file it rewrites. Out-of-diff leftovers go in a follow-up ticket. Removing the literal does not revoke it: ask for rotation or a rotation ticket (PR #1234).
- A temp file holding a secret goes in a per-user temp dir, not a shared tool folder, and is removed on every exit path; state what stays behind after Ctrl+C or a kill (batch has no `trap`). Masking text in docs must match what the script prints (PR #1234).
- Do not merge distinct entities in a normalization step (`default -> defaultvariation` collapsed two environments that both exist). Mark pre-existing issues the same fix covers as "pre-existing".

## 6. AI-instruction files (commands, skills)
**Wording and structure**
- One instruction per step. A second instruction for the same step, or a term left from a removed source (a removed column), is a finding.
- Wording must survive a literal reading by a stricter model ("Never in the same turn as X" can be read as "wait for the user").
- Do not rely on a tool parameter not confirmed for the MCP or tool version in use.
- Skill-selection guidance goes in the frontmatter `description:`, not the body (PR #1234).
- Skill-specific guardrails belong in the `SKILL.md` that needs them, not in a directory `AGENTS.md`. No review-thread narration, no pointers to personal `~/.agents` or private memory: state the rule inline (PR #1234).
- Instructions must be satisfiable and pointers must resolve ("read the subfolder README" fails when 6 of 20 have none; a "see X" to a removed section dangles). A pointer by section title is resolved against `<BASE_BRANCH_NAME>`, not the branch base, since a merged sibling PR can move the section (PR #1234, #1234). A pointer to a directory or to a path-scoped rule "whose paths: match" fails at planning and scaffolding time: Read cannot open a directory, and the rule loads only after a matching file is read, which does not exist yet for a new endpoint, service or library. Name the file (and heading) the step needs (PR #1234).

**Inputs and lookups**
- A lookup table covers every value the surrounding text accepts and says "stop and tell the user it is not supported" for the rest. Never map an unlisted value to the nearest row ("config" is not an alias for `cfg`: Config DSS is a separate, higher environment). Check the generator pattern per row (PR #1234).
- Spell out the input grammar: every optional token and its position (`[<env> [cfg] <variation>]`), which token is stripped, one example per URL shape (PR #1234).
- An ambiguous mapping  needs a stated default and trigger word, or asks. Say what happens when the login is missing, and gate a lookup followed by a dependent side effect on an exit code (PR #1234).
- A promised order must match the query. A hardcoded copy of a remote list drifts: flag it, or require a note that the store wins.

**How instructions load (verify with an `InstructionsLoaded` hook log from a headless `claude -p` run, not the docs, which are silent)**
- A session loads every parent `AGENTS.md` up to the drive root, so a root-level `<PROJECT_ROOT>/AGENTS.md` is redundant when the repo root has one. A subfolder `AGENTS.md` loads only when a file under it is read or edited. Check that a file's title matches its real scope ("Backend" over a backend plus frontend tree) (PR #1234).
- A negative instruction ("do not explore X") works only in the always-loaded root `AGENTS.md`; a nested file loads after reading has begun. Keep nested files for information new to the reader ("extends root AGENTS.md" is a no-op). A nested file restates a root carve-out, because proximity wins; prefer a generic exception ("any tool a skill points you at") to an enumerated list (PR #1234).
- Path-scoped rules load only for files under the folder the session started in; a file outside it loads no rule. Root rules load for subfolder sessions, and `--add-dir` rules load by file path (PR #1234).
- An `@import` inside a path-scoped rule loads at session start (load_reason `include`), not when `paths:` match; lazy loading needs the content in the rule body or a read-pointer (review of branch fix/ABC-1234).
- A `paths:` glob covers every place its topic lives: a rule file whose glob omits one of the folders holding that topic skips the rules there (PR #1234). A review skill's routing table follows the rules' own globs: a file matching the globs of two rule files is routed to both, so listing only one skips the other's rules (PR #1234).
- One home per rule, also inside one bullet: a line that summarizes a format and points to the doc stating it holds the rule twice. Keep the pointer alone (PR #1234).

## 7. Models
- Design and planning work needs Opus; Sonnet is not good enough for it (Teams, 2026-10-05). Opus found more code-level edge cases on a controlled-document review: use it there and add a human check.

## 8. Token optimization of AI-instruction files
Opportunistic: apply when a PR modifies a command, skill or other AI-instruction file. These load in full on every invocation, so each line is paid per run. Report as Non-blocking with the net line delta of the PR and a rough saving when obvious.
- Inline bash or parsing over a few lines moves to a helper script (`.agents/scripts/<name>.sh <args>`) that holds validation, call and output cleanup; the instruction becomes one line.
- Rarely needed sections (setup, troubleshooting, credentials) move to the wiki and link; keep the happy path inline.
- Cut text the harness already supplies: "When to use" repeating the frontmatter `description:`, performance notes, repeated explanations of the same wait, extra snapshots after a successful `wait_for` (take them on failure or timeout only).
- Commands the flow always runs need frontmatter `allowed-tools`.
- (PR #1234) Classify by load path first: (1) referenced by a `AGENTS.md` (auto-loaded), (2) referenced by `.agents/commands/*.md` (loaded on command), (3) orphan (humans only). Tiers 1-2 get the token lens, orphans accuracy and maintainability. Say which lens is used.
- (PR #1234) Test each added line: what would the agent do differently without it? A line restating the workflow, the description or a config is dead weight. Do not duplicate a `SKILL.md` detail in an auto-loaded `AGENTS.md`.

## 9. Documentation accuracy
- A doc statement about what a skill or script does (who calls whom, defaults, files read) is a hypothesis: grep the callers first, and scope the claim to the components that actually reference the thing. PR #1234: the manual said the skill runs a shared DB query helper, while its script runs `docker exec ... psql` itself.
- One canonical statement per claim: a manual, a skill and a `AGENTS.md` that state a default must agree with each other and the source.
- No drifting counts or lists ("~21 smoke tests", "N skills"); use the category name. Non-blocking even when pre-existing, if in the touched neighborhood.
- Do not mirror a config file in prose ("the only MCP server is X") or hand-maintain a mirror of a directory or list that tooling derives (inventory tables, `AGENTS.md` path lists, PR #1234): typical drifts are rows for nonexistent files, missing real files, wrong invocation format. Delete the table and point at the directory. Exception: an inventory that replaces an expensive repo sweep (a feature map). If a PR removes mirrors from file A, check the file B it also edits (PR #1234, #1234).
- Doc text must not create a behavioral trap: ask what someone does after reading the sentence. Rank above wording nits (PR #1234). A "check before run" doc for a multi-clause filter (`a|b|c`) must say that the check reports only when all clauses miss, and tell the reader to check each clause on its own (PR #1234).
- Word CLI-flag claims as the real control flow ("required only in a non-interactive session", not "`--yes` is required" when a TTY prompts y/N) (PR #1234).
- No editing-instruction text or TODO as a document heading.

## 10. AI-config governance and CI
- `.github/CODEOWNERS` is last-match-wins: a new `AGENTS.md` or `.agents` file needs an owner entry or it skips the review gate, and earlier specific lines are shadowed by later directory rules (`<PROJECT_ROOT>/web/` over `<PROJECT_ROOT>/web/AGENTS.md`). Prefer one `**/AGENTS.md` glob below all directory rules with a comment that order matters. Re-derive the hunk on current `develop`: "accept ours" on a stale branch reverts others' changes, so the diff must show only intended lines (PR #1234).
- A "No newline at end of file" marker can hide a trailing `\r` added by the Edit tool or a Windows editor. Keep diffs on gated files to the intended change (PR #1234).
- Every CI step must be able to fail and must check something. Typical defects: `find` in a process substitution loses its exit status (passes with zero files checked); `node ... || status=1` without `exit $status` always returns 0; a wrong path gives a false green; `node file.json` runs nothing. Wired paths exist on `develop`, and the `paths:` trigger matches the PR's own new files. If nothing can grade the thing (an LLM eval set), delete the step rather than keep a placeholder. Fixing a masked-broken step can turn CI red for everyone: check merge order (PR #1234, #1234, fixed in #1234).
- If a review thread says "removed", the final diff must agree. A silent re-add is Blocking (PR #1234).
- A new global requirement for a directory must be checked against files of a different kind already on `develop` and in open PRs (a rule requirement breaks step-by-step recipes such as `permissions.md` on merge). Scope it to the kind of file it fits (PR #1234).
- Judge a convention by what it changes in loading: a citation by ID loads nothing, a file pointer makes Claude open the file. When the stated cause is "files too large or load too broadly", the fix is topic files with tight `paths:` plus a general file per area, not a permanent-identifier layer. Check each rule against the code before it becomes permanent: known-wrong rules (nonexistent `[Binding]` hooks, wrong base class) become cited truth (PR #1234).

## 11. C# conventions
- (PR #1234) Do not strip `[Obsolete]` to silence a warning. If the symbol is still used, keep the marker as the interim signal and open a story to remove or replace it. Delete dead public API at the next major version when removal is breaking (V3.0; "no need to fix for RC2"). A method with no callers that still references an obsolete member should itself be `[Obsolete]`, so the deprecation propagates.
- A migration that replaces a unique index with a narrower partial index breaks old code that uses `ON CONFLICT (col) WHERE <old predicate>` (PostgreSQL 42P10) during a rolling deploy and on rollback; ask how deploy order and rollback are handled (PR #1234).
- A change to a shared persistence or infrastructure class (audit repository, base context) alters every service that uses it: title and body must state that blast radius, and a test must pin the value written (e.g. the user stored in tx_user); a helper that now runs on every write must not throw on bad input (SingleOrDefault on a claim) (PR #1234).

## Where these are applied
- `~/.agents/AGENTS.md` (root cause, verification)
- `skills/git-code-review/SKILL.md`: stance, ownership modes, and a Type lenses table routing each change type to sections of this file. This file is the source of the checklists: a new insight goes here, and the skill's table changes only for a new change type or a new top check.
