---
name: engineering-concepts
description: The decision guide distilled from the engineering corpus and the platform documentation it does not cover - rules engines versus hard-coded rules, process engines, Z3 and SMT constraint solving, claims-based identity, transactional microservices with event sourcing and CQRS, evolutionary architecture and fitness functions, Scrum versus Kanban, MVVM and UI-pattern support across WPF, UWP, MAUI, Avalonia and Vue, and the Clean Code items the shared rules do not already cover. Use when choosing between an engine, a pattern and a hard-coded path; when a decision must be auditable, reused or changed without a redeploy; when asked "when should I use X", "why not X" or whether MVVM fits a framework; or before adding a layer, an event store, an identity model or a view-model base class.
---

# engineering-concepts

**Executive Summary** — A decision guide distilled from the engineering corpus. It routes a question to one reference and answers with a concept card: what the mechanism does, when to use it, when it is wrong, and the smallest proof that it works.

## When to Use

Use this skill when:

- Choosing between an engine, a pattern and a hard-coded path.
- A rule or policy must change without a redeploy, is shared by a second caller, or must be audited.
- Identity, data consistency or an event model is being designed across a boundary.
- An architectural property keeps drifting and a check is wanted.
- A team or solo maintainer is choosing a process model.
- A UI pattern is being chosen or questioned — MVVM in WPF, UWP, WinUI 3, MAUI, Avalonia, or Vue.
- The question is phrased "when should I use X", "why not X", or "is this over-engineering".

Do not use it for language syntax, a library API question, a bug fix, or a pattern that has already been chosen and only needs implementing. The repository's own `AGENTS.md` and skills win on every convention.

## The rule before the catalogue

- **The smallest thing that works stays.** A branch is cheap. An engine is a deployment, a schema and an owner. Adopt the heavier mechanism only when a named gate below is true.
- **A second consumer or a policy change is the trigger, not a hunch.** "It might grow" is not a gate.
- **Project rules win.** Read the checkout's `AGENTS.md` and its own skill first. This guide never overrides a repository convention, and a conflict is named, not silently resolved.
- **A recommendation without its counter-case is incomplete.** State when not to use it in the same answer.

## Route the question

| The question | Read | The short answer |
| :--- | :--- | :--- |
| Should this `if` become a rules engine? | [`references/decision_engines.md`](references/decision_engines.md) | Only when the decision is volatile, reused, owned or audited. Otherwise keep the branch. |
| Is this a workflow, a decision, or a constraint problem? | [`references/decision_engines.md`](references/decision_engines.md) | Process engine orchestrates, rules engine decides, Z3 proves. They are not interchangeable. |
| Who is allowed to do this, and who says so? | [`references/claims_based_identity.md`](references/claims_based_identity.md) | Claims when identity crosses a trust boundary; local accounts when it does not. |
| How do I keep two services consistent? | [`references/transactional_microservices.md`](references/transactional_microservices.md) | One aggregate per transaction, events between them, an outbox when you also publish. |
| How do I stop the architecture rotting? | [`references/evolutionary_architecture.md`](references/evolutionary_architecture.md) | A fitness function that fails the build, not a document that describes the intent. |
| Scrum or Kanban? | [`references/process_models.md`](references/process_models.md) | Scrum for a team committing to a sprint; Kanban for flow, interruption and a solo maintainer. |
| Does MVVM fit this UI, and does the framework have it? | [`references/ui_patterns.md`](references/ui_patterns.md) | WPF, UWP, WinUI 3, MAUI and Avalonia: yes, first-class. Vue: MVVM-influenced, not MVVM. |
| Is there Clean Code guidance we do not already enforce? | [`references/clean_code_delta.md`](references/clean_code_delta.md) | Only the delta: package principles, smells, boundaries, concurrency, the legacy path. The rest is in `engineering-patterns`. |

## The gates

Apply the gate for the family. For a decision, two or more yes answers justify the heavier mechanism, one justifies extracting the decision, and none means keep the simple path. The other families state their own combination below; a count is a starting point, not a rule.

**A decision (rules, policy, routing)**

1. Will it change without a code change, more than once per release?
2. Does a second caller need the same decision?
3. Must someone other than the developer author, approve or audit it?
4. Can you name the decision that was made and why, after the fact?

**A data model (history, events, projections)**

1. Is the history itself a requirement (audit, temporal query, replay)?
2. Do different consumers need different read shapes?
3. Does one transaction change exactly one aggregate's invariant?
4. Is eventual consistency acceptable to the consumer?

Event sourcing needs 1 and 3 and an accepted 4. CQRS needs 2. An outbox is mandatory when you write state and publish an event. Otherwise a state table plus an audit log is cheaper.

**Identity**

1. Does identity cross a trust boundary you do not control?
2. Do multiple applications accept the same identity?
3. Do you need single sign-on, federation or anonymity?
4. Can you avoid handling credentials at all?

Any yes points at an issuer and a signed token; claims are the standard form. All no points at OS or local accounts.

**A process model**

1. Can the work be forecast in fixed windows and committed to?
2. Is the work interrupt-driven, with unplanned items arriving daily?
3. Is there more than one person?

Scrum needs 1 and 3. Kanban fits 2 and a solo maintainer. Do not run Scrum ceremonies for an audience of one.

## Suggestions, not defaults

| Mechanism | Suggest it when | Keep the simple path when | Smallest proof |
| :--- | :--- | :--- | :--- |
| Rules engine | Rules change between releases, two or more callers share them, a non-developer owns them, or an audit of the fired rule is required | Fewer than about ten stable cases, one caller, or the decision must run in a tight loop | A rule change ships without rebuilding the caller; the trace names the fired rule |
| Decision table (DMN-style) | Dozens of overlapping conditions, or gaps and overlaps must be visible | A small exhaustive `switch` reads better | Every case and every gap is enumerated in one table |
| Process engine | Long-running work with human tasks, timers and compensation | One request and one response | A restart resumes at the same task |
| Z3 / SMT | Proving a rule set is consistent or complete, offline, or solving interdependent constraints | You only need to evaluate known facts | `unsat` for a contradictory rule set, a model for a feasible one |
| Claims | Cross-realm SSO, multiple apps, federation, anonymity, no password handling | A single local user on one machine | The token validates signature, issuer, audience and lifetime |
| Event sourcing | Audit and history are requirements, or projections need replay | CRUD with an occasional audit row | Replaying the stream rebuilds the same state |
| CQRS | Read and write shapes diverge, or search/reporting needs another store | One read model serves every query | A projection lags but converges |
| Outbox | You write to a database and publish an event in the same operation | There is no broker and no second consumer | No committed state without a published event |
| Fitness function | A property has regressed before, or must never regress | Nobody would act on the number | The build fails when the property breaks |
| MVVM | The framework has binding and commands, two or more views share state, or presentation logic must be tested without the UI | One window with no testable presentation logic, or Vue, where components and composables are the idiom | A view-model test runs without the view |
| Kanban | Work is interrupt-driven or the maintainer is one person | A team is committing to a demo cadence | WIP limit is visible and respected |
| Scrum | A team needs forecast, commitment and a review cadence | The "team" is one person | The sprint backlog fits one sprint |

## Applying it to these repositories

- **snaerf is the largest checkout — several projects and one packable NuGet.** Its package graph is where the package principles bite. It now carries both fitness functions: `tests/snaerf.Architecture.Tests/` fails on a reference cycle or a reference outside the layer map, and `tests/snaerf.Retrieval.Tests/PublicApiTests.cs` fails on a removed, renamed or unrecorded public member. Keep them green; the public-API baseline is regenerated deliberately with `SNAERF_UPDATE_PUBLIC_API=1`.
- **Keep snaerf's rules hard-coded today.** There is no rules engine and no second consumer of the same decision. The trigger to revisit is concrete: the same policy is needed by the terminal host, the MCP server and the satellite bridge, or the owner starts editing conditions in the settings file. Then read `references/decision_engines.md` and start with a table, not an engine.
- **Do not event-source the assistant.** Its event bus and latency journal are notifications, not the source of truth. A state table plus the existing journal is the cheaper correct answer.
- **Do not add a claims layer to snaerf.** It is single-user and local, and the identity boundary is the operating system. Claims become relevant only if the MCP server or the phone bridge is exposed to another principal.
- **Use Kanban for the solo work.** A WIP limit and a visible board match phased, interrupt-driven maintenance; Scrum only when a phase has a fixed deadline and a second person.
- **The Clean Code delta that matters here is package cohesion and coupling**, because the repositories now have assemblies and a NuGet. Naming, functions, SOLID and test shape are already binding in `engineering-patterns`.
- **The WPF/UWP MVVM habit transfers to MAUI and Avalonia.** The binding, change notification and command model is the same; `CommunityToolkit.Mvvm` is the low-risk base on all four. Caliburn.Micro's conventions remain a good fit for existing WPF/UWP work, but its MAUI and Avalonia adapters are beta.
- **Vue is not MVVM.** Keep the separation — state and logic outside the template — but use components, composables and Pinia; a ViewModel base class and an `ICommand` object are foreign to the framework.

## Provenance

| Source | Reference | What it contributed |
| :--- | :--- | :--- |
| Rules-engine notes: process engine versus rules engine, Z3 versus rule engine, CAD-to-JSON extraction | `decision_engines.md` | The decision/orchestration/constraint split, the integration trade-offs, the fact-extraction boundary |
| *A Guide to Claims-Based Identity and Access Control* (Microsoft patterns & practices, 2010) | `claims_based_identity.md` | Claims, issuers, tokens, federation, claims transformation, good-claim criteria |
| *Developing Transactional Microservices Using Aggregates, Event Sourcing and CQRS, Part 2* (InfoQ, 2017) | `transactional_microservices.md` | Aggregates, the dual-write problem, event sourcing, snapshots, CQRS, view stores |
| *Evolutionary Architecture in Practice* (InfoQ eMag) | `evolutionary_architecture.md` | Fitness functions, comprehension, boundaries, guardrails, Conway |
| *Scrum vs Kanban* cheat sheet (Development That Pays, 2017) | `process_models.md` | Cadence versus flow, WIP limits, roles, ceremonies |
| Platform documentation, outside the corpus: the MVVM Toolkit, MAUI, Avalonia, Caliburn.Micro and Vue docs | `ui_patterns.md` | MVVM availability per framework, the Vue distinction, toolkit selection |
| *Clean Code* (Martin, 2008), Prechelt's summary, the cheat sheet and the 2020 Helsinki thesis | `clean_code_delta.md` | The smell list, package principles, boundaries, concurrency, the legacy path, survey evidence |

The corpus is private working material in the snaerf checkout. This skill is the durable digest; it does not copy the sources.

The corpus has no MVVM, WPF, UWP, MAUI, Avalonia or Vue content. `ui_patterns.md` is written from the vendors' documentation, checked 2026-11-21, and is marked as outside the corpus.

## Prerequisites & Setup

Nothing to install: plain Markdown, read on demand, no runtime, network or credentials. The two checks below run from the umbrella checkout.

| Need | Check | If missing |
| :--- | :--- | :--- |
| The skill tree is valid | `node scripts/check-skills.mjs .agents/skills/engineering-concepts` | Fix the reported frontmatter or reference path; hard findings block |
| The skill is linked machine-wide | `node scripts/install-global.mjs` | Run `node scripts/install-global.mjs --write` from the prototype-k checkout |

## Functional Requirements

| Requirement | Check | Failure |
| :--- | :--- | :--- |
| Every reference opens with a concept card: what it does, use when, do not use when, smallest proof | Read the reference; the table is present | A summary without a counter-case |
| Every recommendation names the condition that makes it wrong | Search the answer for "do not" or "keep" beside the recommendation | Advice that only says "use X" |
| Every non-obvious claim names its source | The provenance table, or a source note in the reference | An assertion with no attribution |
| A project rule that conflicts is named, and the project wins | The answer states the conflict | A global rule silently overriding the checkout |
| The answer is actionable without opening the reference | The answer carries the concept, the condition and the proof | "Read the reference" as the whole answer |
| No long excerpts | Short quotes only, attributed | Copied pages |

**Escape hatch:** when the corpus is silent, say so, use the repository's own evidence, and propose a spike. Never invent a source or a measurement.

**Tolerated losses:** the digest drops page-level detail, the authors' full arguments and the original examples. A reader who needs them goes to the source named in the provenance table. A concept whose source is only page images is marked as not digested.

## Execution Workflow

1. Classify the question with the route table. If it spans two families, split it.
2. Read the one reference. Do not read them all.
3. Read the target repository's `AGENTS.md`; note any convention that changes the answer.
4. Answer with the concept card: what it does, use when, do not use when, smallest proof, source.
5. If the answer is "build it", name the failing check that proves the need and the check that proves it works.
6. Record the decision where that repository records decisions: an ADR, a plan section, or the commit body.
7. If the corpus does not settle it, say what is unknown and propose the measurement.

## Error-Handling Playbook

| Situation | Correction |
| :--- | :--- |
| The question spans two families | Split it: one card per family, then say which gate each answer depends on |
| The corpus is silent | Say so plainly; use repository evidence; propose a `spike` |
| A project rule contradicts the guide | The project wins; name the rule and the cost of following it here |
| Tempted to add an engine for one caller | Stop; keep the branch; revisit at the second caller or the first policy change |
| Claims proposed without a trust boundary | Stop; use OS or local accounts |
| Event sourcing proposed for simple CRUD | Stop; a state table plus an audit row is cheaper |
| A fitness function nobody would act on | It is not a requirement; delete it or give it an owner and a threshold |
| A Scrum process proposed for one person | Use Kanban; keep the ceremony only if a second person joins |

## Verification & Outputs

- `node scripts/check-skills.mjs .agents/skills/engineering-concepts` prints `hard findings: 0`.
- A good answer contains the concept, the use condition, the counter-condition, the smallest proof, and the source.
- Expected files: the reference set plus `README.md`; `SKILL.md` stays under 500 lines.
