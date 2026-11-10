# Understanding `.mjs` Files

A `.mjs` file is a JavaScript **ECMAScript Module (ESM)** file.

ES Modules were introduced in **ES6 (ECMAScript 2015)** and use the `import` and `export` keywords to share code between files.

Unlike **CommonJS**, which is primarily used in server-side environments, **ES Modules** can be used in both modern browsers and server-side environments that support them.

The `.mjs` extension makes it clear that the file uses the ES Module format, helping distinguish it from CommonJS files and making module handling more consistent and predictable.

## Why Use `.mjs`?

- Clearly identifies a file as an ES Module.
- Supports modern JavaScript features such as:
  - `import` / `export`
  - Top-level `await`
  - Tree-shaking
  - Better static analysis
- Reduces ambiguity between ES Modules and CommonJS modules.
- Works consistently across modern JavaScript runtimes.

## `.mjs` vs `.js`

- `.mjs` is always treated as an ES Module in Node.js.
- `.js` can be interpreted as either CommonJS or ES Module depending on the project's `package.json` configuration.
- `.mjs` provides explicit module semantics without relying on external configuration.

## TypeScript Support

TypeScript provides `.mts` as the ES Module equivalent for TypeScript source files. These files are typically compiled to `.mjs`.

Recommended `tsconfig.json` settings:

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

This configuration ensures TypeScript correctly resolves and emits ES Modules.

## Example

### utils.mjs

```js
export function greet(name) {
  return `Hello, ${name}!`;
}
```

### main.mjs

```js
import { greet } from './utils.mjs';

console.log(greet('World'));
```

## Why `.mjs` is Recommended for Agentic Skills

For agentic skills, automation frameworks, and AI-powered workflows, `.mjs` is often preferred because it encourages a modular architecture.

Well-structured ES Modules can be:

- Imported and reused across skills.
- Mocked during testing.
- Unit tested independently.
- Packaged as shared libraries.
- Composed into larger workflows.

> Note: The `.mjs` extension itself does not make code testable. Testability comes from good software design and modularization. ES Modules naturally support these practices through explicit imports and exports.

### Cross-Platform Benefits

Compared to PowerShell (`.ps1`) and Bash (`.sh`) scripts, `.mjs` files are generally more portable across operating systems.

The same `.mjs` code can run on:

- Windows
- Linux
- macOS

as long as a compatible Node.js runtime is available.

This reduces:

- Platform-specific scripting differences.
- Shell compatibility issues.
- Operating system dependencies.

As a result, `.mjs` is often a good choice for implementing agent logic, workflow orchestration, and reusable business logic that must run consistently across environments.

## When to Use PowerShell or Bash Instead

PowerShell and Bash are still the better choice for tasks that are tightly coupled to the operating system, such as:

- System administration.
- OS configuration.
- Service management.
- User and permission management.
- Shell-native automation.
- Operating system provisioning.

Use the right tool for the task rather than treating `.mjs` as a universal replacement.

## Recommended Usage

| Scenario | Recommended Technology |
|-----------|----------------------|
| Cross-platform agent logic | `.mjs` |
| Reusable libraries | `.mjs` |
| Unit-tested business logic | `.mjs` |
| AI agent skills | `.mjs` |
| Workflow orchestration | `.mjs` |
| Windows administration | PowerShell |
| Linux/macOS administration | Bash |
| Shell-native automation | PowerShell / Bash |

## Related Extensions

| Extension | Purpose |
|------------|---------|
| `.mjs` | JavaScript ES Module |
| `.cjs` | JavaScript CommonJS Module |
| `.mts` | TypeScript ES Module |
| `.cts` | TypeScript CommonJS Module |

## Summary

`.mjs` is the explicit file extension for JavaScript ES Modules. It provides a clear, standardized module format that works across modern JavaScript runtimes.

For agentic skills and automation workflows, `.mjs` is generally preferred for reusable, testable, and cross-platform logic. PowerShell and Bash remain valuable for operating system and shell-specific automation tasks.
