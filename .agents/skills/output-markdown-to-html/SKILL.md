---
name: output-markdown-to-html
description: Convert markdown documentation to professional standalone HTML files. Use when "convert md to html", "export markdown as html", "generate html from markdown".
---

# output-markdown-to-html

Convert markdown files to standalone HTML with professional styling, GitHub-style alerts, syntax highlighting, responsive layout, and dark mode support.

```bash
SCRIPT_PATH=$(cygpath -m "$HOME/.agents/skills/output-markdown-to-html/convert-markdown.mjs" 2>/dev/null || echo "$HOME/.agents/skills/output-markdown-to-html/convert-markdown.mjs")
node "$SCRIPT_PATH" <input>
```

**Arguments**: `<input.md or directory> [output.html or directory]`

- Single file: converts to HTML (e.g., `guide.md` → `guide.html`)
- Directory: converts all `*.md` files
- Output path optional (defaults to same name with `.html` extension)

Features: headers with anchor links, code blocks, tables, lists, blockquotes, GitHub-style alerts (NOTE, WARNING, IMPORTANT, TIP, DANGER) with $OWNER brand colors, task lists, responsive layout, print styles. Always light theme (black/dark-gray text on white) - dark mode was removed after it caused invisible text when rendered through xhtml2pdf. No external dependencies.
