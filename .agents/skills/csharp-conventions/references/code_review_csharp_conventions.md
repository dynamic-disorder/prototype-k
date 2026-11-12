# C# Code Review Conventions

prototype-k-specific C# standards for `csharp-code-reviewer`.

## Style

- **Built-in type names** (IDE0049): `String.IsNullOrEmpty(value)`, `Int32.Parse(input)`, not the `string`/`int` aliases.
- **No `Async` suffix**: `public async Task GetUser(int id)`.
- **Usings** (IDE0055 / SonarQube): `System.*` first, then the rest sorted alphabetically, no blank line between groups, outside the namespace. The pre-commit hook enforces it.

## Tests

- xUnit + FakeItEasy, Given/When/Then with a `sut` variable, `[TestOf]` on the test class.
- Built-in assertions in new tests.
- Scenario-specific helpers, not generic helpers with 10+ parameters.

## Architecture

- Layers: Domain / ApplicationCore / Infrastructure, dependencies point one way, no infrastructure code in Domain.

## Must fix

- Moq (banned; use FakeItEasy)
- Empty `try`/`catch` blocks
- Emojis in source code
- Hard-coded secrets or connection strings
