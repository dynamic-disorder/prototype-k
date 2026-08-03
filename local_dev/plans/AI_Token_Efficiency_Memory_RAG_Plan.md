# AI Token Efficiency — Memory / Lightweight RAG / README Strategy

Created: 2026-04-08
Scope: Repo-wide AI agent configuration (Cline + Claude Code + Copilot)
Status: **EXECUTED 2026-04-08** — see `AI_Context_Optimization_History.md`

---

## 1. Executive Summary

**Recommendation: Do NOT introduce RAG. You are ~80% of the way there already.**

Your repo is small (~5 hobby projects, single context window fits the entire
knowledge corpus) and your committed AI-context surface is already tiny:

| Context source | Approx. tokens |
| :------------- | :------------- |
| Root `CLAUDE.md` (~50 lines incl. AI Context Map) | ~130 |
| Per-project `CLAUDE.md` (6 files, incl. ollama_with_open_webui) | ~2,100 |
| `.claude/rules/*` (root 5 + per-project 2) | ~2,700 |
| Root `.github/copilot-instructions.md` + `clean_code` | ~2,400 |
| Per-project Copilot instructions (2 files) | ~520 |
| `.clinerules` (Cline) | ~790 |
| `session-start.sh` hook output (~15 lines) | ~40 |
| **Total committed AI context (19 files, measured)** | **~9.8K tokens** |
| **Boot context only (root CLAUDE.md + .clinerules + hook)** | **~650 tokens** |

Measured 2026-04-08 via `local_dev/scripts/ai_context_token_estimate.ps1`
(~4 chars/token heuristic). Important: per-project CLAUDE.md and per-project
rules are **path-scoped and load on demand** — the ~9.8K total is the ceiling,
not what every session pays.

For comparison, one `read_file` of a single source file often costs more than
all of the above combined. **A vector-embedding RAG, graph RAG, or MCP memory
server solves a problem this repository does not meaningfully have.**

The problems you *do* have are:

1. **Inconsistent coverage** — `MediaRenamer/` and `CliUtils/` have no
   `CLAUDE.md`; only 3 of 5 projects have one.
2. **Duplicated instructions** — C# conventions exist in BOTH
   `.claude/rules/csharp-conventions.md` AND `.github/copilot-instructions.md`
   (and the Copilot `clean_code` file). Both agents load both layers;
   divergence will silently drift privileges/behavior.
3. **Unclear role for `memory/`** — it is committed to git, but its content is
   personal tooling notes. It overlaps with Claude Code's user-level auto-memory
   (`~/.claude/projects/*/memory/MEMORY.md`) and with Cline's `.clinerules`.

**Direct answer to your question:** yes, per-project `README.md`/`README.AI.md`
is enough — in fact your per-project `CLAUDE.md` files *are* that mechanism.
Treat them as the canonical "AI context" file per project, fill the gaps,
de-duplicate the convention rules, and let the root `CLAUDE.md` be the index
(the "retrieval layer"). No embeddings, no vector store, no RAG server.

---

## 2. Current State Inventory

### 2.1 Claude Code / Cline committed config (already good)

- Root `CLAUDE.md` — concise project table + env/style. **Keep.**
- `CsvTranslations/CLAUDE.md` — 65 lines, rich (build/run/distribution). **Good.**
- `FileNameTools/CLAUDE.md` — 39 lines, focused. **Good.**
- `ai_offline/CLAUDE.md` — 28 lines, points to sub-guides. **Good.**
- `.claude/rules/` — repo-structure, C# conventions, test conventions,
  build verification, naming. Path-scoped rules = Claude Code's native
  "lightweight RAG". **Keep as single source for conventions.**
- `.claude/hooks/session-start.sh` + `session-compact.sh` — elegant boot/recovery
  context. **Keep; trim duplication (see §4.5).**
- Root `.clinerules` — Cline-specific rules. **Keep.**

### 2.2 Copilot config (overlapping with Claude)

- `.github/copilot-instructions.md` — root Copilot instructions.
- `.github/clean_code_general_instructions.md` — style guide.
- `CsvTranslations/.github/copilot-instructions.md`,
  `FileNameTools/.github/copilot-instructions.md` — per-project.

**Overlap note:** C# convention details (underscore fields, braces, using-group
ordering, Moq ban) are stated in both `.github/copilot-instructions.md` AND
`.claude/rules/csharp-conventions.md`. Copilot cannot read `.claude/rules/`, so
some duplication is unavoidable — but the Copilot copies should be *summaries
pointing to the authoritative `.claude/rules/csharp-conventions.md`*, not full
parallel copies.

### 2.3 Gaps & inconsistencies

| Area | Issue |
| :--- | :---- |
| `MediaRenamer/` | No `CLAUDE.md`; README only describes structure, no build/test commands |
| `CliUtils/` | No `CLAUDE.md` (minor — small library, but should have one for consistency) |
| `translations_csv/` | No `CLAUDE.md` (data-only folder; low priority) |
| `memory/` | Purpose under-used; only stub metadata files; `MEMORY.md` is a bare link list |
| Copilot vs Claude rules | Duplicated convention content (drift risk) |
| `session-start.sh` | Re-prints static project list that duplicates root `CLAUDE.md` table |
| `MediaRenamer/README.md` | Accurate (MediaRenamer targets `net8.0-windows`, unlike the rest of the repo) — now cross-referenced from its new CLAUDE.md |

---

## 3. Why RAG Is the Wrong Tool Here (and what "lightweight RAG" really means for you)

### 3.1 The RAG trigger conditions

RAG (embeddings + vector store + retrieval) pays off when ALL of these hold:

1. Knowledge corpus too large for one context window (thousands of pages).
2. Documents change independently; answers must cite the right chunk.
3. You need semantic search over information you can't predict upfront.

This repo fails #1 decisively. The entire repo — sources, docs, histories —
fits in a fraction of a single 200K–1M token context.

### 3.2 The cheapest "RAG" that actually works: indexed markdown + grep

For a repo this size, the retrieval layer is already built into both agents:

- Claude Code: `read_file`, `search_files`(regex grep), path-scoped `.claude/rules/`, `# memory`.
- Cline: `read_file`, `search_files`, `.clinerules`, and (recent versions) `CLAUDE.md` reading.

What's missing is **an index that tells the agent WHERE the relevant doc lives**,
so it doesn't burn tokens re-discovering structure. That index is the root
`CLAUDE.md` project table + a short "AI context map" section (§4.6).

### 3.3 When to revisit RAG (future triggers)

Introduce a real lightweight RAG only if one of these happens:

- `local_dev/analyses/` + `local_dev/plans/` + `memory/` grow past ~50 files.
- A new project accumulates >100 pages of design docs.
- You start cross-referencing notes from several projects in one prompt
  ("what did I decide about X?").

At that point the *lightest* options are, in order:
1. A single `local_dev/INDEX.md` (keywordable, zero infra).
2. Claude Code `# memory` / auto-memory for ephemeral cross-session facts.
3. An MCP memory server (e.g., `@modelcontextprotocol/server-memory`) wired into
   both Cline and Claude Code — not embeddings, just a key-value memory store.
4. Only if #1–3 fail: embeddings-based RAG (local, e.g., Ollama embeddings).

---

## 4. Actionable Plan

### 4.1 T1 — Define the canonical per-project "AI context" template

File name: `CLAUDE.md` (already Claude-Code native; point Cline at it in
root `.clinerules` if your Cline version doesn't auto-read it).

Template (≤ ~60 lines per project):

```markdown
# <Project> — AI Context

## What this project is        (2–4 lines; humans: see README.md)
## Commands                    (build, test, run — exact, copyable)
## Conventions                 (only what DIFFERS from root conventions; point to .claude/rules/)
## Gotchas                     (Windows-specific, NETSDK1127, Ollama dependency, ...)
## Related docs                (links into local_dev/analyses, plans, ai_offline guides)
```

Status: `CsvTranslations/` and `FileNameTools/` already conform closely.
`ai_offline/` mostly conforms.

### 4.2 T2 — Fill coverage gaps

- Create `MediaRenamer/CLAUDE.md` using the template. Extract build/test/run
  from the solution (`dotnet build MediaRenamer.sln`, `dotnet test`, WPF run).
- Create `CliUtils/CLAUDE.md` (short — it's a library: build command, usage note,
  relation to `CsvTranslations`/`FileNameTools` consumers).
- Add to `translations_csv/` (optional, single line: "data only — see
  `CsvTranslations/CLAUDE.md` for tooling").

Effort: ~30–45 min. This is the single highest-value task.

### 4.3 T3 — De-duplicate conventions (single source of truth)

- Keep `.claude/rules/csharp-conventions.md` as the AUTHORITATIVE C#/test reference.
- Trim `.github/copilot-instructions.md` C#/test sections down to a summary:
  "C# conventions are canonical in `../.claude/rules/csharp-conventions.md` —
  apply them." Clarify that Copilot applies repo-local rule conventions.
  - Note: Copilot cannot read `.claude/` paths directly; keep the *critical*
    one-liners (underscore fields, no Moq, expression-bodied disabled, Given-When-Then)
    in Copilot files and remove the rest.
- Remove duplicated gotchas (e.g., NETSDK1127 appears in both the root Copilot
  file and `CsvTranslations/CLAUDE.md`) — keep in exactly one place per layer.

Effort: ~45–60 min. Prevents silent drift between agent behaviors.

### 4.4 T4 — Give `memory/` an explicit role

Decide and document in `memory/README.md`:

- **Keep committed `memory/`** for *stable personal reference* (tooling notes,
  environment setup, fallback instructions) — that's its stated purpose.
- **Migrate to Claude Code auto-memory** (`~/.claude/projects/<hash>/memory/`)
  for *ephemeral, session-to-session facts* ("today I decided X", "Cline ticket
  open"). That folder is git-ignored by nature; use it, don't fight it.
- **Same-session purpose for Cline**: `.clinerules` + CLAUDE.md is the committed
  memory; there is no per-repo auto-memory equivalent — so keep ephemeral notes
  in Claude Code auto-memory and cross-reference from `memory/README.md`.
- Expand `MEMORY.md` from a bare link list into a short index with 1-line
  summaries so agents know what's in it without opening every file.

Effort: ~20–30 min.

### 4.5 T5 — Trim `session-start.sh` duplication

Current hook re-lists the project table that already lives in root `CLAUDE.md`
(lines 37–45). Both get loaded at session start → double cost and drift risk.

Change to: print only changing state (git status, last commits) + a single line:

```text
AI context: read <root>/CLAUDE.md; per-project CLAUDE.md files are the
authoritative context for each project.
```

Keep `session-compact.sh` as-is (already minimal). Effort: ~10 min.

### 4.6 T6 — Add an "AI Context Map" to root CLAUDE.md

Extend the root `CLAUDE.md` so both agents can find everything in one read
(~10–15 extra lines, +~30 tokens — negligible):

```markdown
## AI Context Map
- Per-project context: <Project>/CLAUDE.md (authoritative commands/conventions)
- Conventions: .claude/rules/ (csharp-conventions.md, test-conventions.md, ...)
- Copilot instructions: .github/copilot-instructions.md (+ subfolder files)
- Personal memory/reference: memory/ (committed) ; Claude Code auto-memory (git-ignored)
- Analyses & plans: local_dev/analyses/, local_dev/plans/
```

This is the "retrieval index" — the agent greps this, then reads only the file
it needs. That is the entire RAG you need.

### 4.7 T7 — Token budget & measurement (optional but cheap)

Adopt a simple budget so the doc layer stays lean:

- Boot context (root CLAUDE.md + hook output + rules loaded at start) ≤ ~4K tokens.
- Per-project CLAUDE.md ≤ ~100 lines each.
- Measurement: quick PowerShell one-liner to sum token estimate across AI files:

```powershell
Get-ChildItem -Recurse -Include CLAUDE.md,.clinerules,.claude/rules/*.md,.github/copilot-instructions.md |
  Get-Content -Raw | Measure-Object -Character -Word
```

Use ~4 chars/token as a rough estimate; keep the total committed AI-context
under ~2.5K words (~2K tokens).

### 4.8 T8 — Future upgrade path (document this in the plan for later)

If the triggers in §3.3 fire:

1. Create `local_dev/INDEX.md` with keyword entries for every doc/analysis/plan.
2. Enable Claude Code `# memory` usage discipline for cross-session facts.
3. Add `@modelcontextprotocol/server-memory` to `.mcp.json` (shared config →
   both Cline and Claude Code can use it); store only *facts*, not code.
4. Only if still insufficient: embeddings RAG with local Ollama embeddings.

---

## 5. Decision Matrix

| Scenario | Use |
| :------- | :-- |
| "What does project X do / how do I build it?" | `<Project>/CLAUDE.md` |
| "What are the C#/test conventions?" | `.claude/rules/*` (single source) |
| "Where is the analysis of TTS?" | `local_dev/analyses/` via root map |
| "What did I decide last week across sessions?" | Claude Code auto-memory + `memory/` |
| "Summarize ALL my design docs semantically" | Only after §3.3 triggers → RAG |

---

## 6. Effort Summary

| Task | Effort | Priority |
| :--- | :----- | :------- |
| T1 Template (agree) | 15 min | High |
| T2 Fill gaps (MediaRenamer, CliUtils) | 30–45 min | High |
| T3 De-duplicate Copilot vs Claude rules | 45–60 min | Medium |
| T4 Re-role `memory/` | 20–30 min | Medium |
| T5 Trim session-start hook | 10 min | Low |
| T6 Root AI Context Map | 10 min | High |
| T7 Token budget + measurer | 15 min | Low |
| T8 Future path notes | 10 min (this doc) | Low |

**Total: ~2.5–3.5 hours of low-risk, high-clarity improvements — no new
infrastructure, no new dependencies, token-optimal.**