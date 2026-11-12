---
name: output-html-review-generate
description: Generate professional HTML review reports from structured data (JSON). Use when - "create HTML report", "generate review report", "export findings to HTML".
---

# output-html-review-generate

Generate professional HTML report from JSON data.

**Usage:** `<input.json> <title>`

**JSON format:**
```json
{
  "title": "Report Title",
  "verdict": {
    "recommendation": "Approve | Approve after fixes | Request changes",
    "riskLevel": "low | medium | high",
    "summary": "One or two sentences - the TL;DR a reader needs before scrolling further."
  },
  "metadata": {"Key": "Value", ...},
  "sections": [
    {"title": "Section", "content": "...", "type": "text|code"},
    {"title": "Findings", "items": [{"text": "...", "type": "success|error|warning|info"}], "type": "list"},
    {"title": "Risks if merged without fixes", "items": [{"text": "..."}], "type": "risks"}
  ]
}
```

`verdict` renders as a colored badge banner at the top (the TL;DR). `type: "risks"` items render as highlighted warning rows for "what breaks if this ships as-is" - use it to state the concrete consequence, not just restate the finding. Item text may contain `<b>` or `<code>` tags (e.g. `` <code>file.cs:42</code> ``) for lightweight highlighting - all other content is escaped.

**Output:** `<WORK_DIR>/review.html`, where `WORK_DIR` is the unified work
folder from `~/.agents/scripts/work-folder-create.mjs` (see that script for the naming convention).
Callers that already computed a `WORK_DIR` (e.g. a ticket/PR/branch review) should pass
`"$WORK_DIR/review.html"` as the second argument directly; a caller with no ticket/work
folder context can instead pass a bare title, and the script falls back to
`<PROJECT_ROOT>/local_user_files/<yyyy-mm-dd>_<sanitized-title>/review.html`.

```bash
SKILL_DIR="$HOME/.agents/skills/output-html-review-generate"
node "$SKILL_DIR/generate-html.mjs" <input>
```
