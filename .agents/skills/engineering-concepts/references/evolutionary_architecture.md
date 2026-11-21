# Evolutionary architecture: fitness functions and guardrails

**TL;DR** — An architecture that must survive change needs mechanisms that notice drift, not a diagram that describes intent. A fitness function is an automated check of an architectural property; a guardrail is a default that makes the safe path the easy one.

## The concept card

| Concept | What it does | Use when | Do not use when | Smallest proof |
| :--- | :--- | :--- | :--- | :--- |
| Fitness function | An automated check of an architectural property, run in CI | A property has regressed before, or must never regress | Nobody would act on the number, or it cannot fail | The build fails when the property breaks |
| Guardrail | A platform default that makes the safe path the easy one | Many teams or repos repeat the same risky step | One repo with one owner | A new repo gets the safe path without asking |
| Comprehension check | A checkpoint that a person can still explain the system | The system is large, old or AI-assisted | The system is small and one person holds it | A new session can change it without a rewrite |
| Boundary | A seam where independent change can happen | Two parts change at different rates or by different owners | The "boundary" is a folder with shared state | A change on one side does not touch the other |

## The idea

Architecture is usually framed as making change easier. A stronger frame: evolution is about keeping change *safe, clear and deliberate* while technology and the organization move. That is a continuous feedback system:

- **Fitness functions** signal when the system drifts from a property you decided to keep.
- **Comprehension** confirms that people still understand what they are modifying; a system nobody understands cannot evolve safely.
- **Boundaries** define where independent change can happen.
- **Platforms and guardrails** turn safe practices into repeatable defaults.
- **Organizational design** keeps those boundaries alive when they meet reality (Conway's law, the inverse Conway maneuver).

None of these works alone. A fitness function with no owner is a red build people ignore; a boundary with no guardrail erodes; a platform with no comprehension becomes a black box.

## Fitness functions

A fitness function is a check with a pass/fail threshold for an architectural characteristic. It is not a dashboard; if it does not fail the build (or block the merge), it is a report. It can be *atomic* (one property) or *holistic* (a combination), and *triggered* (on a change) or *continual* (on a schedule); start atomic and triggered, because that is the cheap one.

**Deterministic examples for a .NET repository**

| Property | The check | Threshold |
| :--- | :--- | :--- |
| Dependency direction | Parse project references; fail on a cycle or an inward dependency | Zero violations |
| Public API compatibility | Compare the packed public surface with the last release | No removed or renamed public member |
| Layering | Assert the domain assembly references no infrastructure assembly | Zero references |
| Warnings | Treat warnings as errors in the build | Zero new warnings |
| Performance | A benchmark on a stated machine and run | A budget measured on that run |
| Package hygiene | The packed package has no unexpected dependency | An allow-list |

**Agentic fitness functions.** The eMag's extension: a governed AI judgment layer evaluates semantic drift, boundary fidelity and architectural risk inside CI/CD. It is useful where a deterministic check cannot express the property, such as whether a change still belongs to its bounded context or whether a document still matches the code. It is not a replacement for a deterministic gate:

- Pin the model and the prompt; treat both as configuration.
- Keep a baseline and a diff, not a fresh opinion each run.
- Give a human an appeal path; a non-deterministic gate must not be the only gate.
- Budget the cost; a per-commit model call is a per-commit bill.
- Never let it decide security, correctness or a safety property.

**How to add one.** Pick one property that has actually regressed or would be expensive to regress. Write the check so it fails on today's good state only when the property breaks. Wire it into the existing gate, not a new pipeline. Record the threshold and the run that produced it. Name the owner. Retire it when the property is no longer strategic, or it becomes cargo.

## Comprehension and cognitive debt

As code output accelerates, understanding decays quietly. The eMag treats comprehension as an architectural characteristic: a system that is not understood cannot be evolved safely. Practical checkpoints:

- A new session or a new person can change a module without reading the whole system.
- The architecture document names the boundaries and the reason for each, and is checked against the code.
- Names and folder structure carry the domain, not the framework.
- Decisions are recorded where the change happens (ADR, plan section, commit body), not in a chat that disappears.
- A periodic "explain this module" pass is cheaper than a rewrite.

This is where the Clean Code survey lands: its blockers were the old codebase and schedule pressure, so comprehension is the cheaper counter, not more process.

## Boundaries, platforms, Conway

- **Boundaries** are where independent change happens: a service, a package, a module with a real contract. A boundary with shared state or a shared database is not a boundary.
- **Guardrails** are defaults that make the safe path the easy one: a template that already has the build, the gate, the lint and the dependency direction; a golden path for a new service; a pipeline that fails closed.
- **Conway's law** says the system mirrors the communication structure. The inverse maneuver changes the team or ownership structure to get the architecture you want. The eMag's cases use domain boundaries, platform engineering and zero-trust to federate ownership without losing coherence.

## When to use it

- A property has regressed before, or a rewrite would be expensive.
- Several repositories or teams repeat the same risky step; a guardrail pays.
- The system is large enough that a person cannot hold it, or AI-assisted change is outrunning understanding.
- A boundary must survive team changes.

## When not to

- A small repo with one owner and a green test suite; the tests and the gate already are the fitness functions.
- A metric nobody would act on. A number that cannot fail is a report, not a requirement.
- A threshold with no measured baseline. An aspirational number becomes an arbitrary number.
- An agentic judge with no baseline, no appeal path and no budget.

## Applying it here

- **Already fitness functions:** the pre-commit gate, the publication scan, the test suites, and the warning policy. Keep them.
- **First additions worth the cost:** a dependency-direction check over the projects (no cycles, dependencies point at the stable core) and a public API compatibility check for the packable retrieval package. Both are deterministic, both have a zero threshold, and both would be expensive to unwind if they regressed.
- **Comprehension assets already present:** `AGENTS.md`, the plan set, the architecture diagrams and the manual. The check is whether a fresh session can use them; when it cannot, the document is the defect.
- **Guardrails already present:** the project templates, the link-based install and the export. A new repository inherits the gate without deciding to.

## Sources

- *Evolutionary Architecture in Practice*, InfoQ eMag. The article list is the source for fitness functions, agentic fitness functions, comprehension, boundaries, guardrails and Conway.
- The atomic/holistic and triggered/continual vocabulary is from *Building Evolutionary Architectures* (Ford, Parsons, Kua); it is background vocabulary, not part of the corpus.
