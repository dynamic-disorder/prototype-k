---
name: output-html-brief-generate
description: Turn a long/detailed document into a short, plain-language HTML brief - short paragraphs, bullets, sparing icons. Use when a document is "too long", "too detailed", "hard to read", or the user asks for a "simple version", "TL;DR", "reader-friendly", or "brief" as HTML.
---

# output-html-brief-generate

Turn a detailed document (plan, report, analysis) into a short, plain-language brief. This is a **rewrite** step you do with judgment about what to cut vs keep - not a mechanical script.

## Input

`<input>` = path to the source document (markdown or any text). If no path given, use the content already in the conversation.

## Rewrite rules

- Plain language: short sentences, no jargon unless it's the only correct term (then define it inline once).
- Concise paragraphs: 1-3 sentences max.
- Bullets over prose for any list of 2+ items; nest sub-bullets only one level deep.
- Emphasis (bold) on the single most important word/phrase per bullet - not whole sentences.
- Icons only when they genuinely help scanning (e.g. done / blocked / open question). Never decorative. One consistent icon per meaning, used the same way throughout.
- Keep every fact that changes a decision: owners, blockers, file paths, ticket/PR numbers, dates. Cut background, repeated caveats, and exhaustive detail (e.g. collapse a 5-item evidence list into "3 failed runs, same symptom" + one example).
- Target: readable in under 2 minutes. Merge sections that overlap rather than mirroring the source's structure 1:1.

## Structure template (adapt, don't force)

```
# <Title>

**TL;DR:** <1-2 sentences: what's happening and the fix>

## What's happening
- <bullet per root cause / symptom, plain language>

## Fix
- <bullet per fix, marked done / blocked / needs decision>

## Open questions
- <bullet>
```

## Output

1. Write the simplified markdown next to the source, suffixed `_brief.md` (or `<slug>_brief.md` if no source file path exists).
2. Convert to HTML by delegating to the existing converter - do not reimplement HTML/CSS:
   ```bash
   SCRIPT_PATH=$(cygpath -m "$HOME/.agents/skills/output-markdown-to-html/convert-markdown.mjs" 2>/dev/null || echo "$HOME/.agents/skills/output-markdown-to-html/convert-markdown.mjs")
   node "$SCRIPT_PATH" <brief.md>
   ```
3. Report only the output path and a 2-line recap - don't paste the full brief back into chat; the point is a shorter artifact.
