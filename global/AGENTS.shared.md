<!-- BEGIN managed: shared-agent-notes -->
<!-- Installed by global/install.mjs. Do not edit here:
     edit global/AGENTS.shared.md and re-run the installer on each machine. -->

## Shared agent rules

Binding for every project on every machine. Anything platform-specific belongs in the machine notes
outside this block.

### Project history lives with its project

- The snaerf CI rehearsal record sits at `local_dev/phonebot-ci-history.md` in that checkout, not here.

### Recap and status before sending a change report

Binding, learned on 2026-10-31 the hard way: the mode-1 order is not decoration. A report that skips it reads as
an incident log, and the reader has to reconstruct what they asked for and whether it is finished.

- Before sending, check the answer carries **status in one word → what changed → documentation → done vs next →
  open issues → verification numbers**, in that order. Fix the order, not the prose.
- The **last line is the explicit next action**, naming what it touches and who acts. Omitting it is the same
  failure as the banned closing formula "say the word".
- A finished request still states it is finished. Never leave the reader to infer status from a list of results.

### Numbers that go stale

Binding, learned on 2026-11-01: a document that stated how many tests the suite held was wrong within a week, and
keeping it right cost an edit per commit while telling the reader nothing they could act on.

- **No document records how many tests exist** — not a total, not a per-project count, not "45 opt-in tests", and
  not in a Mermaid label or a table column. Write what the command proves ("the suite is green", "the opt-in
  simulations are skipped unless asked"), and let the test command be the number.
- **A dated record may say what a run reported that day** — "384/384 green on 2026-10-31" is history and stays. The
  line is between *this is what happened* and *this is what it is now*: only the second kind rots.
- **The same goes for anything else that changes without anyone deciding it should**: file counts, line counts,
  version totals, "N of M phases" arithmetic. Measurements with a date are evidence; measurements without one are
  cargo.
- **When a number must appear, it appears as a measurement of a stated run** — model, warm or cold, date — so a
  reader can attribute it instead of trusting it.

### How to ask a human to run a measurement

Binding, learned on 2026-10-31: an instruction to "paste a ~150-word paragraph and ask X" produced a run whose
inputs nobody could reproduce, so the numbers proved nothing about the questions that were actually asked.

- **Hand over every input literally**, in full, in one block the reader can copy — the exact question text, the
  exact paragraph, the exact commands. A placeholder ("~150 words", "a long question") makes the run
  unreproducible and the comparison meaningless.
- **Say what each input is testing**, one line beside it, so a surprising number can be attributed afterwards.
- **State the variables held constant** (model, warm or cold, session boundaries) and the ones that will drift
  (conversation history, answer length).
- **Prefer a file over a chat message** when the protocol will be repeated: put the inputs and the predicted
  bands in the repository so a later session runs the identical thing.

### Hand-offs: one labelled block of commands

Binding, adopted 2026-11-13 from the generic export. When you ask a person to run a command, the block is
the deliverable.

- **One fenced block, labelled above it** with the shell it is for (`**You, run this in Git Bash:**`).
- **The first line is a `cd`** to the exact folder, every time.
- **Commands only inside the fence** — no prose and no `Check:` line. Put the expected output after the
  fence, separated by a blank line, or a paste sends prose to the shell.
- **Literal paths and branch names**, no `<placeholders>`. The project root variable counts as literal when
  the person has it set; say which one.
- **End a push with its verification**: `git ls-remote <remote> <branch>`, then report the remote's hash. A
  push not confirmed that way is not reported as done. Never force-push, never push to `main`.

### Follow-ups are a numbered list, never a closing sentence

Binding, learned on 2026-11-03 the hard way: a report ended with "two small follow-ups, both uncommitted ideas
rather than work in flight", and the reader could not tell what each item touched, what it bought, or who was
expected to act. The reader then had to say so, which cost more than the two written lines would have.

- **Residual work is a numbered list, one item per line**: what changes (the file), what it buys, who acts, and
  what the reader must decide. Numbers let the answer be "do 2" instead of a paragraph.
- **Each item ends with the literal reply that acts on it** — "reply `do 2`" — learned on 2026-11-03 the hard way:
  a follow-up closed with "say the word if you want it mirrored", and the reader answered "you said 'say the word'
  and I still do not know what the word is". The banned closing formula and its replacement are the same rule seen
  from two sides: never make the reader guess the words that stop the guessing.
- **Never fold follow-ups into the closing sentence.** The closing sentence carries exactly one next action.
- **Never offer a pseudo-choice** — "stop here, or…" — when one option is plainly better. Name the recommended
  one, and say what the other costs.
- **Say which fence each item is on**: already owed (a defect, a dropped branch, lost evidence) or optional
  polish. Mixed together, the reader has to re-derive the priority that the author already knew.
- **An open that only another machine or the owner can close lives in the project's private scratch list**, not
  in a ledger file in the tracked tree — `local_user_files/TODOS.md` here, learned on 2026-11-03 when a
  cross-machine note file was written into `local_dev/` and the owner could not find the place it belonged.
  Private scratch sits in the shared tree, so both machines read it at one path while a clone never carries it;
  name the file in the reply, because nothing else points at it.

### A next phase or milestone is handed over as a prompt, not a recollection

Binding, adopted on 2026-11-03: a phase that is next used to be left for the next session to reconstruct from
status tables and a plan, and the reconstruction is where commands, literal inputs and the half a person still
owed went missing.

- **Write the prompt when the phase closes**, and name its file in the reply that hands over. A finished phase
  that ends "the next work is X" hands over a task; one that ends with a file hands over a session.
- **One file, `local_dev/plans/<date>_<phase>-handoff.md`**, with the prompt between two paste markers so the
  next session can be started with it unchanged. It stands alone: the read order, the state it inherits (done
  and open), the exact commands with their literal inputs, what to record, the fences, how the phase closes,
  and the commit rule.
- **Literal inputs only** — the question asked, the sentence spoken, the settings file, the flags. This is the
  "How to ask a human to run a measurement" rule applied to a whole phase: a placeholder hands over a run
  nobody can reproduce.
- **Say who acts at each step.** Most remaining work is split — the agent runs commands and records output, a
  person listens, looks or buys — and a step that waits on a human must say so, so the session does not fill
  the gap with a claim it cannot check.
- **What is done is not relitigated.** The prompt states what was proven and when; the next session's job is
  the open item, not a re-review of the last one.

### The same projects, seen from several shells

- **One tree, two machines.** The checkout lives on the shared data disk, so both machines read and write
  **one tree**, each through its own mount of it. Nothing in the tree is copied between machines.
- **Name the tree with `DYNAMIC_DISORDER_ROOT`, never a literal path.** In bash: `$DYNAMIC_DISORDER_ROOT`. It is
  spelled with underscores because bash rejects a hyphenated variable name. Never hard-code a drive letter,
  mount root or home path in a note, a doc or a commit.
- **The asymmetry is home, not the tree.** Harness globals live in `$HOME` and are per user and per machine:
  the file this block is installed into is one of two independent copies, and each harness reads only the copy
  in the running machine's home. The installer runs once per machine regardless.
- **Past DSH sessions are zstd-compressed** (`~/.dsh/sessions/*/session.jsonl.zstd`, one frame per message) and
  cannot be grepped as text; decompress frame by frame (node 25 `zlib.zstdDecompressSync`) to search history.

### Commits: draft, approve, then push what was approved

Binding, learned on 2026-11-01: a session that commits whenever it feels finished turns the developer's
review into an archaeology exercise, and one that never commits leaves a working tree nobody can bisect.

- **A logical set of changes earns a drafted commit message, not a commit.** The moment a coherent unit of
  work is done — one feature, one fix, one doc pass — write the draft in the reply: the subject line, the
  body, and the files it will contain. Ask for approval. Wait for it.
- **List the files under the message, grouped the way the tree holds them.** Say how many files the commit
  carries, then one bullet per folder with that folder's files inside it when it holds more than one; a folder
  with a single file is a single line with its relative path. Mark `(new)` and `(deleted)`. Paths are relative
  to the repository root, never absolute — a commit is public text.
- **The list has this shape** (learned on review, 2026-11-01 — a prose blob of paths made the reader work to
  see *where* a change landed):

  ```
  37 files:
  - `src/snaerf.Services/Piper/`: `PiperVoice.cs`, `PiperVoiceCatalog.cs` (new), `PiperSpeech.cs`,
    `PiperTtsService.cs`, `PiperVoices.cs` (deleted)
  - `src/snaerf.Services/Settings/`: `SnaerfSettings.cs`, `SnaerfSettingsFile.cs`
  - `src/snaerf.Tui/Voice/`: `VoiceChatLoop.cs`, `VoiceChatOneShot.cs`, `VoiceChatOptions.cs`
  - `tests/snaerf.TestSupport/`: `TestVoices.cs` (new)
  - `snaerf.settings.json`
  ```

  When a batch is split into several commits, each draft carries its own list, and a file that lands in two
  commits says which part each takes ("`CLAUDE.md` — the flag list; the JSON bullet is commit 2").
- **Commit only what was approved**, in the order approved, then report the resulting hashes.
- **Push what was approved, then stop.** A reviewed and approved commit — or the short, named batch the
  approval names — may be pushed by the session itself to the remote, so a single approved commit needs no
  second round trip to reach `origin`. Report the pushed hashes and the remote branch. Never push unapproved
  work, never force-push or rewrite a pushed commit, and never push on your own initiative: a green build or
  a finished task is not permission, and neither is approval of a different commit.
- **Before any commit**, check for machine-specific paths and identities in what is staged; a commit message
  and the files in it are public text.
- **Another session may be editing the same tree.** Stage the paths you changed by name, never `git add -A` or
  `git commit -a`: a working tree holding someone else's modified files is normal, and those files are neither
  yours to commit nor yours to revert. Name the strays you left alone when reporting the commit. Two further
  hazards, both seen on 2026-11-03: the other session may have files **already staged** in the shared index, so
  commit with `git commit -F <msg> -- <path>` (by path) after `git restore --staged <your path>`, or their work
  rides along; and because both sessions share one checkout and one `main` ref, **their push carries your
  commit** — `git push` then answers "Everything up-to-date" about a commit you never pushed. Confirm with
  `git ls-remote origin main` and report who actually pushed, instead of claiming it.
- A direct instruction to commit overrides the draft step for that batch, and only for that batch: it carries
  the push with it, under the same limits.

### Credentials: never read the credential file

Binding, learned on 2026-11-01 the hard way: a session that checked "can two machines share `$DSH_HOME`?"
opened the credentials document to judge the risk, and printed live API keys into the transcript.

- **Never read, cat, print, grep for values in, hash, or copy the credential file** — on Windows
  `%USERPROFILE%\.dsh\.credentials.yaml`, on Linux and macOS `~/.dsh/.credentials.yaml`. The rule covers any
  file holding a secret; these two are the ones that exist. `Test-Path` (existence only) is fine.
- **Why it matters more than it looks:** shell and file tools run as the same user, so nothing blocks the
  read; the harness only keeps the path out of the model's hands, and a model that goes looking finds it.
  A read costs a rotation at the provider, not just an apology.
- **Do the job another way.** To learn which providers exist, read the non-secret `settings.yaml`
  (`apiKeyEnv`, provider ids, model ids). To change a credential, tell the owner which one and let them run
  the harness's own credential command. Never echo a secret, not even a fragment, and never re-print a
  match while scanning for one — report match counts and file lists only.
- If it is already exposed: say so flat, name the file and every place the text landed (tool output,
  session log), and ask the owner to revoke and reissue the key. Do not leave it to be discovered.

### Your own notes are not the credential store

- This file may name where a credential lives and how to change it, and nothing else. Never paste a key, a
  token or a password into these notes, a doc, a commit or a chat message — not even one the owner pasted
  first.

### Untrusted repositories and install safety

Binding, adopted 2026-11-13 from the generic export. Treat a new repository as untrusted until reviewed.

- `.agents/`, `AGENTS.md`, `.cursor/`, `.vscode/`, MCP configs, shell startup files, CI workflows and git
  hooks are executable content: read them before acting on them.
- Before any install, build or setup on unfamiliar code (`npm`/`pnpm`/`pip`/`uv` install, `make`, a
  bootstrap script), inspect the install hooks (`preinstall`/`postinstall`/`prepare`), any `*.pth` file that
  executes code, and anything that pipes network content into a shell or downloads a runtime.
- Default flow: review, explain the risk, get approval, then execute.
- Never expose a credential, token, key or `.env` file, and never print one.

### Large inputs cost more than they return

- Never read a raw `.pdf`, `.docx` or `.pptx` to answer a question. Use a page-marked Markdown version if
  the repository holds one, or convert first (`markitdown <file>`, or `docling` for complex layouts).
- Read an image only when the answer needs what it shows. Check the size first: a file over ~500 KB, a PDF
  over ~20 pages, or an image over ~2 MB gets a conversion or an extraction step before a read.

### File naming in the agents tree

Binding, adopted 2026-11-13 from the generic export. Every name starts with its context, so a folder sorts
by subject and the owner is obvious.

- **Docs and data** (`.md`, `.txt`, `.json`, `.yml`): `<context>_<topic>.<ext>`, snake_case, ASCII, no spaces.
- **A README beside a script or library**: `<context>.README.md`. Skill folders keep `README.md` and
  `SKILL.md`.
- **Scripts** (`.sh`, `.mjs`, `.js`, `.py`, `.ps1`): kebab-case `<domain>-<object>-<action>`. A script that
  serves one skill reuses the skill's name exactly.
- **Skills and command folders**: kebab-case `<domain>-<object>-<action>`.
- **Hooks**: `<event>-<action>-<object>.sh`. **Libraries**: `<topic>.sh` with a sibling `<topic>.md`.
- **Names fixed by a tool** are never renamed to fit the rule: `AGENTS.md`, `SKILL.md`, `settings.json`.
- **Renaming**: grep the whole tree for the old name first, update every hit, then run `bash -n` or
  `node --check` on the renamed scripts and confirm every path that names them still exists. A name that
  predates the rule is renamed only when the file is touched for another reason.
- **A case-only rename takes two steps.** On Windows and macOS the filesystem ignores case, so `git mv`
  followed by a commit that names the path can leave both spellings in the tree, and a clone then creates
  a second copy. Rename through a temporary name — `git mv A tmp && git mv tmp b` — then confirm
  `git ls-files` and `git ls-tree HEAD` list only the new spelling before committing.

### Writing a skill: the SKILL.md and README.md structure

Binding, adopted on 2026-11-10: the owner wrote two prompts at the root of the umbrella
(`SKILL.md Preferred Structure and Style Prompt.md`, `SKILL README.md Writing Style Prompt.md`).
They are the spec for every skill authored in this tree. Read the originals when a skill is large or
a case below does not settle; the rules here are the binding summary.

**`SKILL.md` — frontmatter.**
- `name`: 1–5 words, at most 64 characters, lowercase `a–z`, `0–9` and hyphens only, never starting
  or ending with a hyphen (`deck-card-video-generate`).
- `description`: under 1024 characters, carrying both **what the skill does** and the **exact trigger
  phrases** that select it. Write it slightly proactively; under-triggering is the failure mode.

**`SKILL.md` — body, this order and no other.** H1 title matching `name`; Executive Summary in one or
two sentences; When to Use as trigger scenarios plus the anti-patterns and out-of-scope tasks; Prerequisites
& Setup as an explicit table — runtime version, every package, engine and language pack, the command that
proves each, the override variable, and what the run records when one is missing (required stops, optional
skips); Functional Requirements as the explicit contract —
accepted inputs and refusals, required outputs, a requirement → check → failure table of what must be
preserved, the escape hatch, and the tolerated losses and limits, each one testable; Execution Workflow as
a numbered protocol; Error-Handling Playbook as a table of error or exit code → the correction the agent
takes alone; Verification & Outputs with concrete numbers, exit criteria, tolerances and the files expected.

**`SKILL.md` — engineering rules.**
- Imperative voice: "Run the guard", not "the guard should be run".
- **Node.js first.** `node scripts/*.mjs` over bash-only steps: one path that runs on Linux and macOS, and
  that `npm test` can exercise locally.
- Low freedom for fragile operations — exact command, exact flags. Medium or high freedom only where the
  step is conceptual planning.
- One default plus an escape hatch (`--seconds <n>` with a sensible fallback). Never a menu of options.
- **Name every loss.** A transforming skill states what it cannot preserve — structure, glyphs, precision,
  ordering, embedded assets — how a run detects the loss, and what it would take to recover it. Silent loss
  is a defect, so a requirement nobody can fail is not a requirement.
- Every instruction testable: a runnable validation command and the exit behaviour it must show.
- Body under 500 lines. No preamble, no boilerplate, no filler.

**`README.md` — structure.** H1 skill name; a 2–3 sentence executive summary of what the skill produces
and how; a Problem / Why / What / Verification table; **Import for AI** install block for Linux/macOS;
Agent Execution Rules as the bullet invariants (how folders are copied, the configuration fallback, what is
never committed); Tests with the unit and end-to-end commands; a Files Index mapping `SKILL.md`,
`scripts/`, `lib/` and `tests/` to what each holds.

**Both files.** High density and scannable — tables, bold key terms, bullets, no dense paragraph. No
conversational fluff, no marketing, no pleasantries. Boundaries are stated as strict invariants in their
own line ("Keep task data outside the skill folder", "Never commit `node_modules/` or `test-results/`"),
not implied in prose.

### Chat messages: short sentences, bullets for lists, paragraphs past four lines

Binding, adopted on 2026-11-10 at the owner's request, after a WhatsApp handover note ran long.

- **Short sentences, one idea each.** Split a sentence that carries two.
- **Two or more items become a bullet list**, one item per line, nothing buried in a paragraph.
- **More than four lines becomes paragraphs**, separated by one blank line. Never send a wall of text.

<!-- END managed: shared-agent-notes -->
