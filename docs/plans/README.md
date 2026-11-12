# Plans

**TL;DR** — Dated plans for changing this repository's structure, kept public because the reasoning
outlives the change and later sessions should read it instead of reconstructing it.

| Plan | Covers | Status |
| :--- | :--- | :--- |
| [`2026-11-11_umbrella-to-template-and-agents-export-plan.md`](2026-11-11_umbrella-to-template-and-agents-export-plan.md) | Merging `agent-skills` into this checkout, deleting every vendored skill, hook and style copy, moving `CsvTranslations` out as `csv-translations`, and exporting one installable configuration for an empty machine | Phase 1 done (one home, no copies); Phases 2–4 open |

A plan is written before the work and stays afterwards as the record of what was decided and why. It is
not rewritten to match the outcome; a plan that turns out wrong is corrected in place, with the correction
visible.

Plans that concern one machine or one investigation belong in the checkout that carries `local_dev/` and
`local_user_files/`, not here.
