# Documentation style — executive-first writing

Binding for every document produced in `the workspace folder` and its repositories: `README.md`,
`CLAUDE.md`, `docs/`, analysis notes, ADRs, assessment logs, commit-message bodies, and any
report an AI assistant writes.

**Goal:** fast, executive-level comprehension for busy readers with mixed technical backgrounds.

**Installed in four places, so it loads without anyone remembering to ask for it:**

| File | Read by | Scope |
| :--- | :--- | :--- |
| `the workspace folder\documentation-style.md` | this file — the editable source of truth | shared across all repos |
| `%USERPROFILE%\.claude\CLAUDE.md` | Claude Code | every project on this machine |
| `%USERPROFILE%\.dsh\AGENTS.md` | DeepSeek Harness (`$DSH_HOME/AGENTS.md`) | every project on this machine |
| each repo's `CLAUDE.md` | both harnesses | that repository, so a clone elsewhere still gets it |

Change the rule here first, then copy the Summary block into the other three.

---

## 1. Structure, in priority order

### Executive summary — required when the document is complex or multi-part
One table, four rows plus risks. This is the whole document for most readers; everything below it
is evidence. Use exactly these labels so the table is scannable by position alone.

```markdown
## Executive summary

| | |
| :--- | :--- |
| **Problem** | What is the issue? One sentence. |
| **Value** | Why does it matter? Consequence or benefit, not mechanism. |
| **Change** | What is being modified or decided? Concrete, bounded scope. |
| **Verify** | How is success confirmed? A command, a count, a test result. |
| **Top risk** | The one thing most likely to go wrong. Omit only if genuinely none. |
```

The flow is **Problem → Impact/Value → Change → Verification**. A reader who stops after the
Problem and Value rows must still be able to make the decision.

### TL;DR — for a single-topic document
If the piece answers one question and the table would be ceremony, open with one bold
`**TL;DR** — ` sentence stating the outcome. `prototype-k/CLAUDE.md` and `snaerf/CLAUDE.md` are
the reference examples.

### Body
Headers in descending importance, each answering one question. Never chronological. Never
"I first tried X, then Y" — that belongs in an appendix or a decision log, not the body.

---

## 2. Rules

**Focus — outcomes over mechanism.**
- Lead with the result, the decision, the risk. Implementation details are supporting evidence.
- Include a code block, file path or command only when a reader must act on it or verify it.
- Never narrate the process that produced the conclusion. State the conclusion, then the proof.
- When there is a recommendation, put it in the first screen and label it as a recommendation.

**Format — scannable.**
- Short sentences. One idea each.
- Bullets and tables over paragraphs. Prose only where reasoning genuinely needs to flow.
- A table when comparing three or more things along the same attributes.
- Bold the load-bearing word in a bullet, not the whole sentence.
- A section that would exceed roughly 15 lines should be split or table-ised.
- No more than two nesting levels of bullets.

**Tone — direct and plain.**
- Plain language. Say "fails" not "experiences a failure condition".
- Name the thing. "The scanner" beats "the aforementioned component".
- State risks and gaps without hedging. "Not verified" is a complete and acceptable status.
- No filler: drop "it is important to note", "as mentioned above", "in order to".
- No emoji in source, scripts or SQL. Emoji are acceptable in static `.md`/`.html` only.
- Order by descending importance within every section.

**Commands — located, portable, and shell-named.**
- Every runnable command names the folder it runs from — before the block, or in a `#` comment
  inside it. A block without a stated working directory is incomplete: the same
  `dotnet run --project …` either finds its settings file or silently misses it depending on
  the shell's current directory.
- **Label the CLI on the line directly above the block**: `Run in Bash:`, `Run in PowerShell:`,
  `Run in cmd:` — one block per shell a reader actually needs. Do not mirror the same sequence in
  every shell "just in case"; the label plus the syntax inside the block is the contract.
- Write the syntax the label promises: `cd "$PROJECT_LOCAL"` is Bash, `cd $env:PROJECT_LOCAL` is
  PowerShell, `cd /d %PROJECT_LOCAL%` is `cmd`, and `VAR=1 command` exists only in Bash-like
  shells.
- Address the repository root through the project's documented root variable
  (`$PROJECT_LOCAL` in bash, `$env:PROJECT_LOCAL` in PowerShell, `%PROJECT_LOCAL%` in `cmd`) —
  never a hard-coded `E:\…` or `/home/…` path that is right on one machine and wrong on the next.
- Say where that variable is created once per machine (the project's developer-setup page), and
  keep it out of the product: it is a documentation and scripting convenience, not configuration
  the software reads.

**Honesty rules — these outrank brevity.**
- Separate **verified** from **not verified / not verifiable**. Silence is not evidence.
- Never state a "clean" or "pass" result without the coverage number behind it
  (files scanned, tests run, commits examined).
- Quote a real finding only when it is already public or benign; otherwise give a masked excerpt
  plus the location.
- When earlier text in the file was wrong, correcting it in place is better than quietly
  rewriting — keep the correction visible, as
  `prototype-k/local_dev/git-ignored-local-files.md` does.

**Residual work — no sugarcoating.**
- Call unfinished work unfinished: "not verified", "not run", "not pulled", "needs hardware" are
  complete statuses. Never wrap a gap in "honesty", "cost", "trade-off" or "worth noting".
- Say it in this order: the gap, its cause, the next step. One line each.
- Every report that leaves something open ends with an ownership line: **who acts next** (me, you,
  or both) and what that action needs — a download, a decision, hardware, network, money.
- If the next step is the reader's decision, ask for it in one line and stop. Do not perform the
  expensive action on their behalf, and do not bury the question under alternatives.

---

## 3. Reference: before and after

**Before — chronological, mechanism-first, buries the answer:**

> I started by checking the repositories with git grep, which returned nothing, so I then wrote
> a PowerShell scanner because git grep cannot see ignored files. The scanner initially only
> covered tracked files because Get-ChildItem failed silently on long paths, so I switched to
> cmd /c dir. After fixing the suppression bug and the Signals regex the run dropped from 508s
> to 192s, and in the end no work-related mentions were found in any repository.

**After — executive-first:**

> **No credential leaks and no work-related mentions** were found in any of the six repositories.
> The scanner had to be rebuilt twice before that result could be trusted: `git grep` cannot see
> git-ignored files, and `Get-ChildItem -Recurse` silently returns nothing on the longest paths
> here, so the first pass had only covered 550 of 11 456 files.

The second version keeps every fact that changes the reader's confidence and drops all of the
narration.

---

## Summary block (copy into the other three files)

```
## Documentation style — executive-first

Binding for all documents and commit-message bodies. Goal: fast comprehension for busy readers
with mixed technical backgrounds.

Required when complex/multi-part:
  | **Problem** | the issue, one sentence |
  | **Value**   | why it matters |
  | **Change**  | what is modified/decided |
  | **Verify**  | how success is confirmed |
  | **Top risk**| the main thing that can go wrong |

Flow: Problem -> Impact/Value -> Change -> Verification. A reader who stops after Problem and
Value must still be able to decide. For single-topic docs, open with **TL;DR** - one sentence.

Focus: outcomes, rationale, risks and decisions before implementation detail.
Format: scannable sections, short sentences, bullets and tables, descending importance,
no more than two bullet levels.
Tone: direct, plain language, no filler, no emoji in code.
Claims: attach the number behind any pass/fail claim.
Residual work: say what is unfinished, who acts next (me/you/both), what it needs.
Commands: name the folder each command runs from and label its CLI on the line above the
block ("Run in Bash:", "Run in PowerShell:", "Run in cmd:") — one block per shell actually
needed; address the repository root as the project's documented root variable
($PROJECT_LOCAL / $env:PROJECT_LOCAL), never a hard-coded machine path.
```
