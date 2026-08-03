# GitHub Copilot — Assistant Instructions for this repository

## Purpose
- Provide general, workspace-wide behavior for GitHub Copilot suggestions.
- Ensure suggestions are concise, actionable, and aligned with the repository's style and conventions.

## General guidelines
- Tone: concise and direct.
  - Do not apologize or use filler phrases or such as like "Let me ..." but be direct and clear.
- Do not introduce secrets, hardcoded credentials, or copyrighted text verbatim.
- When unsure, ask a clarifying question rather than guessing.

## When producing code changes
- Keep diffs minimal and focused. Include tests and documentation when appropriate.
- Follow the repository's existing formatting and styling conventions.

## Cross-reference
- Subfolder custom instructions are complementary to these root instructions and apply when a subfolder needs project-specific behavior or overrides.
- Always apply the root rules unless a subfolder file explicitly specifies an override for that area.

## Maintainer contact
- If a suggestion touches deployment, security, or CI, request review from the repository owner before merging.

## Additional/override guidelines
- Focus on containerization best practices: small images, minimal layers, explicit versions for base images.
- Keep `docker-compose` and Kubernetes manifests declarative and idempotent.
- For shell scripts and Dockerfiles, prefer POSIX-compatible patterns where feasible and document platform specifics (Windows vs Linux).
- When modifying `README.md` or deployment docs, include exact commands to reproduce local setups and any environment prerequisites.

## General repository rules
- Be concise: give minimal, actionable suggestions.
- Prefer small, focused edits that follow the repo style.
- Always present a 1-line preamble before automated actions or tool calls.
- When unsure about intent, environment, or committing changes: ask the author.

## Development cycle (organizes how to apply the rules)
- Planning: define scope, list tasks, and create a `manage_todo_list` entry before edits.
- Implementation: prefer small patches; use `apply_patch` for edits and `create_file` for new files.
- Testing: run tests or linters only when requested.

## Local development and user files
- Put shareable local helpers, analyses, tooling, scripts, and documentation in `local_dev/` (not git-ignored)
- Keep ephemeral or user-specific files in `local_user_files/` (git-ignored)
- These folders exist at repository root; use them for appropriate content
- Note: Some project builds require the .NET 9 SDK or .NET 9 targeting pack, especially Windows-specific `net9.0-windows10.0.19041.0` apps such as `TextToSpeechApp`.

### GIT commit
	- Commit message style: imperative, <=50-char subject, body wrapped at 72 chars explaining the rationale.
  - Do not GIT commit automatically, unless explicitly asked. Always ask for confirmation before committing. Preferably, propose the commit message and ask for confirmation before committing.

## C# and scripting conventions
- Prioritize readability, maintainability, and existing repository style.
- Prefer small, well-named functions and clear separation of concerns.
- The AUTHORITATIVE C#/test conventions live in `.claude/rules/csharp-conventions.md` and `.claude/rules/test-conventions.md`. Apply those. Critical one-liners that must never be dropped:
  - File-scoped namespaces: `namespace My.Project.Sub;`
  - Add XML docs (`/// <summary>`) for new or modified public/internal types and methods.
  - Use braces even for one-line `if`/`return` blocks for clarity.
  - Private fields: use a leading underscore (`_myField`).
  - Expression-bodied members are DISABLED — use block bodies.
  - No `this.` qualifier; use `is null` / `is not null` instead of `== null` / `!= null`.
  - Testing: xUnit + Shouldly, NSubstitute for mocking, NEVER Moq (SponsorLink dependency).
  - Test names: `SubjectUnderTestOrMethodName_StateOrCondition_ExpectedOutcomeOrBehaviour`.
  - Test body uses `// Given:`, `// When:`, `// Then:` blocks.
- Refer to `clean_code_general_instructions.md` for detailed style and design guidelines.
- Do not use emojis in scripts or code as they may introduce run-time failures or errors.
- Do not use non-ASCII characters in code, scripts, or file names to avoid compatibility issues across different platforms and tools.
- Match the language of the target file: e.g., C# for .cs, Python for .py, YAML for compose/k8s manifests.
- Use UTF-8 encoding (for .csv files, use UTF-8 with BOM for MS Excel compatibility) and preserve line endings consistent with existing files.
- Add or update unit/integration tests when changing behavior.

## Tooling & security
- Planning: define scope, list tasks, and create a `manage_todo_list` entry for multi-step tasks before edits.
- Implementation: prefer small patches; use `apply_patch` for edits and `create_file` for new files.
- Provide copyable commands.

## Security
- Do not include secrets, credentials, or external network calls in patches or examples.

## Final note
- This file is the authoritative assistant guide for this repo. If anything is unclear, ask the repository maintainer before proceeding.

