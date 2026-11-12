# Agent skill authoring specs

**TL;DR** — Four source specs for writing an agent skill in this repository: the `SKILL.md` structure, the
skill `README.md` style, why skill logic is written as `.mjs`, and which work belongs in a script.

| File | Answers | Applies to |
| :--- | :--- | :--- |
| [`skill-md-structure-and-style.md`](skill-md-structure-and-style.md) | Frontmatter rules, the eight body sections in order, the engineering rules (imperative voice, prerequisites as a table, name every loss), and the Functional Requirements table shape. | Any `SKILL.md`, including the ones under [`.agents/skills/`](../../.agents/skills/). |
| [`skill-readme-writing-style.md`](skill-readme-writing-style.md) | The README skeleton — title, executive summary, Problem/Why/What/Verification table, Import for AI blocks split by platform, agent execution rules, tests, files index. | The `README.md` beside a skill. |
| [`mjs-files-reference.md`](mjs-files-reference.md) | What `.mjs` is, how it differs from `.js` and CommonJS, and when a task belongs in Node instead of PowerShell or Bash. | `scripts/*.mjs` inside a skill. |
| [`skill-script-delegation.md`](skill-script-delegation.md) | Which skills delegate to a script, where each script lives, and the helper scripts shared between them. | A skill whose body is a command and a report. |

## How to use them

Read the file, do not paraphrase from memory: the global agent instructions carry a summary of all four, and
the summary is deliberately shorter than the specs. A skill that is large, or a case the summary does not
settle, is settled here.

- **`SKILL.md` body stays under 500 lines.** The spec says so, and this repository's skills are far below it.
- **The exact trigger phrases live in the frontmatter `description`,** not only in "When to Use". Under-triggering
  is the failure mode the spec warns about.
- **A requirement nobody can fail is not a requirement.** Every Functional Requirement names the command or
  inspection that proves it.

These are the owner's originals, copied unchanged; the filenames are this repository's kebab-case form of the
source names. Edit them only when the spec changes at the source, and copy the change back rather than letting
the two versions drift.

## Documentation

Written here: this index and the four specs beside it. The [docs map](../README.md) lists this folder in its
"The set" table.
