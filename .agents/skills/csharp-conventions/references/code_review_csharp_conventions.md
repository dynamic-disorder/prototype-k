# C# Code Review Conventions

prototype-k-specific C# standards for `csharp-code-reviewer`.

## Style

- **Built-in type names** (IDE0049): `String.IsNullOrEmpty(value)`, `Int32.Parse(input)`, not the `string`/`int` aliases.
- **No `Async` suffix**: `public async Task GetUser(int id)`.
- **Usings** (IDE0055 / SonarQube): `System.*` first, then the rest sorted alphabetically, no blank line between groups, outside the namespace. The pre-commit hook enforces it.
- **Modern C# & functional style**: when possible, adopt the latest C# version features and apply functional programming techniques (pure functions, immutability, side-effect-free idempotent transformations). Do not obsess over FP dogma or sacrifice readability/efficiency. Highlight opportunities to modernize or apply functional paradigms when reviewing code.

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
