---
name: git-pr-description-write
description: Write or update a GitHub PR description - covers both drafting a brand-new one and refreshing/appending to an already-open PR's existing body (e.g. after a follow-up commit lands), even when the change looks small or mechanical. Produces a lightweight, reviewer-skimmable body (Ticket link, Issue/Why/Changes/Verification, or a Lean Summary for cherry-picks/backports) instead of a hand-written `gh pr edit --body`. Use when - "write PR description", "create pull request description", "update PR", "update the PR description", "update the PR body", "add this to the PR description", "reflect this commit in the PR description", "summarize changes for PR", "refresh the PR description".
---

# git-pr-description-write

Generate lightweight, easy-to-skim PR descriptions. The diff already holds the technical detail - the description orients the reviewer (what's wrong, why, what changed, what to expect), it doesn't restate the code.

## Core Writing Principles

Purpose, audience, and base writing rules (reader-friendly language, concise paragraphs, structure-over-prose, technical-name inline-code + nested-bullet-with-description, conciseness) follow `~/.agents/rules/writing_style_for_markdown.md`'s "PR descriptions" per-consumer entry and its shared rules - don't duplicate those here. PR-specific deltas on top of that base:

- **Emphasis with intent.** Bold the word that carries the meaning - a lead verb/outcome in a Changes bullet, a key term in prose - never bold for decoration.
- **Icons only when they add clarity.** The ✅/❌/🟠 status emoji and the `[!NOTE]`-style callouts (both defined under Format Principles below) are the only icons this skill uses, and only where they mark a real status or flag a fact a skimming reviewer must not miss - never as decoration on a neutral, non-status bullet.
- **As compact as possible without losing the essential change and its justification.** The reviewer already has the Files Changed tab - default to the shortest phrasing that still tells them what changed and why it's safe/needed. Cut a clause, a sub-bullet, or a whole section rather than pad it out; see the per-section compactness notes in Changes/Expected Outcome/Out of Scope below and the Length target under Format Principles.
- **Written for the reviewer, not as a process log.** The description exists so someone else can understand and approve the change - it's not a record of how the change was arrived at. Omit internal back-and-forth (draft revisions, "changed this after reconsidering X"), bookkeeping notes that made sense mid-task but tell the reviewer nothing about the change itself, and any caveat that exists only because *you* were tracking it, not because a reviewer would otherwise be confused or ask about it. Ask "would a reviewer who wasn't in the room need this?" - if no, cut it even if it's true and was part of the actual work.

## When to Use

- Creating PR descriptions for bug fixes, feature implementations, refactors, test fixes
- Updating existing PR descriptions to improve clarity
- After code changes are complete and ready for review

## Template Styles

See [templates.md](./templates.md) for:
- Which style to use (Lean Summary vs. Full Template)
- Complete template structure for each style
- 5 worked examples (metric-driven fix, root-cause bug, docs-only, bundled concerns, per-case breakdown)
- Anti-patterns to avoid

## Format Principles

Base formatting (GitHub alert blocks, status emoji, bullets-over-tables, sentence/paragraph style, plain hyphens) follows `~/.agents/rules/writing_style_for_markdown.md`.

Key format rules:
- **Alert callouts** (max 1-2): `[!IMPORTANT]` for root causes, `[!WARNING]`/`[!CAUTION]` for risks, `[!NOTE]` for non-obvious context, `[!TIP]` for follow-ups
- **Status emoji** (✅/❌/🟠): on Verification/Definition of Done bullets, Expected Outcome bullets stating outcomes, per-case Status lines
- **Bullets over tables** - convert every table row to a bullet with reason folded in after a dash
- **Lengthy verification:** when a reviewer repeats more than ~3 manual steps, keep the Verification bullets as the executive summary and nest the steps in a collapsible `<details>` as a child of the related bullet (see templates.md § Verification / Definition of Done)
- **Executive summary first:** 1-3 plain-language lines under the Ticket link: what the PR does, the risk or open point, what the reviewer must decide or check. A reviewer who stops here must still know the state. Expand acronyms; no code names in this block unless unavoidable
- **Documentation section** when the PR adds or changes docs (wiki, `docs/`, README): one bullet per page, linked, with a 5-10 word note on what changed there. Wiki pages are listed by full link, never "wiki updated" (see templates.md § Documentation)
- **Verification: at most 5 top-level lines**, one status each. Group same-kind checks into one line with the count. Per-run commands, counts, environments and evidence go in a collapsed `<details>` child of the line they support (see templates.md § Verification / Definition of Done)
- **Complex test scenarios:** one collapsible panel per scenario, named like its Verification line. Steps while 🟠. When verified, the same panel records who, environment, date and outcome per step, and the line turns ✅ (templates.md § 7). Ask for any missing fact, never invent it
- **Mixed audience:** write each top-level line for a reviewer who does not know the area. Put precise names in sub-bullets or `<details>`, not in the first clause
- **Length target:** 15-25 visible lines total (Executive summary + Issue + Changes + Documentation + Verification); a collapsed `<details>` block does not count
- **Shorter is better** - cut any section that doesn't answer a reviewer's actual question
- **Changes bullets: high level, 4 max, one plain-language fact and about 15 words each** - say what behaviour changes, not which files or functions. File, function and setting names go in one collapsed `<details>` "Code and script changes" block after the bullets, for the reader who wants the code (see templates.md § Changes)

For detailed format guidance, examples, and anti-patterns, see [templates.md](./templates.md).

## Workflow

### Automatic: Extract PR Context

Before processing, extract PR context into structured JSON:

```bash
SKILL_DIR="$HOME/.agents/skills/git-pr-description-write"
PR_CONTEXT=$(node "$SKILL_DIR/extract-pr-context.mjs" "<input>" 2>&1)

if echo "$PR_CONTEXT" | grep -q '"error"'; then
  echo "Failed to extract PR context: $PR_CONTEXT"
  exit 1
fi

echo "PR Context (structured, optimized for Claude):"
echo "$PR_CONTEXT"
```

**Context includes:**
- PR metadata (number, title, base/head branches)
- ticket ID (extracted from branch or title)
- PR type classification (`"lean-summary"` vs `"full-template"`)
- Latest 5 commits + messages
- Changed file list (deduplicated, excludes assets/generated code)
- Metrics hints (quantifiable language detected)


### Apply Template

Using the structured context (`prType` picks the template):

1. **Determine style** from `prType` field:
   - `"lean-summary"` → use Lean Summary template (cherry-picks, backports, reverts)
   - `"full-template"` → use Full Template (original logic/fixes)

2. **Gather missing context:** If incomplete, ask user for:
   - Reason/motivation if not in commit messages
   - Metrics if they're not quantified in the `metrics` array

3. **Apply format:** Executive summary → Issue → Changes → Expected Outcome → Documentation → Out of Scope → Known Issues → Verification

4. **After posting:** Print Section Links for easy navigation
