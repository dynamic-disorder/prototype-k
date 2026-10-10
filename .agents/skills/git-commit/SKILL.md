---
name: git-commit
description: Stage, build-check and commit changes with a Conventional Commits message.
disable-model-invocation: true
---

# git-commit

Commit the paths named in the request, or whatever is already staged. If nothing is staged,
review `git status` and stage the files that belong to the same logical change; ask only when
the changes are genuinely unrelated.

## 1. Verify

If the change set contains `.cs` or `.csproj` files, run the `csharp-build-verify` skill first.
A failed build means no commit — show the errors and stop.

## 2. Message

```
type(scope): imperative subject

Optional body: why the change was made, wrapped at 72 characters.
```

- **type** — `feat`, `fix`, `docs`, `refactor`, `test` or `chore`.
- **scope** — the project or area (`FilenameTools`, `CsvTranslations`, `build`); omit it when the
  change spans the repo.
- **subject** — imperative ("Add", not "Added"), under 50 characters, no trailing period, and
  specific: never "update", "various improvements" or "misc fixes".

```
fix(FilenameTools): keep the extension when sanitizing a name
docs: describe the publish script in the README
```

## 3. Commit

`git commit -m ...`, using a heredoc when there is a body. Never amend, never pass `--no-verify`.
Report the subject line that was committed.
