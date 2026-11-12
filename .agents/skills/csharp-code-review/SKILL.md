---
name: csharp-code-review
description: Review C# code changes for quality, patterns, and prototype-k conventions
---

# csharp-code-review

Review C# code for quality, patterns, and prototype-k conventions.

## Input

- File paths or git diff (space-separated `.cs` files, diff output)
- Directory: scans modified `.cs` files
- No args: uses staged files

## Output

Structured review: Strengths / Issues / Suggestions / Conventions (with file:line).

## Constructor DI

Report as Issues: a static helper or class that takes services or `Func` lookups as parameters, a service locator (`IServiceProvider`/`GetService` outside the composition root), and business code that does `new` on its collaborators. Dependencies come through constructors and are registered in DI. Pure functions without dependencies may stay static.

## Conventions

See `~/.agents/reference/code_review_csharp_conventions.md` for:
- Naming (IDE0049: capitalized types)
- Async methods (no suffix)
- Using order (System first, no separators)
- Test framework (xUnit, FakeItEasy, never Moq). Assertions: built-in for new tests
- Clean Architecture (layer separation)
- Anti-patterns (Moq, FA >=8.0, empty try-catch, emojis, secrets)
