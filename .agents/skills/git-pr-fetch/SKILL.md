---
name: git-pr-fetch
description: 'Fetches GitHub PR review comments, filtered to unresolved threads only (resolved discussions dropped). Shows file:line references. Trigger on "check PR comments/threads/conversations", "what feedback is open on this PR", "find open review threads", "does this PR have unresolved comments", a PR URL/number plus "comments"/"threads"/"feedback"/"review status", or as the lookup step before resolving/replying to PR feedback (pairs with git-code-review-resolve-feedbacks).'
---

Run the fetch script and return its output:

```bash
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"   # owner/name of this clone
node ~/.agents/skills/git-pr-fetch/fetch-pr.mjs "<input>"
```

- Default repo: `$REPO` (when only a number is given)
- Shows unresolved review comments only (resolved threads filtered out)
- Logic lives in `fetch-pr-lib.mjs` and `filter-unresolved-lib.mjs`; tests: `node --test ~/.agents/skills/git-pr-fetch/*.test.mjs`
- Context fetch: `git-fetch-context.mjs <PR URL | branch | commit>` returns the git and GitHub context a
  review needs without checking the branch out; its logic and tests live in `git-fetch-context-lib.mjs`.

Report the script output verbatim.
