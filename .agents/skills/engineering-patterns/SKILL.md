---
name: engineering-patterns
description: The engineering rules analyzers cannot enforce - constructor dependency injection, functional C#, SOLID applied with judgment, async cancellation, fail-fast errors, service contracts and observability, test shape, and the script layout. Use when designing or reviewing C# code, a service boundary, a test, or a tool script, and when a pattern question comes up that .editorconfig cannot answer.
---

# engineering-patterns

Examples for the rules below: `references/engineering_patterns_examples.md`.

## C# design

- **Constructor DI (new code included):** dependencies come through constructors and are registered in DI. No static helper or class that takes services or `Func` lookups as parameters, no service locator (`IServiceProvider`/`GetService` outside the composition root), no `new` of collaborators in business code. Pure functions without dependencies may stay static. Use IoC/DI wherever a type has collaborators, and follow the DI and layering rules of the active project (`.agents/rules/` where it carries them); project rules win on conflict.
- **Functional style where it fits:** prefer pure functions, immutable data, and expressions over mutation and statements. Use modern C#: records and `with`, `init`/`required`, pattern matching and switch expressions, primary constructors, collection expressions, and LINQ. Keep a plain loop or class where it reads better. Keep mutation at the edges (I/O, persistence).
- **SOLID (apply with judgment):** **S** one reason to change per class. **O** extend through new types or DI registrations, not edits to a switch. **L** a subtype never narrows the contract of its base. **I** small role interfaces, not one wide interface. **D** depend on abstractions that a consumer needs, not on every concrete class. Do not add an interface for a type with one implementation and no test seam, and no layer for its own sake.
- **Design patterns (use when the problem fits, name the pattern in the type):** prefer composition over inheritance. Strategy for swappable behavior (inject `IEnumerable<IStrategy>` or a keyed service), Decorator for cross-cutting concerns (logging, caching, retry), Factory only when creation needs runtime input (an injected `IFooFactory`, never a static one), Adapter at every external boundary, Outbox for "write and publish". Avoid Singleton as a pattern (use the DI lifetime), Service Locator, and deep inheritance trees.
- **Async (C#):** pass `CancellationToken` through every async call. No `.Result`, `.Wait()` or `async void` (except event handlers).

## Code quality

- **Clean Code basics:** intention-revealing names. Small functions with one level of abstraction. At most 3 parameters (group more into a record). No boolean flag parameters: write two named methods. Command-query separation: a method changes state or returns data, not both.
- **Scope discipline:** no feature, comment, docstring or error handling beyond what was asked. Prefer editing the existing file, and add no helper abstraction for a one-time operation.
- **Comments say why:** a comment explains why, never what. If a comment explains what, rename or extract a method instead.
- **Fail fast and handle errors (C# and scripts):** check preconditions first with guard clauses and return or throw early. Avoid deep nesting. Do not return null for "not found" or "failed": use an empty collection, an option or result type, or throw. Do not swallow exceptions: log with context or rethrow. Use exceptions for exceptional cases and a result type for expected failures.
- **Parse, don't validate:** convert raw input to a typed value once at the boundary. Pass the type inward. Make illegal states unrepresentable (enums, records, non-nullable types).
- **Security and configuration:** validate input at the boundary. Never put secrets or personal data in logs, errors or test fixtures. Give each component the least privilege it needs. Configuration and secrets come from the environment, never from code or images.
- **Actionable errors:** a failing script says how to fix it: credential steps, a verification command, a doc link. A 404 distinguishes "does not exist" from "no permission".

## Services

- **Data ownership:** one service owns its tables. No cross-service database reads or shared schemas. Other services use its API or events.
- **Messaging:** a message handler tolerates duplicates and reordering (idempotency key or natural upsert). For "write DB and publish event", use the outbox pattern, never a dual write.
- **Outbound calls:** every call to another service has an explicit timeout and a bounded retry with backoff. Never retry a non-idempotent call. Add a circuit breaker where a dependency can stall you.
- **Additive contracts:** API and event contracts are versioned. Add fields. Never rename or remove one in a single step. Use consumer-driven contract tests where two teams meet.
- **Backward-compatible database changes:** expand, then contract. Add the new column or table first, ship code that reads both, and remove the old one in a later release. A rolling deploy must work.
- **Observability by default:** structured logs with a correlation ID across services, a health endpoint, and metrics for latency, traffic, errors and saturation.

## Testing

- **Section comments (any test in any language: C#, `.mjs`/`.js` `node:test`, `.py`, `.sh`, `.ps1`, bats, any framework, skill or not):** write `// Given: <state or condition>`, `// When: <action>`, `// Then: <expected outcome>` (`#` instead of `//` in `.py`, `.sh`, `.ps1`, bats) with a short description of that test, never a bare `// Given`. Merged sections: `// When/Then: <action and outcome>`. Applies when editing an existing file of bare comments too, for the tests you add or change. Before finishing a test file, grep it for `^\s*(//|#)\s*(Given|When|Then|When/Then)\s*$`: no hit may remain in what you wrote.
- **Deterministic tests:** inject the clock (`TimeProvider`). No `Thread.Sleep`, no real network, no dependence on test order. One behavior per test and no logic (loops, branches) in a test.
- **Assertions in C# unit tests: Shouldly** (`result.ShouldBe(expected)`, `ShouldBeEmpty()`, `ShouldContain(...)`, `Should.Throw<T>(...)`). The failure message shows the tested expression. Pass `customMessage:` to say why the assertion holds. Use the assertion library the active project already references when it differs.
- **Output:** use quiet reporters or pipe through `tail` unless debugging (`dotnet test --logger:"console;verbosity=minimal"`, `npm test -- --reporter=dot`).

## Scripts and agent configuration

- **Thin skills:** a skill with more than ~50 lines of inline bash, curl or parsing moves that logic into a script. The `SKILL.md` becomes a short delegator. `SKILL.md` loads every session; scripts do not.
- **Testable scripts (`.mjs`/`.js`):** keep pure logic (parsing, rules, text transforms) in `<script>-lib.mjs` with named exports and no file system, process or network access. The script file is a thin runner (arguments, I/O, exit codes) that imports the lib. Unit tests sit next to it as `<script>-lib.test.mjs` using `node:test` and `node:assert/strict`, run with `node --test <folder>/*.test.mjs`. The export planner in `scripts/lib/export-plan.mjs` is a worked example. New scripts follow this; existing ones are split when touched for another reason.
- **Self-contained projects:** each project owns its `.agents/` tree and has no runtime dependency on `~/.agents`. Reference `$(git rev-parse --show-toplevel)/.agents/...`.
- **No machine-specific paths** in scripts, docs or commits: use `$(git rev-parse --show-toplevel)`, `$HOME`, or a name the script derives. Hand-off blocks are the exception and need literal paths (see the `git-commit` skill).
- **Git in subdirectories:** after `cd`, give git paths relative to the current directory, not the repository root. Otherwise stay at the root and use full paths. Do not mix the two.
- **Task work folders:** a skill or script writing intermediate output creates one folder per task with `node ~/.agents/scripts/work-folder-create.mjs "<title-or-slug>"` under `local_user_files/`, then reuses it for every file of that task. Folder names: `<yyyy-mm-dd>_<slug>/`. Files inside are plain-named (`plan.md`, `review.html`).
