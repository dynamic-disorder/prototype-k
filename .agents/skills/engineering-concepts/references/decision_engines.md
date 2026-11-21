# Decision engines: hard-coded, rules, process, tables, solvers

**TL;DR** — A process engine coordinates work, a rules engine decides, a decision table makes a decision readable, and Z3 proves a rule set. Most systems need none of them; the ones that do can name the gate that justified the cost.

## The concept card

| Mechanism | What it does | Use when | Do not use when | Smallest proof |
| :--- | :--- | :--- | :--- | :--- |
| Hard-coded rule | An `if`, a `switch` or a strategy list in code | The rule is small, stable, single-caller, and changes with the code | The rule changes between releases, or a second caller needs it | A unit test per case |
| Rules engine | Matches `IF condition THEN action` rules against facts, fires actions, keeps a trace | Rules are volatile, reused, business-owned or audited | One caller, few stable cases, or a hard latency budget | A rule edit ships without rebuilding the caller; the trace names the fired rule |
| Decision table (DMN-style) | Rows of conditions and outcomes, one match chosen, gaps and overlaps visible | Many overlapping conditions, or non-developers must read the policy | A small exhaustive `switch` is clearer | Every case and gap is enumerated in one table |
| Process engine (BPMN) | Coordinates tasks, human approvals, timers, service calls and state | Long-running work with waits, compensation or hand-offs | A single request/response with no wait | A restart resumes at the same task |
| Z3 / SMT solver | Finds values that satisfy constraints, or proves none exist | Consistency, completeness, scheduling, verification | You only evaluate known facts | `unsat` for a contradictory rule set; a model for a feasible one |

## The distinction in one line

- **Process engine** — *what happens, in what order, with whom, and how long it waits.*
- **Rules engine** — *given these facts, which rules fire and what do they conclude.*
- **Decision table** — *the same decision as a readable matrix, with conflict visibility.*
- **Z3** — *is there any assignment that satisfies all constraints, and if not, why not.*

The process engine does not decide; it delegates at a business-rule task and maps the answer back. The rules engine does not orchestrate; it answers the question it is given. Confusing the two is the most common design error in this family.

## Hard-coded rules

**What it is.** A branch, a `switch`, or a list of small strategy objects evaluated in order.

**Why it is usually right.** It is visible at the call site, tested with the code, reviewed with the code, and costs nothing to deploy. A branch that fits on one screen is not technical debt.

**When it stops being right.**

- The rule changes more often than the code around it.
- A second caller copies the same branch.
- Someone other than the developer must change it.
- An auditor asks which rule fired and the answer is a stack trace.
- More than roughly ten overlapping cases make the branch unreadable.

**When it must stay hard-coded.** Safety and physical invariants. A robot's maximum velocity, a torque limit or a stop distance is not a business rule. It must be deterministic, tested, reviewed and incapable of being edited into an unsafe state at runtime. Configuration may tune a safe range; it must not replace the check.

## Rules engine

**How it works.** Facts go in. The engine matches rule conditions, resolves conflicts by priority or ordering, fires the actions, and can add facts that trigger more rules (forward chaining) or work back from a goal (backward chaining). A useful engine records which rules fired and why.

**Why it pays.** The decision is externalized: one rule set serves several processes and applications, a domain expert can author it, a policy change does not rebuild the caller, and the trace is an audit artifact.

**What it costs.** A second runtime to deploy and monitor, data mapping at the boundary, versioning of rules and facts, conflict resolution that someone must own, and a latency step that is small but real. A rules engine without a validation and ownership story is just an untyped `if` in another language.

**When to use it.** The more of these are true, the stronger the case; two is the usual minimum:

1. The decision changes on a cadence faster than the release cadence, or must change without a redeploy.
2. Two or more callers need the same decision.
3. The rules have an owner who is not the developer, or an audit requirement.
4. The rule set needs chaining, priorities or a shared runtime that a table cannot express.

Two of the four is the usual minimum. One is a reason to extract the decision into a named component, not to adopt an engine.

**When not to.** A single caller; fewer than about ten stable cases; a decision in a tight per-frame loop; no one to own rule changes; a policy that is really configuration; a safety invariant.

**Decision tables.** If the gate passes because of overlap and readability rather than volatility, a table is the cheaper mechanism. Each row is a condition set and an outcome; the table exposes gaps (no row matches) and overlaps (several rows match). A table can be data in a file or a `switch` generated from it; it does not require an engine. Move from table to engine when the table needs chaining, priorities or a shared runtime, not before.

**Existing implementations.** Drools is the long-standing Java option. In .NET, NRules (Rete-based) and Microsoft RulesEngine (JSON rule sets) exist; both are dependencies with their own authoring and versioning model. Evaluate the authoring and audit story before the feature list.

## Process engine

**What it is.** A workflow/BPM engine that runs a defined process: service tasks, human tasks, timers, gateways, compensation, and persisted state.

**Without a rules engine.** Decision points are gateways with conditions in the model or code. This is enough when branching is small, stable, process-specific and not business-owned. It is simple, direct, one system to deploy, and the process designer sees everything in one place.

**With a rules engine.** A business-rule task sends facts to the rules engine and maps the result back. This buys reuse, business ownership, policy changes without redeploying the process, and a decision audit separate from the process history. It costs data mapping, a second engine to operate, some latency, and a version-compatibility risk if the engine is remote.

**When both.** Complex or volatile decisions, the same decision reused across processes, business ownership, and policy changes that must not wait for a process release.

**When neither.** A request that runs to completion in one call, with no human wait, no timer and no compensation, is a function. A process engine there is overhead with a diagram.

## Z3 and SMT

**What it is.** A satisfiability-modulo-theories solver. You give it constraints over integers, reals, bit-vectors, arrays or uninterpreted functions. It returns `sat` with a model, `unsat` with a proof that no model exists, or `unknown` on a timeout or a theory it cannot decide.

**Why it is different.** It searches; it does not execute rules. It can prove that a property holds for every input, which a rules engine cannot do.

**Use it for.**

- Checking a rule set for contradictions before deployment (no assignment satisfies two conflicting rules).
- Checking coverage (every input in the domain reaches some outcome).
- Scheduling and configuration with interdependent numeric constraints.
- Verifying an authorization policy against a property such as "no path grants admin".

**Do not use it for.** Runtime decisions on known facts. It is a proof tool, not a policy executor. The practical pattern is a rules engine or a table in production, with Z3 as an offline validation layer at rule-authoring time or in CI.

**Cost.** A solver is a specialist dependency, models are assignments rather than explanations, and `unknown` is a real outcome that must be handled. Budget for encoding the domain correctly; a wrong encoding proves the wrong thing.

## The C# shape, before you buy an engine

If the gate says "extract the decision" but not "adopt an engine", a small typed table is enough:

```csharp
public sealed record DiscountRule(string Name, Func<Order, bool> Applies, decimal Percent);

public static decimal DiscountFor(Order order, IReadOnlyList<DiscountRule> rules) =>
    rules.Where(rule => rule.Applies(order))
         .Select(rule => rule.Percent)
         .DefaultIfEmpty(0m)
         .Max();
```

This is readable, testable and versioned with the code. Grow it into an engine only when you need conflict resolution, chaining, an authoring surface or a trace that a non-developer reads.

## Getting facts in: the extraction boundary

A rules engine is only as good as its facts. CAD, drawings and documents arrive as geometry, text and annotations, not as typed facts. Convert once at an adapter boundary, then feed the engine only typed facts.

| Source | Tools that emit structured JSON | Note |
| :--- | :--- | :--- |
| DWG/DXF/DWF drawings | CADLens; Nomic Drawing Intelligence; Unstructured | Sheets, layers, entities, dimensions, annotations |
| AutoCAD models | ProtoTech JSON Exporter; JSONout; export-to-JSON LISP scripts | Entity-level JSON from the model |
| GIS interchange | MyGeodata CAD-to-JSON | DXF to GeoJSON or structured JSON |

The rule is the same as `parse, don't validate`: normalize at the boundary, keep the raw format out of the engine, and make the typed fact the only thing the rules see. If extraction is lossy, name what was lost (units, layer semantics, symbol identity) and keep the raw file for re-extraction.

## Choosing, in one pass

| If the situation is... | Choose |
| :--- | :--- |
| A handful of stable cases, one caller | Hard-coded branch or strategy list |
| Many overlapping cases that a person must read | Decision table |
| Volatile, shared, owned or audited decisions | Rules engine, with an owner and a validation step |
| Long-running work with waits, people or compensation | Process engine, with or without a rules engine |
| A property to prove over all inputs | Z3 offline; keep the production path simple |
| A safety or physical invariant | Hard-coded and tested; never a runtime-editable rule |

## Sources

- The private rules-engine notes: process engine versus rules engine; Z3 versus rule engine; CAD-to-JSON extraction tools.
- *A Guide to Claims-Based Identity and Access Control* is not a source here, but its ADFS chapter is a worked example of a rule engine used for claims transformation.
