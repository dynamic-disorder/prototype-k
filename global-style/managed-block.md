<!-- BEGIN managed: documentation-style -->
<!-- Installed by global-style/install.ps1 or global-style/install.sh. Do not edit here:
     edit global-style/documentation-style.md and re-run the installer. -->

## Output Style — Three Modes, One Voice

Binding for every chat answer, document, report, README, CLAUDE.md, docs page and commit-message body.
Full rules and examples: `global-style/documentation-style.md`.

Goal: fast comprehension for busy readers with mixed technical backgrounds. Pick the mode from the
artifact, not from habit — **1** for an answer in this session (the default), **2** for a file you write,
**3** for text another person will read.

Always, in every mode: outcomes before mechanism · plain words, short sentences, no filler · the number
behind every pass/fail claim · bad news flat, no cushioning · residual work named with who acts next (me,
you, or both) · never echo a secret or credential, not even partially — name where it lives (documented
fakes, placeholders and `example.com` values are fine) · never re-show material that did not change.

**1 — Direct answer and execution recap (default).** Minimalist and uncluttered: the outcome and its
rationale, not the mechanism; essential context only, because the reader can ask to drill down. A brief
summary first, then short sections. Prose carries reasoning; bullets only for a list. Budget: a direct
answer ≤ 8 lines, a change report ≤ 20. After doing work, recap in this order: what changed → done vs next
→ open issues → the verification numbers.

**2 — Document.** Every file written: README, docs page, ADR, plan, analysis, release note, commit body.
Audience: mixed technical backgrounds and limited time. Complex or multi-part — open with exactly this
table.

```
| | |
| :--- | :--- |
| **Problem** | What is the issue? One sentence. |
| **Value** | Why does it matter? |
| **Change** | What is being modified or decided? |
| **Verify** | How is success confirmed? |
| **Top risk** | The main thing that can go wrong. Omit only if genuinely none. |
```

Single topic — open with `**TL;DR** — ` and one sentence instead. Then flow **Problem → Value → Change →
Verify** in descending importance, never chronology. Sections ≤ ~15 lines, bullets for lists, a table when
comparing three or more things, at most two nesting levels, a command only where the reader must act (folder
named, CLI labelled on the line above the block), and an ownership line when work stays open. A commit body
is a document in one paragraph: what and why, then how it was verified — never a file-by-file diary.

**3 — Message.** Text that leaves the session: an email, a chat message, a PR comment, a release note. The
simplest register available. Short sentences. One blank line between paragraphs — a double linefeed, never
three. The ask sits in the first paragraph, one ask per message, no preamble and no sign-off.

- **Never in a commit.** Every commit is public text. No drive-letter prefixes or mount roots, no home or
  profile paths, no account, user, owner or host name, no employer or ticket identifiers — not in a file, a
  doc, a config or a commit message, and not partially masked either. Write `%USERPROFILE%\…` on Windows and
  `~/…` on Linux and macOS, or the project's root variable. Run the project's publication gate before
  committing (here: `local_dev/scripts/scan-publication-leaks.sh`); exit 1 means no commit until the listed
  lines are rewritten.

<!-- END managed: documentation-style -->
