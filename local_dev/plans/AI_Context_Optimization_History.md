# AI Context Optimization History

Chronological log of token-efficiency improvements to the repository's AI
context layer (Cline, Claude Code, Copilot). Read this when resuming future
optimization work — it explains why things are structured the way they are.

---

## 2026-04-08 — Initial AI Token-Efficiency Pass

### Problem

Repo used three AI tools (Cline, Claude Code, Copilot) with overlapping,
incompletely-covered configuration. Question: do we need RAG / memory server?

### Analysis outcome

- Repo is small (~5 hobby projects); full AI knowledge corpus fits in a single
  context window. **RAG not warranted.**
- Per-project `CLAUDE.md` files are the canonical "AI context" per project
  (equivalent to a README.AI.md).
- Real gaps: no CLAUDE.md for `MediaRenamer/` and `CliUtils/`; duplicated C#
  conventions between Copilot and Claude rules; `memory/` role unclear;

### Actions taken

1. **Created** `MediaRenamer/CLAUDE.md` — projects table, build/run commands,
   `.NET 8` note (this project is NOT .NET 9), WPF gotchas, related docs.
2. **Created** `CliUtils/CLAUDE.md` — library purposes, build command, no
   entry-point gotcha, DRY guidance for loggers.
3. **De-duplicated** Copilot instructions (`.github/copilot-instructions.md`):
   verbose C#/testing convention blocks replaced with a summary pointing to the
   authoritative `.claude/rules/*.md`; kept only critical one-liners Copilot
   cannot read from `.claude/`.
4. **Re-roled** `memory/`:
   - `memory/README.md` — deliberate distinction: committed `memory/` = stable
     reference; Claude Code auto-memory = ephemeral cross-session facts.
   - `memory/MEMORY.md` — expanded from a bare link list to an index with
     1-line summaries.
5. **Trimmed** `.claude/hooks/session-start.sh` — removed the static project
   list (duplicated root `CLAUDE.md`); now points to root CLAUDE.md as the
   index. Saves ~15 lines of injected boot context.
6. **Added** "AI Context Map" section to root `CLAUDE.md` — the retrieval
   index telling agents where authoritative context lives.
7. **Created** `local_dev/scripts/ai_context_token_estimate.ps1` — measures
   committed AI-context token estimate (initially ran at ~39,172 chars /
   ~9,794 tokens in ~19 files; per-project rules/CLAUDE.md only load on demand,
   so boot context is far smaller).
8. **Linked** CliUtils/MediaRenamer CLAUDE.md from the root project table and
   corrected MediaRenamer row to note `.NET 8`.

### Bumps found during execution

- MediaRenamer targets `net8.0-windows` — the plan's "stale .NET 8 doc" claim
  was wrong; README was accurate. Corrected in plan and root CLAUDE.md.
- Actual committed AI-context surface (~9.8K estimated tokens / 19 files) is
  ~6x the initial ~1.6K estimate — the inventory missed 6 files
  (`ai_offline/ollama_with_open_webui/CLAUDE.md`,
  `CsvTranslations/.claude/rules/windows-development.md`,
  `FileNameTools/.claude/rules/filename-sanitization.md`, etc.).
  Boot context (root CLAUDE.md + .clinerules + hook output) remains ~650 tokens.

### Decisions recorded

- **No RAG.** Revisit only if triggers in
  `AI_Token_Efficiency_Memory_RAG_Plan.md` §3.3 fire (>50 doc files,
  >100 pages of design docs, cross-project note queries).
- **Single source of truth** for conventions: `.claude/rules/*.md`.
- **Per-project CLAUDE.md** template: What/Commands/Conventions/Gotchas/Related
  docs, ≤ ~60 lines.
- **memory/ vs auto-memory**: stable (3+ months) → `memory/`; ephemeral →
  Claude Code auto-memory.
- **Token budget**: boot context ≤ ~4K tokens; per-project CLAUDE.md ≤ ~100 lines.

---

## Future entries

Append to this file whenever AI-context files change meaningfully:

```markdown
## YYYY-MM-DD — <short title>

### What changed
### Why
### Measured impact (optional — run local_dev/scripts/ai_context_token_estimate.ps1)