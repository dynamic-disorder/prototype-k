# Clean Code: the delta, not the whole book

**TL;DR** — Naming, small functions, comments, formatting, objects, error handling, unit tests, classes, SOLID and the design patterns are already binding in `engineering-patterns` and the `csharp-*` skills. This page carries only what those rules do not: the smell list, package principles, third-party boundaries, concurrency, simple-design emergence, the legacy-code strategy, and the survey evidence.

## The concept card

| Concept | What it gives | Use when | Do not use when | Smallest proof |
| :--- | :--- | :--- | :--- | :--- |
| Smell vocabulary | A review lens for structural decay | Reviewing or refactoring an existing area | The code is new and small | One named smell and the move it implies |
| Package principles | Assembly boundaries that survive change | The repo has several assemblies or ships a package | One project, one assembly | No reference cycle; the stable core has no host reference |
| Legacy-code path | Safe change in a system with thin tests | A component must change and the safety net is missing | The change is already covered | Green to green, one step at a time |
| Concurrency discipline | A separate concern with known failure modes | Shared mutable state or asynchronous work | The code is single-threaded | The jiggling test passes repeatedly |
| Simple-design rules | A design that emerges from tested code | A design review or a refactor | A design that already works and is understood | Tests green, no duplication, intent named |

## Already binding: do not restate

| Topic | Where it is defined |
| :--- | :--- |
| Intention-revealing names; small functions; at most three parameters; no flag parameters; command-query separation | `engineering-patterns` |
| Comments say why, never what | `engineering-patterns` |
| Fail fast; guard clauses; no `null` for "not found"; no swallowed exceptions; result types for expected failures | `engineering-patterns` |
| Parse, don't validate; illegal states unrepresentable; validation at the boundary | `engineering-patterns` |
| SOLID applied with judgment; composition over inheritance; named patterns; no service locator; no singleton pattern | `engineering-patterns` |
| Constructor DI; async cancellation; no `.Result`/`.Wait()`/`async void` | `engineering-patterns` |
| Test shape: `Given`/`When`/`Then`, one behavior, deterministic, Shouldly, FakeItEasy, no Moq | `unit-test-writer` |
| C# style: no expression-bodied members, `is null`, XML docs, built-in type names, file-scoped namespaces | `csharp-conventions` |

The rest of this page is additive. Where a corpus heuristic conflicts with a project rule, the project rule wins.

## The smell list

Use these as review vocabulary, not as a score. A smell is a reason to look, not a verdict.

| Smell | What it looks like | The move |
| :--- | :--- | :--- |
| Rigidity | A small change cascades through many files | Find the dependency that forces the cascade; invert or isolate it |
| Fragility | One change breaks unrelated places | Add the missing boundary or test; the break is telling you where the seam is |
| Immobility | Code cannot be reused without dragging its context | Extract the part that is actually reusable; leave the context behind |
| Viscosity of design | The shortcut is easier than the right change | Make the right change cheaper: a test, a helper, a check |
| Viscosity of environment | Build/test is slow, so people skip it | Fix the loop before the discipline; a slow gate is a bypassed gate |
| Needless complexity | Structures nobody uses yet | Delete them; YAGNI is a design rule, not a slogan |
| Needless repetition | The same logic in several places, or the same thing two ways | Extract one; delete the other |
| Opacity | A reader cannot tell what it does | Rename, extract, or document the why; a comment that explains the what is a failure |

## Package and assembly principles

These matter when a repository has more than one assembly or ships a package. For a single-project tool, they are mostly free; for a multi-project solution with a NuGet, they are the cheap early warnings.

| Principle | The rule | The check |
| :--- | :--- | :--- |
| Release Reuse Equivalency (RREP) | The granule of reuse is the granule of release | A package is versioned and released as one unit; no "reuse the source" |
| Common Closure (CCP) | Classes that change together are packaged together | A change usually touches one assembly, not five |
| Common Reuse (CRP) | Classes used together are packaged together | A consumer does not pull an assembly for one type |
| Acyclic Dependencies (ADP) | The dependency graph has no cycles | A script or test over project references |
| Stable Dependencies (SDP) | Depend in the direction of stability | The core has no reference to a host, adapter or UI |
| Stable Abstractions (SAP) | Abstractness increases with stability | A stable assembly exposes interfaces, not concrete infrastructure |

ADP and SDP are the two to automate first: both are deterministic, both fail at zero, and both catch the mistake that is expensive to unwind.

## Design heuristics not already covered

- **One switch per type of selection.** A `switch` may exist once for a given selection; its cases create the polymorphic objects that replace every other switch on that type. A single small switch at a parsing boundary is fine; repeated selection logic is the smell.
- **Structure over convention.** Naming conventions help, but a structure that forces compliance beats a convention people can ignore. Prefer a type, a required parameter or a test over a naming rule.
- **Keep configurable data at the level that knows it.** A default or policy value belongs high in the call chain and is passed down as an argument; burying it in a low-level function hides the policy.
- **Hidden temporal coupling.** If calls must happen in an order, make the wrong order impossible: a builder, a state object, or a method that takes the prerequisite as an argument.
- **Feature envy.** A method that mostly reads another object's data wants to live on that object.
- **Law of Demeter.** Talk to direct collaborators, not to their collaborators. `order.Customer.Address.City` is a chain that couples three shapes.
- **Explanatory variables.** Give an intermediate result a name; it is cheaper than a comment.
- **Encapsulate boundary conditions.** Put the `+1`, the empty case and the last index in one place with a name.
- **Dedicated value objects over primitives.** `AbsolutePath`, not `string`; `OrderId`, not `Guid`. This is the same idea as parse-don't-validate, applied to parameters.
- **Positive conditionals.** `if (isValid)` reads better than `if (!isInvalid)`.
- **Persisted enums.** Use a stable reference code, not the enum's ordinal, for anything stored; use polymorphism when the enum carries behavior.
- **Over-configurability and micro layers.** Configuration nobody asked for and a layer that only forwards a call both add surface without buying change. Delete them.
- **Dead and commented-out code is deleted.** Version control is the archive; a comment that preserves code is clutter.

## Boundaries

- **Wrap third-party APIs** at the boundary. Do not let a library's types travel through your domain; adapt them once.
- **Write learning tests** for a third-party API: a small test that records the behavior you depend on. It teaches you the real API and warns you when an upgrade changes it.
- **Keep the boundary clean**: a change to the library should change the adapter, not the callers.

## Concurrency

- **Separate concurrency from the rest.** Concurrency management is its own concern; do not mix it into business logic.
- **Limit access to shared data.** Prefer copies and message passing over shared mutable state.
- **Know the library**: thread-safe or not, blocking or not, what the executor does.
- **Keep locked sections small**, and know the failure modes: bound resources, mutual exclusion, starvation, deadlock, livelock.
- **Get single-threaded correctness first**, then add concurrency.
- **Test with variation** ("jiggling"): thread count, speed, yielding, processor count, problem size. Track down every intermittent failure; "sometimes" is a defect.
- **Graceful shutdown is part of the design**; it is where deadlocks hide.

## Emergence: Kent Beck's four rules

A design is simple when it:

1. Runs all the tests.
2. Contains no duplication.
3. Expresses the programmer's intent.
4. Minimizes the number of classes and methods.

Rules 2–4 pull against each other and against SRP. The judgment is the point: do not split a class to satisfy rule 4, and do not merge two responsibilities to satisfy it either. Apply the rules to a design that already passes rule 1.

## The legacy-code path

When a component must change and the tests are thin:

1. Keep a running system; change in small steps from green to green.
2. Identify the features and rank them by likelihood and risk of change.
3. Introduce boundary interfaces so the environment can be simulated.
4. Cover each feature with acceptance tests.
5. Identify the components inside the feature and rank them the same way.
6. Refactor or introduce interfaces between components so each can be tested alone.
7. Write component acceptance tests.
8. Per component, decide: refactor (redesign with unit tests), reengineer (ATDD/TDD), or keep (few changes, few defects).

The decision to keep is legitimate. Not every component earns a rewrite.

## Refactoring patterns

- **Reconcile differences**: change two similar pieces stepwise until they are identical, then merge.
- **Isolate change**: isolate the target, refactor it, undo the isolation.
- **Migrate data**: move representation through a temporary duplicate.
- **Temporary parallel implementation**: run the new algorithm beside the old, switch callers one at a time, delete the old.
- **Demilitarized zone**: introduce an internal boundary, push the unwanted behavior into the zone, then refactor the boundary to match and delete the zone.

## What the survey adds

The 2020 Helsinki thesis surveyed 103 software professionals. Reported practice:

| Claim | Share |
| :--- | :--- |
| Always or usually write clean code | 82.5% |
| Naming should describe the purpose | 87.4% |
| Create classes respecting SRP | 78.6% |
| Classes they work on have high cohesion, always or often | 65% |
| Split functions longer than about 20 lines | 56.5% |
| Refactor after the feature works | 70.9% |
| Write tests as cleanly as production code | 58.3% |
| Team has a shared way to name abstractions | 46.6% |
| Team has a shared formatting convention | 77.7% |
| Perform code review | 78.6% |

The two blockers were the old codebase and schedule pressure. Read this as evidence that the gap is not knowledge of the rules; it is the cost of applying them in an existing system. That argues for the legacy path and for fitness functions, not for another style guide.

The thesis also warns that metrics such as LOC, cyclomatic complexity and LCOM are directional, not goals. The cheat sheet's TDD process smells add the same discipline for coverage: it is a way to find missing tests, not a target.

## When not to apply this

- **A heuristic is not a law.** "Classes under 100 lines", "functions under 20 lines" and "no more than three parameters" are signals, not gates.
- **Do not refactor without a safety net.** The legacy path exists because a rewrite without tests is a second defect.
- **Do not split for a line count.** Split for a reason to change.
- **Language and framework idioms win.** A C# record, a `switch` expression or a LINQ chain can express intent better than the textbook OO form.
- **Project rules win.** The repository's own conventions and analyzers are the enforceable version of these ideas.

## Sources

- *Clean Code: A Handbook of Agile Software Craftsmanship*, Robert C. Martin, 2008. Used for the delta above, not for the basics already in `engineering-patterns`.
- *The essence of "Clean Code"*, Lutz Prechelt, 2013–2014 (a paraphrased summary) and the *Clean Code Cheat Sheet* v2.2, Urs Enzler, 2013 (CC BY 3.0). The smell list, package principles, legacy path and refactoring patterns are drawn from these.
- *Puhdas ja laadukas koodi luokka- ja funktiotasolla* (Clean and high-quality code at class and function level), Suvi Sipilä, University of Helsinki, 2020. The survey figures and the metric caveats.
