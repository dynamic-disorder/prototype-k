---
name: git-pr-squash-message-write
description: Generate squash & merge commit messages for git history (imperative, outcome-focused, 1 title + short body)
---

# git-pr-squash-message-write

Generates squash & merge commit messages that read well in `git log` - what changed and why, not every step.

## Input

- Branch name: `feature/ABC-1234-feature-description`
- PR URL: `https://github.com/$REPO/pull/123`
- No argument: Uses current git branch

## Output Format

**Title**: `[ABC-XXXXX ]<Imperative summary>` (50-72 chars, no period)  
**Body**: 1-3 bullets explaining why it's better or what it enables

```
ABC-1234 Add user search with fuzzy matching

- Enables finding users by partial name or email
- Reduces search time from ~2min to ~5sec
```

## Workflow

1. **Get context**: run the shared PR-context script with the PR URL or number from `<input>` (no argument = PR of the current branch). Never infer the PR from the current branch when an argument was given.

```bash
node "$HOME/.agents/skills/git-pr-description-write/extract-pr-context.mjs" "<input>"
```

   - Output is JSON: `number`, `title`, `headRefName`, `ticketKey`, `commits`, `changedFiles`, `currentDescription`.
   - If the JSON has an `error` key, report it and stop. Do not fall back to local git.
   - Confirm the returned `number` matches the requested PR before writing.
2. **ticket**: use `ticketKey` from the JSON.
4. **Analyze**: determine change type (Add/Fix/Update/Refactor/Remove) from `commits`, `changedFiles`, and `currentDescription`
5. **Generate title**: `[TICKET-ID ]<Type> <what changed>` - imperative, specific, <72 chars
6. **Generate body**: 1-3 bullets on benefits, behavior changes, or notable risks
7. **Output**: print only the message in one code block, no "Why this message" commentary

## Title Patterns

- Feature: `Add <what>`
- Bug: `Fix <problem>`
- Enhancement: `Update <what>`
- Cleanup: `Refactor <what>`
- Removal: `Remove <what>`

## Body Content Guidelines

Include bullets for:
- **Benefits**: "Improves X by Y%", "Reduces failures", "Enables Z"
- **Behavior changes**: What users/devs will notice
- **Technical notes**: Database migrations, config changes, breaking changes
- **Follow-ups**: Known limitations or future work

Skip the body only if the change is truly trivial.

## Examples & Guidelines

See `~/.agents/reference/git_squash_message_examples.md` for example messages and extended patterns.

## Configuration

- `SQUASH_MSG_MINIMAL=1` - Use minimal format (title + 1 bullet)
- `SQUASH_MSG_TICKET=0` - Skip ticket fetch

## Format

- Use plain hyphens (`-`) for punctuation, never em dashes (Unicode U+2014) or other non-hyphen dash variants, anywhere in the generated title or body
