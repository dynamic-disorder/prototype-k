# output-html-review-generate

Generates professional HTML review reports from structured JSON data.

## Files

- `SKILL.md` - Thin delegator skill (30 lines, ~250 tokens)
- `generate-html.mjs` - Node.js script implementing HTML generation logic (executed out-of-context)

## Extraction Benefits

**Before:** 57 lines of inline instructions loaded every session where skill is referenced  
**After:** 30 lines of delegator + script executes out-of-context  
**Savings:** ~350 tokens per session (~45% reduction)

## Usage

Called by other skills (for example git-code-review):

```bash
Skill(output-html-review-generate, "<input.json> <title>")
```

Direct invocation:
```bash
node ~/.agents/skills/output-html-review-generate/generate-html.mjs input.json "report_title"
```

## JSON Format

```json
{
  "title": "Report Title",
  "metadata": {
    "Key": "Value",
    "Another Key": "Another Value"
  },
  "sections": [
    {
      "title": "Section Title",
      "content": "Text content...",
      "type": "text"
    },
    {
      "title": "Code Example",
      "content": "function() { ... }",
      "type": "code"
    },
    {
      "title": "Findings",
      "type": "list",
      "items": [
        {"text": "Success message", "type": "success"},
        {"text": "Error message", "type": "error"},
        {"text": "Warning message", "type": "warning"},
        {"text": "Info message", "type": "info"}
      ]
    }
  ]
}
```

## Output

HTML file at: `$WORK_DIR/review.html` (or, with no work-folder context, `<PROJECT_ROOT>/local_user_files/YYYY-MM-DD_<sanitized-title>/review.html`) - see `~/.agents/scripts/work-folder-create.mjs` for the shared naming convention.

Features:
- Professional styling (responsive, color-coded, print-friendly)
- Metadata table
- Text sections with pre-wrap
- Code blocks with syntax highlighting
- Color-coded findings (success/error/warning/info)
- Standalone file (embedded CSS)
