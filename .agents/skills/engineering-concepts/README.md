# engineering-concepts

## Executive Summary

A decision guide distilled from the private engineering corpus and the platform documentation the corpus does not cover: rules engines and hard-coded rules, claims-based identity, transactional microservices, evolutionary architecture, process models, MVVM across WPF, UWP, MAUI, Avalonia and Vue, and the Clean Code items the shared rules miss. It answers *should this mechanism exist here* before *how do I build it*, and every recommendation carries the condition that makes it wrong.

## Problem / Why / What / Verification

| | |
| :--- | :--- |
| **Problem** | The source material is private, book-length or scattered across vendor docs, and never in context. A session either re-derives a decision from memory or copies a pattern that was right somewhere else. |
| **Why** | One durable, machine-wide guide makes the decision reviewable: the gate that justifies an engine, the counter-case that keeps it out, and the smallest proof that it works. |
| **What** | A router (`SKILL.md`) and a reference set. Deliberately not here: the full books, product code, a vector index, or a second copy of the Clean Code rules already in `engineering-patterns`. |
| **Verification** | `node scripts/check-skills.mjs .agents/skills/engineering-concepts` reports `hard findings: 0`; the skill is linked at `~/.agents/skills/engineering-concepts`; a sample answer carries the concept, the use condition, the counter-condition and the proof. |

## Import for AI

If you import it by hand, copy the whole skill folder, not only `SKILL.md`; the references are the substance. On a machine that sees the umbrella checkout, install it as a link, never a copy. From the umbrella checkout:

```bash
cd "$DYNAMIC_DISORDER_ROOT/prototype-k"
node scripts/install-global.mjs --write
node global/install.mjs
```

`install-global.mjs` links every skill folder into the machine-wide agents root, so this one reaches every repository on the machine without a per-project copy. The shared block installed by `global/install.mjs` carries the one-line pointer that makes sessions look here.

## Agent execution rules

- **Read `SKILL.md` first, then one reference.** Do not load them all for one question.
- **The project wins.** Read the target checkout's `AGENTS.md`; a conflict is named, not silently resolved.
- **Every answer carries the counter-case.** "Use X" without "do not use X when" is incomplete.
- **No long excerpts.** Short quotes only, attributed; the sources are named in each reference.
- **The corpus is not edited.** This skill is the durable digest; corrections go here, not into the private books.
- **A source that was only page images is marked as not digested.** Do not reconstruct it from memory and present it as the source.

## Tests

```bash
node scripts/check-skills.mjs .agents/skills/engineering-concepts
node scripts/check-skills.mjs
node scripts/export-agents.mjs --check
```

The first exits 0 with `hard findings: 0`. The second checks the whole skill tree for broken references and naming. The third compares the portable bundle with the checkout; run `node scripts/export-agents.mjs` first after adding a skill.

## Files index

| Path | Holds |
| :--- | :--- |
| `SKILL.md` | The router: route table, decision gates, suggestions, provenance, requirements, workflow, error handling |
| `references/decision_engines.md` | Hard-coded rules, rules engines, decision tables, process engines, Z3/SMT, the C# shape, fact extraction |
| `references/claims_based_identity.md` | Claims, issuers, tokens, federation, claims transformation, validation, .NET mapping |
| `references/transactional_microservices.md` | Aggregates, reliable publishing, event sourcing, snapshots, CQRS, view stores |
| `references/evolutionary_architecture.md` | Fitness functions, comprehension, boundaries, guardrails, Conway, applying it to a .NET repo |
| `references/process_models.md` | Scrum and Kanban, the differences, which fits which work |
| `references/ui_patterns.md` | MVVM across WPF, UWP, WinUI 3, MAUI and Avalonia; the Vue distinction; toolkit selection |
| `references/clean_code_delta.md` | Smells, package principles, legacy path, concurrency, emergence, refactoring patterns, survey evidence |
| `README.md` | This page: the human-facing map and the install/verify commands |
