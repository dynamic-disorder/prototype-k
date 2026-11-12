# PR Description Templates & Examples

## Which Style: Full Template or Lean Summary

Two shapes, chosen by what kind of change the PR actually contains - not by whether it touches source files.

**Use the Lean Summary style (below) for mechanical/procedural PRs** - the "why" is inherited from somewhere else, not invented by this PR:
- Cherry-picks and backports onto a release/hotfix branch
- Reverts
- Dependency/package version bumps with no behavior change
- Conflict-resolution-only commits (e.g. merging a branch and resolving merge conflicts, with no new logic added)
- Any PR whose entire purpose is "bring change X, already reviewed/merged elsewhere, onto branch Y"

**Use the Full Template (Issue/Why/Changes/...) for everything else** - any PR introducing original logic, a new fix, a new feature, or a behavior change that a reviewer needs oriented on, even if the diff is small. Code changes alone don't trigger the full template; *original* changes do. A one-line config fix with a genuine root cause still needs an Issue section; an 11-file cherry-pick with zero original logic does not.

If genuinely unsure which bucket a PR falls into, ask rather than guessing.

## Lean Summary Style

Structure:
```markdown
## Summary
- What this PR brings in and from where (e.g. "Cherry-pick of <sha> (#<pr>) onto <branch>")
- The one or two sentences of *inherited* context needed to place it - not a full Issue writeup, since the original PR/commit already carries that
- Any notable mechanical detail a reviewer should know before approving: conflicts resolved and how, version/config deltas, anything that isn't a straight port

## Test plan
- [x] or [ ] checkboxes - the actual command run and its result (e.g. `` `dotnet build X.sln` - 0 errors ``), or a check still pending
```

Rules for this style:
- No Ticket link header, no `---` separator, no Issue/Why/Changes/Expected-Outcome/Verification sections - just `## Summary` and `## Test plan`.
- `## Summary` is flat bullets, no subsections - even conflict-resolution detail is one bullet, not a breakout.
- `## Test plan` uses literal GitHub checkboxes (`- [x]` / `- [ ]`), not the ✅/❌/🟠 emoji convention used by the full template - the two styles have separate status conventions, don't mix them.
- Still no tables, no em dashes, no file:line references.
- Still extract and include the ticket if one exists, but inline as plain text in a Summary bullet (e.g. "Fixes ABC-1234, cherry-picked from develop") rather than the full template's dedicated linked header - the ticket is context for one bullet here, not the PR's whole framing.

### Lean Summary Example

```markdown
## Summary
- Cherry-pick of bb9a60677a (#1234) onto release/version2.10.3emergency
- Reserves 1400 bytes in the SNS/SQS size checks for the "_datadog" message attribute the Datadog APM tracer injects after our own size checks run, fixing intermittent BatchRequestTooLongException
- Lowers the attribute-count cap from 9 to 8 since "_datadog" consumes one of AWS's 10 slots
- Two conflicts (AwsClientExtensions.cs, AwsClientExtensionsTests.cs) resolved by taking develop's version - the divergence was AWS SDK v4 null-safety guards, which don't apply here since this branch is pinned to SDK v3.7.x

## Test plan
- [x] `dotnet build MySolution.sln` - 0 errors
- [x] `dotnet test --filter FullyQualifiedName~AwsClientExtensionsTests` - 40/40 passed
```

---

## Full Template Style

Generates PR descriptions following this structure. Busy reviewers should be able to skim it in under 30 seconds.

### 0b. Executive summary (1-3 lines, right after the `---`)
- Heading `### Executive summary`. Plain language, no unexpanded acronyms, no file or class names unless unavoidable.
- Line 1: what the PR does and why it matters. Line 2 (if any): the open point or risk. Line 3 (if any): what the reviewer must decide or check.
- A reviewer who reads only this block must know whether the PR is safe, what is still open, and what is asked of them.
- Skip it only when the Issue is already one short sentence.

### 1. Issue (what's wrong - 2-3 sentences)
- **First sentence must be plain-language** - readable by a non-technical stakeholder with zero context. Expand acronyms/internal shorthand on first use (e.g. "the API (application programming interface)", not just "the API"). Save precise technical framing for the sentences after it.
- State the problem or defect first, before any explanation. Reviewers need the "what" before the "why".
- Quantify whenever a number exists: log volume, error count, affected rows, response time, dates. A bare claim ("logs increased") is weaker than a measured one ("logs grew from ~9M to ~20M events/day").
- Simple, short sentences. One idea per sentence. No "but... so..." run-ons.
- If the PR covers more than one distinct concern (e.g. main fix plus an unrelated cleanup), give each its own short paragraph, separated by a blank line.
- If the root cause is the single fact a skimming reviewer must not miss, surface it in a `> [!IMPORTANT]` callout (see **Callout blocks** in main SKILL.md) instead of burying it mid-paragraph.

### 2. Why (only if not already covered by Issue)
- 1-2 sentences or bullets on the underlying cause or motivation for fixing it now.
- Skip entirely if the Issue section already makes the motivation obvious - don't repeat.

### 3. Changes (what we changed)
- **Bullets only. Never a table.** Tables read fine to the author who built the mental model; they read as a wall of cells to everyone else skimming on a phone or between meetings.
- One bullet per logical change, phrased as a short sentence - not a file list, not a comma-joined string.
- Lead each bullet with a **bolded verb or outcome word** (`**Fixed**`, `**Added**`, `**Removed**`, `**Renamed**`) so a reviewer scanning only the bold text still gets the gist.
- **High level first: what changes in behaviour, not which code was touched.** Most readers want the gist. A top-level bullet says what the system, tool or user can do now, in plain words a person without code knowledge follows. Good: "**Changed** the investigation tool to read the exact test result file first". Bad: "**Added** `api-trx.mjs` with `chooseArtifacts` and `parseApiTrx`". No file, function, class, flag or package name in the bullet unless the reader cannot place the change without it.
- **Skim budget: at most 4 top-level bullets, each one fact in about 15 words, one sentence.** A bullet that needs a second sentence, a semicolon, or an "Order:"/"Details:" tail is two bullets or a cut. Every clause must pass "would the reviewer miss it?" - otherwise drop it (version bumps, package lists, and sequencing rules the diff already shows).
- **Code and script detail goes in one collapsed block after the bullets, for the interested reader:** `<details><summary>Code and script changes</summary>` holding one `` `Name` - short description `` bullet per file, function or setting. Skip the block when the high-level bullets already say everything. It does not count toward the length target. Never put these names in the top-level bullets or chain them with commas or "and" in a run-on line.
- **Multi-sub-task PR: one bullet per sub-task**, leading with the linked ticket, then the one-line outcome: `- **Added** login credentials to the UI tests - [ABC-1234](url)`. Shared behavior (resolution order, error text) goes once in a nested list or the Issue section, not repeated per bullet.
- No file:line references and no code snippets - the diff already shows this.
- Group mechanical/similar changes (renames, repeated config edits across services, payload updates) into a single bullet instead of one bullet per file.
- **Name the file only when it disambiguates or the reviewer would otherwise have to guess which of several similar workflows/files changed.** If there's exactly one plausible place a change like this could live, or the bullet already makes it obvious, skip the filename - the Files Changed tab has it.
- **Justify only what isn't self-evident from the diff.** A rename, a delete, or a value swap that reads as obviously correct on its own needs no reason clause. Add a dash-reason only when a reviewer could otherwise reasonably ask "why not just X instead" - that's the bar, not "could I add more context here."
- If a change needs a one-line reason, put the reason in the same bullet after a dash, don't split it into a separate column or subsection: `- **Raised** the Forwarder log level to Information, not Warning - preserves route/health diagnostics while still cutting request-level noise`
- Nest sub-bullets under a parent bullet only when 2+ supporting facts would otherwise be crammed into one run-on line, and only if each fact changes how the reviewer should assess risk (e.g. "scoped to these two tests only"). Don't nest a fact that's already visible by opening the file:
  ```markdown
  - **Fixed** the race condition in the save-wait helper
    - Added a retry with exponential backoff
    - Scoped the fix to `TC_10866` and `TC_34771` only
  ```

### 4. Expected Outcome (what should happen after this ships)
- **Default to one sentence or one bullet.** Use 2+ bullets only when there are genuinely separate, independently checkable outcomes (e.g. a metric plus an unrelated "no regression in X").
- Reuse the metric from the Issue section where possible (e.g. "expected ~5-8M events/day reduction" if the Issue quoted a volume number), so the reviewer can connect problem to result without re-reading.
- If the outcome can't be measured yet (no metric available), state what to watch instead: which dashboard, which environment, what "looks fixed" means concretely - in one line, not a walkthrough.
- Skip this section entirely if it would just restate a Changes bullet in different words (e.g. Changes already says "fixes the dead sonar scan" - don't add an Expected Outcome bullet that only repeats "the sonar scan will now run").

### 4b. Documentation (when the PR adds or changes docs)
- One bullet per page, as a full link, with a 5-10 word note on what changed there. Order by importance.
- Wiki pages live in a separate repo: link `https://github.com/$REPO/wiki/<Page-Title>`. Add "(separate wiki repo)" once, not per bullet.
- In-repo docs (`docs/`, README): relative path only if the file exists on `develop`, else link the PR.
- Never write "wiki updated" without the page names. Skip the section when no docs changed.


### 5. Out of Scope (optional)
- Bullets: what was deliberately **left out by choice** - a decision, not a failure. One line each: the thing left out, then the reason after a dash. No elaboration beyond that one reason.
- Merge trivial exclusions into a single bullet rather than one bullet per item, when they share the same underlying reason (e.g. "cost/no-benefit" covering two unrelated skipped optimizations).
- Don't use this section for things that were attempted but didn't fully work - that's **Known Issues / Remaining** below. Mixing the two hides real gaps behind what reads like a deliberate decision.
- Before adding a bullet here, check whether a broader statement elsewhere in the description (e.g. a scope note in Issue) already implies it. If so, drop the narrower one instead of keeping both - a caveat that only restates a subset of a point already made is padding, not new information.

### 6. Known Issues / Remaining (optional, but required if anything is still broken or unresolved)
- Bullets: what this PR **could not fully fix**, or a new problem it surfaced along the way.
- Every bullet is a status line - apply the ❌/🟠 emoji (see main SKILL.md § Format Principles): ❌ for still-broken/reproducible, 🟠 for a follow-up that's tracked but not yet done.
- Name the concrete next step where one exists (a linked ticket, "needs backend fix", "needs a second reviewer to confirm on Alpha") - a bare "still broken" with no next step reads as abandoned, not tracked.
- If the count of unresolved items is large enough to need per-item detail, use the **Per-case breakdown** shape (below) instead of a flat list here.
- Omit this section entirely only when the PR is fully resolved with nothing outstanding - don't write "None" as a bullet.

### 7. Verification / Definition of Done
Pick the section title based on what the PR actually contains:
- **Verification** - use when the PR changes code (build/test/manual-check evidence applies)
- **Definition of Done** - use when the PR has no code changes to verify (docs-only, config/data-only with no build step, process/ticket housekeeping) - list the completion checklist instead of build/test evidence
- If genuinely unsure which fits, ask rather than guessing which one to use

**Verification** bullets: build status, tests run + result, manual check performed. State facts only, no narrative.

**Definition of Done** bullets: concrete, checkable completion criteria (e.g. "Doc reviewed by X", "Ticket linked and status updated", "Renamed file matches naming convention"). Avoid vague criteria - only list something as done if it was actually confirmed.

Apply the status-indicator emoji (see main SKILL.md § Format Principles) to each Verification/Definition of Done bullet: ✅ a check that passed/was confirmed, ❌ a check that failed or is broken, 🟠 a check still pending.

**Verification budget: at most 5 top-level lines.** One line per kind of check (build, unit tests, live runs, blocked or pending). Merge same-kind checks into one line with the total ("Resolver unit tests pass in all 3 frameworks"). Put the per-framework or per-environment counts, run names and evidence in a collapsed `<details>` child of that line (`<summary>Run details</summary>`). A reviewer should read the status of every check in about 20 seconds without opening anything.

**Lengthy verification (more than ~3 manual steps a reviewer repeats):** keep the Verification bullets as the executive summary, one status line per check with its outcome. Put the repeatable baby steps in a collapsible `<details>` block as a **child of the bullet it explains** (indent it under that bullet), not as a separate section at the end. Each step: the shell or tool label (🟢 Git Bash, Claude Code prompt), the exact command or prompt, and a pass criterion. Say who can run it and how long it takes in the `<summary>`. Follow `rules/writing_style_for_markdown.md` § "Instructions that someone else runs": one numbered list of actions, no separate "Prerequisites" of states, assume a clean machine (create the file or secret if missing), command then "Check:" per step, one guide for all testers. List only human-arranged needs (account access, installs) in a one-line "You need" before step 1.

```markdown
- ✅ Live check on a scratch test case: update works, bad input is rejected, steps untouched
  <details>
  <summary><b>Reviewer steps: repeat the live check yourself (about 15 min)</b></summary>

  **1. Build the branch** (🟢 Git Bash)
  ...
  - Pass: `npm run build` ends without errors.

  </details>
```

Keep a blank line after `<summary>` and before `</details>` so markdown inside renders.

**Complex test scenarios: one panel per scenario, same name as its Verification line.** A scenario is complex when it has more than ~3 steps, needs a setup, or compares several outputs. Rules:
- **Name match.** The `<summary>` repeats the wording of its Verification line (same key words, so a reader finds the panel from the line). Example: line `🟠 Compare queries 3, 4, 5b with the UI`, summary `Compare queries 3, 4, 5b with the UI`.
- **While not verified (🟠).** The panel holds the repeatable steps (rules above) and ends with an empty result block, so the next person fills it in place:
  ```markdown
  **Result** (fill in when done)
  - Verified by: 
  - Environment: 
  - Date: 
  - Outcome: 
  ```
- **When verified (✅).** Edit the same panel, do not add a new one. Switch the Verification line and the `<summary>` marker to ✅, and fill in the result block:
  - **Verified by**: the person, with a link to the PR comment or run when it exists.
  - **Environment**: the system tested, with the branch or commit, and the database where relevant.
  - **Date**: `yyyy-mm-dd`.
  - **Outcome**: one bullet per step or check with its observed result (value or output, not only "ok"). Add what did not match, and what was not compared and why.
- **Failed (❌).** Same block: record who, where, the step that failed and the observed output. Leave the steps in place.
- **Never invent the result.** Fill person, environment and outcomes only from facts in the conversation, the PR comments or run output. If one is missing, ask. Do not mark a panel ✅ without a named person and environment.
- Keep the panel under the Verification line it belongs to (child of the bullet), and keep the top-level lines within the budget of 5.


### 8. Section Links (quick-copy anchors)
GitHub auto-generates an anchor ID for every markdown header, so any `## Section` heading is already reachable at `<pr-url>#<anchor-slug>`. No extra markup is needed inside the PR body itself - the anchors are a byproduct of using plain `##` headers, which this skill already does.

After creating or updating the PR (i.e. once the PR URL is known, from `gh pr create` output or an existing PR), print a **Section Links** list in the chat response (not inside the PR body) so the user can copy a direct link to any section:

```
Section links:
- Issue: <pr-url>#issue
- Changes: <pr-url>#changes
- Expected Outcome: <pr-url>#expected-outcome
- Documentation: <pr-url>#documentation
- Out of Scope: <pr-url>#out-of-scope
- Known Issues / Remaining: <pr-url>#known-issues--remaining
- Verification: <pr-url>#verification
```

Only list sections actually present in that PR body, in the order they appear.

**Anchor slug rule** (GitHub's heading-to-anchor algorithm):
- Lowercase the heading text
- Replace spaces with hyphens
- Strip punctuation (keep only letters, digits, hyphens)
- Examples: `Issue` -> `issue`, `Expected Outcome` -> `expected-outcome`, `Out of Scope` -> `out-of-scope`, `Definition of Done` -> `definition-of-done`

**Uniqueness caveat:** GitHub appends `-1`, `-2`, ... to duplicate headers within the same body (e.g. two `## Issue` headers -> second one anchors to `#issue-1`). Since this skill emits each section header once per PR body, this shouldn't come up - but if a PR body ever repeats a header, verify the anchor by checking the rendered PR page before sharing the link.

---


---

## Anti-patterns to Avoid

- **A table in the Changes section** - even a well-organized File/Change/Why table is slower to skim than bullets; convert every row to a bullet with the reason folded in after a dash
- A summary sentence chaining two concerns with "but"/"so"/"and this also" - split into sentences or paragraphs
- Comma-separated file or change lists - always bullets
- File:line references or code snippets duplicating the diff
- Restating "why" when the Issue already explains it
- Skipping Expected Outcome - reviewers should know what "this worked" looks like without reading the whole diff
- A Root Cause section with exact error text/evidence for routine fixes - one bullet is enough
- Subsections per file/commit for mechanical or bundled changes - one bullet per concern
- Vague summary that doesn't say what actually changed
- Unverified claims - only state what was actually run or actually confirmed done
- Padding to hit a length target - shorter is better if nothing is lost
- Em dashes or other non-hyphen dash characters anywhere in the output
- Labeling a no-code PR's closing section "Verification" when nothing was built or tested - use "Definition of Done" instead
- A status line (Verification bullet, Definition of Done bullet, per-case Status) with no ✅/❌/🟠 indicator - every stated outcome needs its color signal
- A Changes bullet naming the exact filename when there's only one plausible file it could be and the bullet text already makes the change obvious - the Files Changed tab has the filename
- Multi-bullet Expected Outcome or Out of Scope sections where one bullet would say the same thing - each extra bullet must add a genuinely separate, independently checkable fact, not a rephrasing
- Explaining a change that's self-evidently correct (an obvious rename, an obvious delete of dead code) with a justification clause anyway - reserve reasons for changes a reviewer could plausibly question
- Slapping ✅ on every bullet regardless of whether it states a status - neutral descriptive bullets (what a change does, not whether it worked) don't get an emoji
- Applying the Full Template (Issue/Why/Expected Outcome) to a cherry-pick, backport, or revert that has no original logic to explain - use the Lean Summary style instead
- Using the Full Template's ✅/❌/🟠 emoji convention inside a Lean Summary style's `## Test plan` - that section uses plain `- [x]`/`- [ ]` checkboxes instead
- Reaching for the Lean Summary style just because a PR is small or the diff is short - smallness isn't the trigger, "no original logic to explain" is; a one-line fix with a genuine root cause still gets the Full Template
- Burying a still-broken or unresolved item inside Out of Scope - Out of Scope is for deliberate exclusions only; anything attempted-but-not-fully-fixed goes in Known Issues / Remaining
- Writing a Known Issues bullet with no next step ("still broken" and nothing else) - name the ticket, the owner, or what would need to happen next
- A `> [!IMPORTANT]`/`> [!WARNING]` callout on every section, or one that just repeats a bullet verbatim - callouts lose their signal value if they're not rare
- An Issue section whose first sentence assumes reader context (unexpanded acronyms, internal shorthand) - a non-technical reviewer should follow the first sentence unaided
- A Changes bullet with no bolded lead word - the bold text is what a skimmer reads first, so every bullet needs one
- A heavy Changes bullet: several ticket links, a precedence/order list, or two sentences in one bullet - split by sub-task, nest the list, or cut what the diff shows
- A Changes bullet written as a code inventory ("**Added** `x.mjs` ... **Updated** `SKILL.md`") - it reads as a file list. Say what behaviour changed, and move the names to the collapsed "Code and script changes" block
- An Out of Scope (or other) bullet that just restates, more narrowly, what a broader scope statement elsewhere in the same description already said
- No Executive summary, so a time-limited reviewer must read the whole body to learn the state and what is asked of them
- More than 5 top-level Verification lines, or per-run counts, environments and commands inline instead of in a collapsed `<details>`
- A Documentation section that says "wiki updated" without the linked page names, or lists pages that did not change
- A top-level line whose first clause needs area knowledge (class names, flag internals) - lead with the plain outcome, move names to a sub-bullet
- Tester or reviewer steps with a "Prerequisites" list that only describes states ("`~/.aws/config` has ...") instead of steps that create them, or with separate guides per tester
- A complex test scenario with no collapsible panel named like its Verification line, a ✅ without a named person and environment in that panel, or a result written into a new panel instead of the existing one
- Any line that only exists because the author was tracking it during the work (a revisited sub-decision, a "changed my mind on X" note, other process bookkeeping) rather than because a reviewer needs it to understand or approve the change
