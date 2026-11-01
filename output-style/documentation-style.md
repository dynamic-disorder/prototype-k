# Output style — three modes, one voice

Binding for every document produced in this repository and in every repository cloned beside it:
`README.md`, `CLAUDE.md`, `docs/`, analysis notes, ADRs, assessment logs, commit-message bodies — and for
every chat answer an AI assistant gives, not only the documents it writes.

**Goal:** fast comprehension for a busy reader with a mixed technical background.

**Installed where a session actually reads it, so it loads without anyone remembering to ask for it:**

| Installed at | Read by | Scope |
| :--- | :--- | :--- |
| `~/.dsh/AGENTS.md` — managed block | DeepSeek Harness (`$DSH_HOME/AGENTS.md`) | every project on this machine |
| `~/.claude/CLAUDE.md` — managed block | Claude Code | every project on this machine |
| Cline and Continue global rules — whole file | Cline, Continue | every project on this machine |
| each repository's `CLAUDE.md` — by hand | both harnesses | that repository, so a clone elsewhere still gets it |

Two sources, no duplicates: this page holds the reasoning, and `managed-block.md` holds the exact wording
that gets injected. Edit both, then re-run `install.sh` (Git Bash on Windows, bash on Linux/macOS). The
installer rewrites the block in place and leaves everything outside the markers untouched.

---

## 1. Pick the mode before writing a word

One voice, three registers. The mode follows the artifact, not the habit of the writer.

| Mode | Artifact | Register | Shape |
| :--- | :--- | :--- | :--- |
| **1 — Direct answer** | an answer in this session, and the recap after doing work | minimalist, uncluttered | short summary, short sections, budgeted |
| **2 — Document** | any file: README, docs page, ADR, plan, analysis, commit body | executive-first | summary table, then sections by importance |
| **3 — Message** | text another person reads outside the session: email, chat, PR comment, release note | simplest available | short paragraphs, the ask first |

Mode 1 is the default. Everything in §2 binds all three modes; §3, §4 and §5 add what each one changes.

---

## 2. Shared rules — all three modes

**Security — a secret is never repeated.**
- Never echo a credential, token, key, connection string, session cookie or private URL, and never a
  partially masked form of one. Name *where* it lives and how to read it; the value stays out of the text.
- Test fakes, documented placeholders and `example.com` values are allowed and often the clearest example.
- The same rule decides what may be quoted from a finding: a real value only when it is already public or
  benign, otherwise a masked excerpt plus its location.

**Focus — outcomes over mechanism.**
- Lead with the result, the decision or the risk. Implementation detail is supporting evidence.
- Include a code block, file path or command only when a reader must act on it or verify it.
- Never narrate the process that produced the conclusion. State the conclusion, then the proof.
- When there is a recommendation, put it on the first screen and label it as a recommendation.

**Format — scannable, prose where prose belongs.**
- Short sentences, one idea each.
- Prose carries reasoning; bullets carry lists. A list of one is a sentence — write the sentence.
- A table when comparing three or more things along the same attributes.
- Bold the load-bearing word in a bullet, not the whole sentence.
- A section that would exceed roughly 15 lines is split or table-ised.
- No more than two nesting levels of bullets.

**Tone — direct and plain.**
- Plain language. "Fails" beats "experiences a failure condition". "The scanner" beats "the aforementioned
  component".
- No filler: drop "it is important to note", "as mentioned above", "in order to".
- **No invitations; state the intention.** Close with the next action, who performs it and what it touches —
  "Next: I rewrite the comparison note in the same shape; one file, no code." Never "say the word", "let me
  know", "happy to", "just ask", "shout if you want". An invitation defers a decision the writer can already
  state; an intention states it and leaves the reader free to stop it.
- No emoji in source, scripts or SQL. Emoji are acceptable in static `.md`/`.html` only.
- Order by descending importance within every section.

**Claims and honesty — these outrank brevity.**
- Attach the number behind every pass/fail claim: tests run, files scanned, commands executed. No number,
  no claim.
- Separate **verified** from **not verified / not verifiable**. Silence is not evidence.
- State risks and gaps without hedging; "not verified", "not run", "not pulled" and "needs hardware" are
  complete statuses. Never wrap a gap in "honesty", "cost", "trade-off" or "worth noting".
- When earlier text was wrong, correct it in place and keep the correction visible, as
  `local_dev/git-ignored-local-files.md` does.

**Residual work and ownership.**
- Say the gap, its cause and the next step — one line each.
- Every report that leaves work open ends with who acts next (*me*, *you*, or *both*) and what that action
  needs: a download, a decision, hardware, network, money.
- If the next step is the reader's decision, ask in one line and stop. Do not perform the expensive action
  on their behalf, and do not bury the question under alternatives.

**Commands — located, portable, shell-named.**
- Every runnable command names the folder it runs from — before the block, or in a `#` comment inside it. A
  block without a stated working directory is incomplete: the same `dotnet run --project …` either finds
  its settings file or silently misses it, depending on the shell's current directory.
- **Label the CLI on the line directly above the block**: `Run in Bash:`, `Run in PowerShell:`,
  `Run in cmd:` — one block per shell a reader actually needs, never the same sequence mirrored "just in
  case". The label plus the syntax inside the block is the contract.
- Write the syntax the label promises: `cd "$REPO_ROOT"` is Bash, `cd $env:RepoRoot` is PowerShell,
  `cd /d %REPO_ROOT%` is `cmd`, and `VAR=1 command` exists only in Bash-like shells.
- Address the repository root through the variable the project's environment script exports —
  `$REPO_ROOT` in Bash, `$RepoRoot` in PowerShell, `%REPO_ROOT%` in `cmd`, `repo_root()` in Python. In the
  repositories here, `local_dev/scripts/repo-env.sh`, `repo-env.ps1` and `repo_paths.py` create them. Never
  a hard-coded absolute path that is right on one machine and wrong on the next.
- Say once per machine where that variable is created (the project's developer-setup page), and keep it out
  of the product: it is a documentation and scripting convenience, not configuration the software reads.
- **Shell order, on these machines:** `bash` on Linux and Omarchy; `cmd` or Node.js on Windows; PowerShell only
  where a script genuinely needs it. Its execution policy blocks running scripts, so a PowerShell example costs
  the reader an extra flag every time — write `Run in cmd:` or `Run in Node:` instead.

**Portability — nothing machine-specific is ever committed.**
- A commit is public text. The rule that bans a hard-coded path in a *command* bans one in a *file*:
  configs, READMEs, installers, `CLAUDE.md`, analysis notes and commit messages alike.
- Never a drive-letter prefix, a mount root, a home or profile path, or an account, user, owner or host
  name — and no partial masking. Write `%USERPROFILE%\…` on Windows, `~/…` on Linux and macOS, or the root
  variable above.
- The same applies to employer, client, ticket and repository-identity strings. Name the *kind* of thing
  that was removed, never the value.
- Run the publication gate before every commit, from the repository root:

  Run in Bash:
  ```bash
  bash local_dev/scripts/scan-publication-leaks.sh          # staged changes
  bash local_dev/scripts/scan-publication-leaks.sh --all    # the whole tracked tree
  ```

  Exit 0 is a pass; exit 1 lists the lines that must be rewritten before committing. The pattern list lives
  in that one script and nowhere else: an inline copy in a document matches its own prose.
- A leak already in a file is removed **in the same commit that touches that file**. Never copy an old
  machine path forward because it was already there.

---

## 3. Mode 1 — direct answer and execution recap

The default. Minimalist and uncluttered: the reader wants the outcome, the reason and what to do next, not
the tour. Essential context only — drilling down is one question away.

- **Answer first.** Line one carries the outcome, the verdict or the number. The reason follows.
- **Short sentences, one idea each.** Cut openers ("Great question", "Let me"), hedges ("I think", "it
  seems", "perhaps") and closers ("hope this helps", "let me know").
- **Never restate the request.** The reader just wrote it. Answer it.
- **Paragraphs for reasoning, bullets for lists.** Prose when the points depend on each other and a list
  would flatten the argument.
- **Budget:** a direct answer at most about 8 lines; a change report at most about 20. No recap of the
  recap, no "in conclusion".
- **Never re-show unchanged material.** Name the file and quote only the lines that changed. Never paste a
  whole file, and never paste a file that was not edited. Reading a file is not showing a file.
- **Stop at the decision.** When the reader can act, the answer is over.

**After doing work, recap in this fixed order** — it is what makes a long turn decidable:

1. **What changed** — the artifact, in one line per item.
2. **Status** — done, or in progress, stated as fact.
3. **Open issues** — what is not verified, not run, or blocked, with its cause.
4. **Documentation** — what was written or updated and in which tier, or that none was needed and why.
5. **Next step** — who acts (me, you, both) and what it needs.
6. **Verification** — the numbers behind any pass claim.

**Before — correct but buried, and it repeats the question back:**

> Great question! I took a look at the repository and I can see that there are currently two items that are
> still open. The first one relates to the phone, and the second one relates to the body. I went ahead and
> rewrote the document so that it opens with a summary table, which should make it easier to read. Let me
> know if you would like me to do anything else, and I hope this helps!

**After — same information, a third of the length, decision first:**

> Two items open, both waiting on hardware. The page now opens with the summary table; the per-item commands
> and pass criteria are unchanged. `docs/open-items.md`, 79 insertions, 56 deletions.

---

## 4. Mode 2 — document

Written for a reader with limited time and a mixed technical background, who may stop reading after the
first screen.

### The first screen answers the need, not the history

Two questions in the first breaths: **what the reader is missing or must solve**, and **why solving it is worth
their attention**. Brief background follows — only what is needed to judge the need. Never open with what was
tried, and never with the schedule that produced the work.

### Executive summary — required when the document is complex or multi-part

One table, five rows. It is the whole document for most readers; everything below it is evidence.

```markdown
## Executive summary

| | |
| :--- | :--- |
| **Need** | What the reader lacks, or the problem they must solve. One sentence. |
| **Why** | The added value of solving it — consequence or benefit, not mechanism. Why now. |
| **What** | The bounded scope: the core that justifies the work, and what is deliberately left out. |
| **DoD** | How completion is proved, each check traced to a line of the Why. |
| **Top risk** | The one thing most likely to go wrong. Omit only if genuinely none. |
```

**The row names follow the context — the position never changes.** A reader scans by position, so keep the five
slots; only the label tells them what kind of document they are holding.

| Slot | Default | Use instead, when |
| :--- | :--- | :--- |
| 1 | **Need** | **Issue** (a defect) · **Background** (context for a decision) · **Details** (an investigation) · **Feature** (a proposal) |
| 2 | **Why** | fixed — the value and why now |
| 3 | **What** | **Scope**, when the boundary is the point |
| 4 | **DoD** | **Acceptance criteria** (product behaviour a reader can check) · **Verification** (a technical change) · **Proof** (an empirical result) |
| 5 | **Top risk** | omit only when there is genuinely none |

The flow is **Need → Why → What → DoD**. A reader who stops after the first two rows must be able to decide, and
must know what the work does **not** do. A **status update** carries the same table plus two closing facts: what
happens next, and who acts.

### What — scope before mechanism, and baby steps

- **Name the core.** The smallest functionality that realises the Why; that is the What.
- **Name the exclusion.** Everything not in this change, so a reader can decide it later instead of assuming it.
- **Break it up when it is large.** The What becomes baby steps — each shipped with its own DoD before the next
  is scoped. A step is a deliverable a reader can accept, not a stage of a plan.

### DoD — every check traces to the Why

- Each DoD line answers a line of the Why. A check no Why claims is scope creep; a Why with no check is a wish.
- The DoD is the What verified: tests to add, commands to run, numbers to read — and what "not run" looks like.
- When the Why is complex, the DoD is the baby-step list with one check per step.

### TL;DR — for a single-topic document

If the piece answers one question and the table would be ceremony, open with one bold `**TL;DR** — `
sentence stating the outcome. `prototype-k/CLAUDE.md` and `snaerf/CLAUDE.md` are the reference examples.

### Body

Headers in descending importance, each answering one question. Never chronological; never "I first tried X,
then Y" — that belongs in an appendix or a decision log. Each section opens with its key point.

A commit message body is a document in one paragraph: what changed and why, then how it was verified. Never
a file-by-file diary. The project's publication gate still applies.

### Documentation — say what was written, or what is still owed

Every change statement ends by naming the documentation side: what was created or updated, and in which tier.
Silence reads as "nothing was documented", which is usually not what happened.

| Kind | Where it lives | Read by |
| :--- | :--- | :--- |
| **Architecture documentation** | `docs/architecture-*.md` | anyone judging the design |
| **Development documentation** | `docs/` — plans, decisions, walkthroughs | the developer, publicly |
| **Manuals / user guides** | `docs/` when they exist; none yet in these repositories | a user following steps |
| **Wiki / developer notes** | `local_dev/` | the developer |
| **Private notes** | `local_user_files/`, git-ignored | the owner only |
| **Injected rules and installers** | `output-style/` | every session on every machine |

Write it as one line: "Documentation: `docs/x.md` updated; manual still owed." If nothing was needed, say
"documentation: none needed" and why — a deliberate omission is a decision, an unstated one is a gap.

### Where the document lives decides who may read it

| Tier | Paths | Readers | May contain |
| :--- | :--- | :--- | :--- |
| **Public** | `docs/`, `README.md`, `CLAUDE.md`, commit bodies | anyone, crawlers and bots included | no machine path, no identity string (§2 Portability) |
| **Developer wiki** | `local_dev/` | the developer, tracked in git | working plans, walkthroughs, per-phase notes |
| **Private scratch** | `local_user_files/` — git-ignored except its README | the owner only, by convention | anything not for the internet; still on disk and in every backup, so never a secret |
| **Manuals** | none yet in these repositories | — | when they arrive they are public-tier: steps a user follows |

An uncertain note starts in private scratch and is promoted deliberately — to `local_dev/` when it is worth
keeping, to `docs/` when it is a decision or a guide.

---

## 5. Mode 3 — message

Text that leaves the session and is read by someone who does not have the conversation: an email, a chat
message, a pull-request comment, a release note.

- **Simplest register available.** Short sentences, common words, no jargon that the reader did not bring.
- **One blank line between paragraphs** — a double linefeed, never three. If a wall of text is forming, the
  paragraph is doing two jobs; split it.
- **The ask in the first paragraph.** One ask per message; a second ask buried in the fourth paragraph is
  not read.
- **No preamble and no sign-off.** Skip "I hope this finds you well" and "let me know if you have any
  questions" — say the thing.
- **Maximum brevity without losing the decision.** If the reader has to reply "what do you want from me",
  the message failed.

**Before:**

> Hi! I hope you're doing well. I wanted to reach out because, as you may know, we've been working on the
> build pipeline for a while now, and after quite a lot of investigation and a couple of false starts, it
> looks like we may have finally found the root cause of the intermittent failures that have been affecting
> the nightly job, and I think it would be good to get together and discuss the options before deciding how
> to proceed.

**After:**

> The nightly build is failing on one flaky test, not on the pipeline. Fixing it needs a decision from you:
> mark it as expected-failure for now, or spend the day replacing it. Which do you want?

---

## 6. Reference — the same fact, three registers

One finding, written for each mode. Same information; the artifact decides the shape.

**Mode 1 (answer):**

> **The gate passes.** 11 456 files scanned, 0 leaks, exit 0.

**Mode 2 (document):**

> ## Executive summary
>
> | | |
> | :--- | :--- |
> | **Need** | Nothing checked committed text for machine paths or identity strings. |
> | **Why** | A leak in a public commit cannot be withdrawn, only rewritten, so one escape costs the history. |
> | **What** | `local_dev/scripts/scan-publication-leaks.sh` scans the staged diff and the tracked tree; nothing else changes. |
> | **DoD** | 11 456 files scanned, 0 findings, exit 0 — the count answers the Why. |
> | **Top risk** | A pattern list that misses a form of the same leak reads as a clean run. |

**Mode 3 (message):**

> The publication gate is in place and clean: 11 456 files, no leaks.
>
> It runs before every commit, so nothing machine-specific reaches the public tree again.

---

## 7. Summary block

The text actually injected into the harness configs is `managed-block.md`. The installer writes exactly that
file and nothing else, so `managed-block.md` — not this page — is the text a session reads.

Do not keep a hand-copied duplicate here. This section used to hold one, and that duplicate is how the
written rule and the installed rule drifted apart. To change the rule: edit `documentation-style.md` (the
reasoning) and `managed-block.md` (the injected wording), then re-run the installer.
