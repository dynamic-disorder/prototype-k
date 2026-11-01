<!-- BEGIN managed: documentation-style -->
<!-- Installed by global-style/install.sh. Do not edit here:
     edit global-style/documentation-style.md and re-run the installer. -->

## Output Style — Three Modes, One Voice

Binding for every chat answer, document, report, README, CLAUDE.md, docs page and commit-message body.
Full rules and examples: `global-style/documentation-style.md`.

Goal: fast comprehension for busy readers with mixed technical backgrounds. Pick the mode from the
artifact, not from habit — **1** for an answer in this session (the default), **2** for a file you write,
**3** for text another person will read.

Always, in every mode: outcomes before mechanism · plain words, short sentences, no filler · the number
behind every pass/fail claim · bad news flat, no cushioning · residual work named with who acts next (me,
you, or both) · close with the explicit next action and what it touches, never "say the word", "let me know"
or "happy to" · never echo a secret or credential, not even partially — name where it lives (documented
fakes, placeholders and `example.com` values are fine) · never re-show material that did not change.

**1 — Direct answer and execution recap (default).** Minimalist and uncluttered: the outcome and its
rationale, not the mechanism; essential context only, because the reader can ask to drill down. A brief
summary first, then short sections. Prose carries reasoning; bullets only for a list. Budget: a direct
answer ≤ 8 lines, a change report ≤ 20. After doing work, recap in this order: what changed → documentation →
done vs next → open issues → the verification numbers.

**2 — Document.** Every file written: README, docs page, ADR, plan, analysis, release note, commit body.
Audience: mixed technical backgrounds and limited time. Open with the reader's need, not the history. Complex
or multi-part — open with exactly this table.

```
| | |
| :--- | :--- |
| **Need** | What the reader lacks, or the problem to solve. One sentence. |
| **Why** | The added value — consequence, not mechanism. Why now. |
| **What** | The bounded scope: the core, and what is deliberately left out. |
| **DoD** | How completion is proved, each check traced to a line of the Why. |
| **Top risk** | The main thing that can go wrong. Omit only if genuinely none. |
```

Single topic — open with `**TL;DR** — ` and one sentence instead. Then flow **Need → Why → What → DoD** in
descending importance, never chronology; a large What becomes baby steps, each shipped with its own DoD before
the next is scoped. **The row labels follow the context, the five slots do not:** slot 1 becomes *Issue*,
*Background*, *Details* or *Feature*; slot 4 becomes *Acceptance criteria*, *Verification* or *Proof*. Sections
≤ ~15 lines, bullets for lists, a table when comparing three or more things, at most two nesting levels, a
command only where the reader must act (folder named, CLI labelled on the line above the block), and an
ownership line when work stays open. A status update adds what happens next and who acts. **End with a
documentation line** — what was written or updated and where (`docs/` architecture or development docs,
`local_dev/` wiki, `local_user_files/` private), or that none was needed and why. A commit body is a document in
one paragraph: what and why, then how it was verified — never a file-by-file diary.

**3 — Message.** Text that leaves the session: an email, a chat message, a PR comment, a release note. The
simplest register available. Short sentences. One blank line between paragraphs — a double linefeed, never
three. The ask sits in the first paragraph, one ask per message, no preamble and no sign-off.

- **Never in a commit.** Every commit is public text. No drive-letter prefixes or mount roots, no home or
  profile paths, no account, user, owner or host name, no employer or ticket identifiers — not in a file, a
  doc, a config or a commit message, and not partially masked either. Write `%USERPROFILE%\…` on Windows and
  `~/…` on Linux and macOS, or the project's root variable. Run the project's publication gate before
  committing (here: `local_dev/scripts/scan-publication-leaks.sh`); exit 1 means no commit until the listed
  lines are rewritten.

- **Where a file lives decides who reads it.** Public (`docs/`, `README.md`, `CLAUDE.md`, commit bodies) carries
  no machine path and no identity string. The developer wiki is `local_dev/`. Private scratch is a git-ignored
  `local_user_files/` — outside git, but still on disk and in every backup, so never a secret there either.

<!-- END managed: documentation-style -->
