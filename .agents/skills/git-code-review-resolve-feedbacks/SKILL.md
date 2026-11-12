---
name: git-code-review-resolve-feedbacks
description: 'Resolve unresolved GitHub PR review threads on this repository: read each comment, reply, mark resolved. Trigger on "resolve PR feedback/comments/threads", "reply to reviewer comments", "address code review feedback", or a PR URL/number plus "resolve"/"reply"/"close", also as one step of a larger PR-housekeeping request. Accepts a PR URL or number. Not for: merging/approving, git merge conflicts, new review comments, or read-only questions about open threads ("summarize the open threads").'
---

# git-code-review-resolve-feedbacks

For every unresolved review thread on a PR: read the comment, decide what changed (or not), reply, resolve. The judgment is yours per thread. `resolve-feedback.mjs` does the `gh`/GraphQL plumbing.

Set these once, then the commands below work as written:

```bash
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"   # owner/name of this clone
OWNER="${REPO%%/*}"
NAME="${REPO##*/}"
```

## Workflow

```bash
SKILL_DIR=~/.agents/skills/git-code-review-resolve-feedbacks
node "$SKILL_DIR/resolve-feedback.mjs" parse "<input>"            # -> {"owner","repo","prNumber"}
node "$SKILL_DIR/resolve-feedback.mjs" fetch "$OWNER" "$NAME" 22515     # -> [{"threadId","comments":[{"commentId","body","path","line","commitId"}]}]
```

If `fetch` returns `[]`, report "No unresolved threads." and stop. For each thread:

1. **Read every comment** in order, then the file at `path`/`line` for its current state.
2. **Classify:**
   - `ALREADY_CORRECT` - addressed in a later commit; no change.
   - `NEEDS_FIX` - issue still there; fix it first. Never resolve a thread whose fix is not in place.
   - `DECISION` - design question; reply with the choice and why.
   - `ACKNOWLEDGED` - valid observation already applied; confirm it.
3. **Reply** (body in a temp file), then **resolve**:

```bash
node "$SKILL_DIR/resolve-feedback.mjs" reply "$OWNER" "$NAME" 22515 <commentId> <path> <line> <commitId> /path/to/reply.txt
node "$SKILL_DIR/resolve-feedback.mjs" resolve <threadId>
```

**Top-level summary comment** (e.g. "all N threads addressed"): always use `comment`, never an ad hoc `gh api ... -f body=@file` (it posts the literal string `@file`; this corrupted PR #1234 once).

```bash
node "$SKILL_DIR/resolve-feedback.mjs" comment "$OWNER" "$NAME" 22515 /path/to/summary.txt
```

**A top-level comment that answers another top-level comment must point at it** (they cannot be threaded). Applies to every PR comment you post, also outside this skill. Open with a Quote-reply block, then the answer. No "Replying to <name>" label.

```
> <the 1-3 lines you answer>
> [source](https://github.com/<owner>/<repo>/pull/<n>#issuecomment-<id>)

<the answer>
```

- Quote the key lines only; cut long lines with `...`; do not change the kept words.
- Link target: `#issuecomment-<id>` (review comments `#discussion_r<id>`, reviews `#pullrequestreview-<id>`); get the id from `gh api repos/<owner>/<repo>/issues/<n>/comments`.
- Never write a bare `@name` in the quote: it notifies that person.
- Several comments in one post: one quote block each, in comment order.
- Thread replies (`reply`) do not need it.

## Reply content rules

- **No preamble.** No "Thanks", no "Good question", no intro sentence. The first word is the answer. (The quote block above is the only allowed opening.)
- **State what is true now**, not what will be done: "Fixed - X", not "I will fix X".
- **Several points: answer each in the reviewer's order**, one to two sentences each, no merging, no transitions. Name the choice and the one-sentence reason; do not restate the question.
- **Short sentences, short paragraphs**: one idea per sentence, blank line between paragraphs.

Example, comment: "Why a static dictionary instead of a distributed cache? Also, should the retry count be configurable?"

> Static dictionary is process-local by design - session data doesn't need to survive restarts, so a distributed cache would be unused overhead. Not configurable yet - single caller, fixed retry count of 3 is sufficient for now.

## Length and level (every PR comment, review body and summary you post)

Apply without being asked, also when the user only says "consolidate", "summarize" or "post it". Readers have varying technical backgrounds and little time.

- **Open with one line:** the outcome and what you need from the reader.
- **At most 5 bullets**, one fact or ask each, about 20 words or fewer. Use `- [ ]` when the reader must act.
- **Name the action, not the evidence.** No file:line chains or "how I checked" unless needed to act; put detail in a linked comment.
- **Plain words first**; code names only where the reader must find them.
- **Do not repeat earlier text.** Link it.
- **Skim test:** can a reader act within 30 seconds? Over about 120 words needs a reason.

## Report format

After all threads, print:

```
| File | Line | Action | Reply |
|------|------|--------|-------|
| <PROJECT_ROOT>/Foo.cs | 42 | ALREADY_CORRECT | "Null check still present - no change." |
```

## Errors and notes

- Invalid PR ref: `parse` exits 1 with usage. PR not found: `fetch` exits 1 naming the PR. gh unauthenticated: "Run: gh auth login".
- Source file not found: say in the reply that it could not be verified; do not resolve.
- `fetch` already drops reply-only entries (no `databaseId`).
- Threads that already have a reply are still validated and resolved if the concern is addressed.
- On option-A-vs-B design questions, default to the simpler option unless the user stated a preference.
