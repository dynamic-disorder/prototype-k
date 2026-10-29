<!-- BEGIN managed: documentation-style -->
<!-- Installed by global-style/install.ps1 or global-style/install.sh. Do not edit here:
     edit global-style/documentation-style.md and re-run the installer. -->

## Documentation Style — Executive-First

Binding for every document, report, README, CLAUDE.md, docs page and commit-message body.
Full rules and examples: `global-style/documentation-style.md`.

Goal: fast, executive-level comprehension for busy readers with mixed technical backgrounds.

When a document is complex or multi-part, open with this table and use exactly these labels:

```
| | |
| :--- | :--- |
| **Problem** | What is the issue? One sentence. |
| **Value** | Why does it matter? |
| **Change** | What is being modified or decided? |
| **Verify** | How is success confirmed? |
| **Top risk** | The main thing that can go wrong. |
```

Flow: **Problem → Impact/Value → Change → Verification.** A reader who stops after Problem and
Value must still be able to decide. For a single-topic document, open with `**TL;DR** — ` and one
sentence instead.

- **Focus**: outcomes, rationale, risks and decisions before implementation detail. Never narrate
  the process that produced the conclusion.
- **Format**: scannable sections, short sentences, bullets and tables over prose, descending
  importance, at most two bullet nesting levels, split any section over ~15 lines.
- **Tone**: direct, plain language, no filler, no emoji in source/scripts/SQL. No sugarcoating
  modifiers ("honestly", "worth noting", "cost", "trade-off") around bad news — say the bad news.
- **Claims**: attach the number behind a pass/fail claim (tests run, files scanned, commands
  executed). No number, no claim.
- **Residual work**: say what is still unfinished, in one line, as a fact. "Not verified", "not
  run", "not pulled", "needs hardware" are complete statuses.
- **Ownership**: every report that leaves work open ends with who acts next — *me*, *you*, or
  *both* — and what that action needs (a download, a decision, hardware, money). Never make the
  reader work that out.
- **Commands**: every runnable command names the folder it runs from and states its CLI on the
  line above the block (`Run in Bash:`, `Run in PowerShell:`, `Run in cmd:`) — one block per shell
  actually needed, never a hard-coded machine path; the repository root is written as the
  project's documented root variable (`$PROJECT_LOCAL` in bash, `$env:PROJECT_LOCAL` in PowerShell).

<!-- END managed: documentation-style -->
