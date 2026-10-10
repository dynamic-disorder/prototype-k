## Clean Code — Core Principles (for Copilot)

**General**

-   Prefer **refactoring and improving existing code** over generating large new blocks.
-   Keep functions **small and focused** (aim ≤ 20–30 lines); each should do **one thing well** (Single Responsibility Principle).
-   Use **descriptive, intention-revealing names** for classes, methods, variables, and logs.
-   Eliminate **duplication** (DRY). Reuse or extract shared logic; don’t re-implement similar loggers or utilities.
-   Favor **readability over cleverness**. Simple, direct solutions first.
-   **Minimize side effects**. Make functions pure when feasible; isolate I/O and state changes.
-   Prefer **composition over inheritance** for flexibility and testability.
-   Keep **cyclomatic complexity low**; use early returns and small helpers to reduce branching.
-   **Adhere to existing project conventions** (naming, folder structure, linting rules).
-   Write code that is **testable** (clear boundaries, dependency injection, no hard singletons).
-   Follow **YAGNI** (implement only what’s needed now) and **KISS** (keep it simple).

**Method & Class Design**

-   One class = one responsibility; one method = one operation or decision.
-   Extract methods for **validation**, **mapping/formatting**, **integration calls**, and **error handling**.
-   Centralize **cross-cutting concerns** (e.g., logging, metrics, retries) in reusable utilities/middleware.
-   Keep parameters minimal; prefer objects/records for clarity if 3+ params.
-   Avoid long parameter lists and boolean flags that change behavior; split into separate methods.

**Error Handling & Logging**

-   Use **specific exceptions**; don’t swallow errors. Log context and rethrow or handle gracefully.
-   Logging must be **consistent, structured, and deduplicated**—extend existing logger utilities rather than creating new ones doing similar things.
-   Include **actionable context** (operation, identifiers, correlation IDs), not stack traces everywhere.
-   Ensure **idempotent** safe-retry patterns where applicable.

**Refactoring First (especially for loggers)**

-   Before adding new code, **find and extend** the nearest existing logger or utility.
-   If two classes do similar logging, **merge or extract** common behavior into a shared component.
-   Replace large switch/if chains with **strategy/policy** objects or lookup maps where clearer.

**Formatting & Style**

-   Keep functions short, classes cohesive, and files focused.
-   Order members consistently: **public → protected → private**; **fields → constructor → methods**.
-   Maintain **consistent null/undefined handling** and defensive checks at boundaries.

**Testing**

-   Write **fast, focused tests**; mock I/O and external systems.
-   Test **behavior, not implementation** details; verify outcomes and interactions.

---

## Copilot Behavior (explicit guidance)

-   **Do not generate large monolithic code blocks.** Prefer **small, composable methods** and **targeted refactors**.
-   **Respect and use existing classes/utilities** (e.g., logger wrappers) instead of creating new ones with overlapping behavior.
-   When code is similar, **refactor to remove duplication** (extract method/util), don’t duplicate.
-   **Propose diffs/patches** or small snippets that slot into existing files rather than whole-file rewrites.
-   If a function grows, **split it**: validation, transformation, side-effects, and error handling belong in **separate** helpers.
-   **Preserve public APIs** unless instructed; make internal improvements first.
-   Prefer **composition, dependency injection, and interfaces** for extensibility and testing.
-   Follow the repository’s **lint rules, formatting, folder structure, and naming** (e.g., for Nx workspaces).

---

## Refactoring Checklist (quick prompts Copilot should follow)

1.  **Locate existing utility/class** (e.g., loggers) handling similar work—extend it.
2.  **Extract duplication** into a shared method or module.
3.  **Split large methods** into: validate → transform → act → handle errors.
4.  **Reduce parameters**, remove boolean flags, and clarify naming.
5.  **Add/adjust tests** for new behavior and edge cases.
6.  **Keep changes small and cohesive**; propose incremental diffs.