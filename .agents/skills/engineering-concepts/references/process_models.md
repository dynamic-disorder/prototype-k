# Process models: Scrum and Kanban

**TL;DR** — Scrum is a cadence with commitment: fixed sprints, a sprint backlog, a demo and a retrospective. Kanban is a flow with limits: pull work, cap work in progress, release when ready. Choose by whether the work can be forecast and whether there is a team to commit.

## The concept card

| Model | What it does | Use when | Do not use when | Smallest proof |
| :--- | :--- | :--- | :--- | :--- |
| Scrum | Runs work in fixed sprints with a committed sprint backlog and a review cadence | A team can forecast a window and needs a demo/retro loop | The work is interrupt-driven, or the "team" is one person | The sprint backlog fits one sprint and the demo happens |
| Kanban | Runs a continuous flow with explicit WIP limits and pull | Work arrives continuously, priorities move, or one person maintains it | Nobody respects a WIP limit, or a team needs a commitment date | A column is capped and work is pulled, not pushed |

## Scrum, as the source describes it

- **Cadence.** Sprints of one, two (most common), three or four weeks. Work is planned per sprint, not continuously.
- **Roles.** Product Owner (owns the backlog and priority), Scrum Master (helps the team keep the habits), Development Team. Stakeholders attend the planning and review.
- **Artifacts.** Product Backlog (everything known), Sprint Backlog (what the team committed to for this sprint).
- **Ceremonies.**
  - *Sprint Planning* — select high-priority items the team can commit to for the sprint.
  - *Daily Scrum* — a short stand-up on progress and blockers.
  - *Sprint Review* — a demo of completed work to stakeholders.
  - *Retrospective* — what went well, what to improve; the point is the next sprint is better.
- **Scope discipline.** The team works only from the sprint backlog for the sprint; new issues wait for the next sprint except in exceptional cases.
- **Release.** Completed items are packaged at the end of the sprint; some teams release more often. Incomplete items return to the product backlog.

The mechanism that makes Scrum work is the **commitment window**: a small, forecastable batch, a demo, and a retro. Remove the window and the commitment, and the ceremonies are meetings.

## Kanban, as the source describes it

- **Cadence.** Continuous. No sprint. Items are pulled directly from the product backlog.
- **Flow.** Each column has a strict WIP limit; the limit is what keeps items moving in the shortest time. An empty (or nearly empty) column signals the previous column to send another item; that is the pull system.
- **Release.** Each item is packaged for release as soon as it is ready, not at a sprint boundary.
- **Roles.** Product Owner; an Agile Coach where present (not every Kanban team has one).
- **Ceremonies.** A daily stand-up; reviews and retrospectives as appropriate or periodically, not on a fixed sprint clock.

The mechanism that makes Kanban work is the **WIP limit**. Columns without limits are a to-do list with a workflow picture.

## The differences that matter

| Dimension | Scrum | Kanban |
| :--- | :--- | :--- |
| Cadence | Fixed sprint | Continuous |
| Commitment | Sprint backlog committed for the window | Pull one item at a time |
| Change during the window | New work waits for the next sprint | Priorities can change at any time |
| Work-in-progress | Implicit in the sprint backlog | Explicit per-column WIP limit |
| Release | End of sprint (or more often) | As soon as an item is ready |
| Roles | Product Owner, Scrum Master, team | Product Owner, optional coach |
| Main lever | Planning and retrospective | WIP limit and flow |
| Fits | Forecastable team work with a demo cadence | Interrupt-driven, support, continuous delivery, solo |

## When to use which

**Scrum** when a team can forecast a short window, needs a commitment it can show, benefits from a demo and a retro, and the work is not dominated by unplanned interrupts.

**Kanban** when work arrives continuously, priorities move, the process is support or maintenance, delivery is continuous, or the maintainer is one person. A solo maintainer running Scrum is usually producing ceremony without a team to commit; Kanban with one WIP limit is the honest version.

**Neither** fixes a bad backlog. If the items are unclear or unprioritized, the process model only makes the confusion visible faster. Fix the backlog first.

**Hybrid.** Scrumban keeps the Kanban WIP limits and pull with a light planning/retro cadence. It is a legitimate choice when a team wants the flow discipline but still needs a periodic review.

## Applying it here

The owner's projects are phased, interrupt-driven and mostly maintained by one person. The match is Kanban:

- One visible board, one WIP limit per column, and a rule that a new item waits until a slot opens.
- The phase plans and handoff prompts already provide the planning and review cadence; a sprint would duplicate them.
- Add a lightweight iteration only when a phase has a fixed external deadline and a second person is involved; then timebox that phase, not the whole repository.

## Sources

- *Scrum vs Kanban* cheat sheet, Development That Pays, 2017 (issue 1.6). It is a one-page comparison, not a method definition; use the Scrum Guide and a Kanban text for the authoritative rules.
- The solo-maintainer guidance is this digest's recommendation, not the cheat sheet's.
