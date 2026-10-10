# The Complete .claude Directory Guide for Claude Code
URL: https://computingforgeeks.com/claude-code-dot-claude-directory-guide/
Downloaded: 2026-03-29

[Josphat Mutai](https://computingforgeeks.com/author/mutai-josphat/) Updated Mar 24, 2026 · 14 min read

Every Claude Code project has a `.claude` directory. Most people ignore it. That is a waste, because this one folder determines whether Claude remembers your coding standards, runs your workflows automatically, and stops asking you the same questions every session.

Original content from computingforgeeks.com - post 163917

This guide covers the full .claude directory structure: CLAUDE.md configuration, modular rules, custom slash commands, skills, subagents, permissions with settings.json, hooks, MCP servers, and the memory system. Each section includes working examples you can drop into your own projects. New to Claude Code? Start with our [Claude Code cheat sheet](https://computingforgeeks.com/claude-code-cheat-sheet/) first, then come back here.

## Two Directories, Not One

There are actually two `.claude` directories in play, not one. The first lives inside your project and the second lives in your home directory:

```
your-project/.claude/     # Team config - committed to git
~/.claude/                # Personal config - never committed
```

The **project-level** folder holds team configuration. You commit it to git. Everyone on the team gets the same rules, commands, and permission policies. The **user-level** `~/.claude/` folder holds your personal preferences, session history, and auto-memory that persists across all your projects.

Here is the complete structure of both directories:

```
your-project/
├── CLAUDE.md                      # Team instructions (committed)
├── CLAUDE.local.md                # Your personal overrides (gitignored)
└── .claude/
    ├── settings.json              # Permissions + config (committed)
    ├── settings.local.json        # Personal permission overrides (gitignored)
    ├── .mcp.json                  # MCP server configurations
    ├── rules/                     # Modular instruction files
    │   ├── code-style.md
    │   ├── testing.md
    │   └── api-conventions.md
    ├── commands/                  # Custom slash commands
    │   ├── review.md              # becomes /project:review
    │   └── fix-issue.md           # becomes /project:fix-issue
    ├── skills/                    # Auto-invoked workflows
    │   └── deploy/
    │       ├── SKILL.md
    │       └── deploy-config.md
    ├── agents/                    # Specialized subagent personas
    │   ├── code-reviewer.md
    │   └── security-auditor.md
    └── hooks/                     # Event-driven automation scripts
        └── validate-bash.sh

~/.claude/
├── CLAUDE.md                      # Global instructions (all projects)
├── settings.json                  # Global permissions
├── commands/                      # Personal commands (/user:cmd-name)
├── skills/                        # Personal skills
├── agents/                        # Personal agents
└── projects/                      # Session history + auto-memory
    └── project-hash/
        └── memory/
            └── MEMORY.md
```

For git, commit `.claude/settings.json`, `.claude/rules/`, `.claude/commands/`, `.claude/skills/`, and `.claude/agents/`. Add the personal and machine-local files to your `.gitignore`:

```
# .gitignore - Claude Code personal files
CLAUDE.local.md
.claude/settings.local.json
.claude/agent-memory-local/
```

The full specification for every file is in the [official Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code/settings). The rest of this guide focuses on practical usage with real examples.

## CLAUDE.md: The Foundation

CLAUDE.md is the most important file in the entire system. Claude Code loads it into the system prompt at the start of every session and follows it for the entire conversation. Whatever you write in CLAUDE.md, Claude will follow – build commands, architecture decisions, coding conventions, and project-specific gotchas.

### Loading Order and Priority

Claude Code loads instructions from multiple CLAUDE.md files and merges them. Higher priority wins when there is a conflict:

```
Priority (highest to lowest):
┌─────────────────────────────────────────────┐
│  CLAUDE.local.md (project root)             │  Highest - your personal overrides
│  ↑ loaded on top of                         │  gitignored, only you see this
├─────────────────────────────────────────────┤
│  CLAUDE.md (project root or .claude/)       │  Team instructions
│  ↑ loaded on top of                         │  committed to git
├─────────────────────────────────────────────┤
│  ~/.claude/CLAUDE.md                        │  Your global preferences
│  ↑ loaded on top of                         │  applies to all projects
├─────────────────────────────────────────────┤
│  Managed Policy (org-wide)                  │  Lowest - IT-deployed
│  cannot be overridden                       │  enforced on all users
└─────────────────────────────────────────────┘

All layers combine → Claude sees everything as one system prompt
```

The managed policy layer is deployed by IT administrators at the OS level (`/Library/Application Support/ClaudeCode/CLAUDE.md` on macOS, `/etc/claude-code/CLAUDE.md` on Linux). Most individual developers will not use this layer.

### What Belongs in CLAUDE.md

Keep CLAUDE.md under 200 lines. Files longer than that eat too much context and Claude’s instruction adherence drops. Write the things Claude cannot figure out by reading your code:

**Include:** Build/test/lint commands, architecture decisions, non-obvious gotchas, import conventions, naming patterns, error handling styles, and file structure for main modules.

**Do not include:** Anything that belongs in a linter or formatter config, full documentation you can link to, or long paragraphs explaining theory.

Here is a real CLAUDE.md for a Node.js API project:

```
# Acme API

## Commands
npm run dev          # Start dev server (port 3000)
npm run test         # Run tests (Vitest)
npm run lint         # ESLint + Prettier
npm run build        # TypeScript compile
npm run db:migrate   # Run Prisma migrations
npm run db:seed      # Seed test data

## Architecture
- Express REST API on Node 22 with TypeScript
- PostgreSQL via Prisma ORM
- Handlers in src/handlers/, middleware in src/middleware/
- Shared types in src/types/
- Tests mirror src/ structure in tests/

## Conventions
- Validate all request bodies with zod schemas
- Return shape is always { data, error, meta }
- Never expose stack traces in responses
- Use the logger module (src/lib/logger.ts), not console.log
- All database queries go through Prisma, no raw SQL

## Important
- Tests hit a real local database, not mocks. Run `npm run db:test:reset` first
- Strict TypeScript: no unused imports, no any types
- Every handler needs integration tests covering happy path + error cases
```

That is roughly 25 lines. It gives Claude everything it needs to work productively without constant clarification.

### CLAUDE.local.md for Personal Overrides

Create `CLAUDE.local.md` in your project root for preferences specific to you, not the team. Claude reads it alongside CLAUDE.md but it is automatically gitignored. Use it for things like your preferred editor commands, debugging shortcuts, or personal workflow tweaks.

### Nested CLAUDE.md for Monorepos

In a monorepo, each package or service can have its own CLAUDE.md. These are lazy-loaded – Claude only reads them when it opens files in that directory:

```
monorepo/
├── CLAUDE.md                    # Root: shared conventions
├── packages/
│   ├── frontend/
│   │   └── CLAUDE.md            # React-specific rules
│   └── backend/
│       └── CLAUDE.md            # API-specific rules
└── services/
    └── auth/
        └── CLAUDE.md            # Auth service specifics
```

You can also reference other files using the `@` import syntax: `@./docs/architecture.md` or `@~/.claude/my-preferences.md`.

## The rules/ Directory: Scaling Instructions

Once your CLAUDE.md grows past 200 lines, split it into focused rule files inside `.claude/rules/`. Every markdown file in this directory loads automatically alongside CLAUDE.md. The advantage: different team members own different rule files without stepping on each other.

```
.claude/rules/
├── code-style.md          # Loaded every session
├── testing.md             # Loaded every session
├── api-conventions.md     # Loaded only for src/handlers/**
└── security.md            # Loaded every session
```

### Path-Scoped Rules

The real power of rules is path scoping. Add a YAML frontmatter block with `paths:` and the rule only activates when Claude is working with matching files:

```
---
paths:
  - "src/handlers/**/*.ts"
  - "src/middleware/**/*.ts"
---

# API Design Rules

- Every handler follows the pattern: validate -> execute -> respond
- Use zod schemas colocated with the handler file
- HTTP status codes: 200 (success), 201 (created), 400 (validation),
  401 (auth), 404 (not found), 500 (server error)
- Pagination uses cursor-based approach with { cursor, limit } params
```

Claude will not load this rule when editing a React component. It only loads when working inside `src/handlers/` or `src/middleware/`. Rules without a `paths:` field load unconditionally every session. This saves context window space by only loading relevant instructions.

## Custom Commands: Your Slash Commands

Every markdown file you drop into `.claude/commands/` becomes a custom slash command. The filename becomes the command name: `review.md` creates `/project:review`, and `fix-issue.md` creates `/project:fix-issue`.

Here is a practical code review command. Create `.claude/commands/review.md`:

```
---
description: Review the current branch diff for issues before merging
---

## Files Changed

!`git diff --name-only main...HEAD`

## Full Diff

!`git diff main...HEAD`

Review every changed file for:
1. Missing input validation on new endpoints
2. SQL injection or data exposure risks
3. Missing or incomplete test coverage
4. Performance issues (N+1 queries, missing indexes)
5. Error handling gaps

Give specific, actionable feedback per file. Flag blockers vs nice-to-haves.
```

The `!` backtick syntax is what makes commands powerful. It runs shell commands and injects the real output into the prompt before Claude sees it. When you type `/project:review`, Claude receives the actual git diff – not a placeholder.

### Passing Arguments to Commands

Use `$ARGUMENTS` to accept input after the command name. Here is a command that pulls a GitHub issue and fixes it:

```
---
description: Investigate and fix a GitHub issue
argument-hint: [issue-number]
---

## Issue Details

!`gh issue view $ARGUMENTS --json title,body,labels,comments`

## Related Code

Search the codebase for files related to this issue. Trace the bug to
its root cause. Fix it and write a test that would have caught it.
```

Running `/project:fix-issue 234` fetches issue #234 from GitHub and feeds it directly into the prompt. For personal commands that work across all projects, place them in `~/.claude/commands/` – they show up as `/user:command-name`.

## Skills: Auto-Invoked Workflows

Skills look similar to commands on the surface, but the trigger mechanism is fundamentally different:

```
Commands vs Skills:

┌─────────────────────────────┬─────────────────────────────────┐
│         Commands            │            Skills               │
├─────────────────────────────┼─────────────────────────────────┤
│ You trigger manually        │ Claude invokes automatically    │
│ /project:review             │ based on task description       │
│                             │                                 │
│ Always a single .md file    │ A folder with SKILL.md +        │
│                             │ supporting files                │
│                             │                                 │
│ Good for repeatable         │ Good for context-aware          │
│ manual workflows            │ automatic workflows             │
└─────────────────────────────┴─────────────────────────────────┘

Commands wait for you. Skills watch the conversation and act
when the moment is right.
```

Each skill lives in its own subdirectory with a `SKILL.md` file. Here is a deploy skill:

```
.claude/skills/deploy/
├── SKILL.md              # Required: main skill definition
├── deploy-config.md      # Supporting docs (referenced with @)
└── scripts/
    └── deploy.sh         # Executable scripts Claude can run
```

The SKILL.md uses YAML frontmatter to define when and how the skill runs:

```
---
name: deploy
description: Deploy the API to staging or production. Use when the user
  says "deploy", "ship it", "push to staging", or "release".
argument-hint: [staging|production]
allowed-tools: Read, Bash, Grep
---

## Pre-deploy Checks

Run these checks before deploying:

!`npm run lint`
!`npm run test`
!`npm run build`

If any check fails, stop and report the issue. Do not deploy broken code.

## Deploy

Target environment: $ARGUMENTS (default: staging)

Read the deployment configuration from @deploy-config.md and execute
the deployment steps for the target environment.
```

When you say “deploy to staging”, Claude reads the description, recognizes it matches, and invokes the skill automatically. You can also call it explicitly with `/deploy staging`.

Key SKILL.md frontmatter fields:

Field

Purpose

`name`

Skill identifier (lowercase, hyphens)

`description`

When to auto-invoke this skill

`allowed-tools`

Restrict which tools the skill can use

`argument-hint`

Show in autocomplete when typing /skill-name

`context: fork`

Run in an isolated subagent context

`model`

Override the model (sonnet, haiku, opus)

`user-invocable: false`

Only Claude can invoke, not the user

The `@` reference syntax (`@deploy-config.md`) pulls in supporting files that live alongside SKILL.md. This is the key difference from commands: skills are packages with multiple files, commands are single files.

## Custom Agents: Specialized Subagents

When a task benefits from a dedicated specialist, define a subagent persona in `.claude/agents/`. Each agent runs in its own isolated context window – it does its work, compresses the findings, and reports back without cluttering your main session.

```
How subagents work:

┌──────────────────────────────┐
│        Main Agent            │  Your conversation
│  (context filling up)        │
│                              │
│  "spawns subagent            │
│   with task"                 │
│         │                    │
└─────────┼────────────────────┘
          │
          ▼
┌──────────────────────────────┐
│  Subagent: code-reviewer     │  Fresh context window
│  ┌─────────────────────┐     │  Fully isolated
│  │ system prompt +     │     │
│  │ this task only      │     │
│  └─────────────────────┘     │
│                              │
│  Explores, reads, analyzes   │
│  All exploration stays here  │
│         │                    │
└─────────┼────────────────────┘
          │
          ▼ returns compressed findings
┌──────────────────────────────┐
│        Main Agent            │
│  Gets only the answer,       │
│  not the 10k tokens of       │
│  exploration                 │
└──────────────────────────────┘
```

Here is a code reviewer agent. Create `.claude/agents/code-reviewer.md`:

```
---
name: code-reviewer
description: Expert code reviewer. Use PROACTIVELY when reviewing PRs,
  checking implementations, or validating code before merging.
model: sonnet
tools: Read, Grep, Glob
---

You are a senior code reviewer focused on correctness and maintainability.

When reviewing code:
- Flag bugs and logic errors, not just style issues
- Suggest specific fixes with code, not vague improvements
- Check for edge cases: null values, empty arrays, concurrent access
- Note performance concerns only when they matter at scale
- Verify error handling covers all failure modes
- Check that new code has corresponding tests
```

The `tools` field restricts what the agent can do. A security auditor only needs `Read`, `Grep`, and `Glob` – it has no business writing files. The `model` field lets you use a cheaper, faster model for focused tasks. Haiku handles most read-only exploration well. Save Sonnet and Opus for work that needs deeper reasoning.

Key agent frontmatter fields:

Field

Purpose

`name`

Agent identifier

`description`

When Claude should delegate to this agent

`model`

haiku (fast/cheap), sonnet (balanced), opus (complex tasks)

`tools`

Allowlist of tools the agent can use

`disallowedTools`

Denylist (removes from inherited tools)

`maxTurns`

Maximum agentic turns before stopping

`memory`

Persistent memory scope: user, project, or local

`isolation: worktree`

Run in an isolated git worktree

`background: true`

Run as a background task

## settings.json: Permissions and Config

The `.claude/settings.json` file controls what Claude is allowed to do. It defines which tools run automatically, which are blocked entirely, and which require confirmation.

```
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": {
    "allow": [
      "Bash(npm run *)",
      "Bash(npx prisma *)",
      "Bash(git status)",
      "Bash(git diff *)",
      "Bash(git log *)",
      "Read",
      "Write",
      "Edit",
      "Glob",
      "Grep"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Bash(curl *)",
      "Bash(wget *)",
      "Read(.env)",
      "Read(.env.*)"
    ]
  },
  "env": {
    "NODE_ENV": "development"
  }
}
```

The **allow** list contains tools that run without asking for confirmation. The **deny** list contains tools blocked entirely. Anything not in either list requires confirmation before proceeding – that middle ground is intentional as a safety net.

The `$schema` line enables autocomplete and inline validation in VS Code and Cursor. Always include it.

### Settings Hierarchy

Settings merge from multiple scopes. Later scopes override earlier ones, except managed policy which cannot be overridden:

```
Merge order (last wins):

1. Managed Policy     # Enforced by IT, cannot override
2. ~/.claude/settings.json       # Your global defaults
3. .claude/settings.json         # Project team settings
4. .claude/settings.local.json   # Your local overrides (gitignored)
```

Arrays merge (allow/deny lists combine from all scopes). Use `.claude/settings.local.json` for permission changes you do not want committed to git.

## Hooks: Event-Driven Automation

Hooks let you run code in response to Claude Code events – before a tool runs, after a session starts, when a permission is requested, and more. This is the feature most articles about the `.claude` directory miss entirely.

Hooks are defined in `settings.json` and can trigger shell scripts, HTTP requests, model prompts, or subagents:

```
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/validate-bash.sh",
            "timeout": 10
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/setup-env.sh"
          }
        ]
      }
    ]
  }
}
```

The `validate-bash.sh` hook runs before every Bash command. It receives the command as JSON on stdin and can block dangerous operations:

```
#!/bin/bash
# .claude/hooks/validate-bash.sh
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Block destructive commands
if echo "$COMMAND" | grep -qE '(rm -rf /|DROP DATABASE|truncate)'; then
  echo '{"decision": "block", "reason": "Destructive command blocked"}'
  exit 2
fi

# Block commands that leak secrets
if echo "$COMMAND" | grep -qE '(cat.*\.env|echo.*PASSWORD)'; then
  echo '{"decision": "block", "reason": "Command may expose secrets"}'
  exit 2
fi

echo '{"decision": "allow"}'
```

Available hook events:

Event

When It Fires

`SessionStart`

Session begins (setup env, load context)

`SessionEnd`

Session ends (cleanup, reporting)

`PreToolUse`

Before any tool executes (validate, block, modify)

`PostToolUse`

After a tool executes (logging, alerts)

`UserPromptSubmit`

When user sends a message

`Stop`

When Claude finishes responding

`Notification`

When a notification is sent

`SubagentStart`

When a subagent spawns

`SubagentStop`

When a subagent finishes

Hook types include `command` (shell script), `http` (webhook), `prompt` (model evaluation), and `agent` (subagent task). Exit code 0 means success, exit code 2 means block the action, and the hook’s stdout is parsed as JSON.

## MCP Servers: Extending Claude’s Tools

The Model Context Protocol (MCP) lets you give Claude access to external tools and data sources – databases, APIs, file systems, and more. Configure MCP servers in `.claude/.mcp.json`:

```
[
  {
    "name": "filesystem",
    "type": "stdio",
    "command": "npx",
    "args": ["@modelcontextprotocol/server-filesystem", "/path/to/allowed/dir"]
  },
  {
    "name": "postgres",
    "type": "stdio",
    "command": "npx",
    "args": ["@modelcontextprotocol/server-postgres"],
    "env": {
      "DATABASE_URL": "postgresql://user:pass@localhost:5432/mydb"
    }
  },
  {
    "name": "github",
    "type": "stdio",
    "command": "npx",
    "args": ["@modelcontextprotocol/server-github"],
    "env": {
      "GITHUB_TOKEN": "$GITHUB_TOKEN"
    }
  }
]
```

MCP servers run as local processes. The `stdio` type launches a command and communicates over stdin/stdout. Other types include `http` (REST endpoint), `sse` (server-sent events), and `ws` (WebSocket). You can also define MCP servers inline within agent configurations using the `mcpServers` field. MCP is part of a broader trend of [AI-powered developer tools](https://computingforgeeks.com/top-10-ai-tools-for-developers/) that extend what coding assistants can do beyond just reading and writing files.

## The Memory System

Claude Code has a persistent memory system that stores notes across sessions. There are two types of memory:

**Auto-memory** lives in `~/.claude/projects/<project-hash>/memory/`. Claude automatically saves useful observations as it works – commands it discovers, patterns it notices, architecture insights. You can browse and edit these with `/memory`. The `MEMORY.md` file acts as an index, and individual memory files store specific topics.

**Agent memory** gives subagents their own persistent knowledge base. Agents configured with `memory: project` store memories in `.claude/agent-memory/<agent-name>/` (shared with the team), while `memory: local` stores in `.claude/agent-memory-local/<agent-name>/` (personal, gitignored).

The memory system uses a specific file format with YAML frontmatter:

```
---
name: user-preferences
description: How the user prefers code to be written
type: feedback
---

Always use functional patterns over class-based.
Never add trailing summaries after completing a task.

**Why:** User explicitly corrected this behavior twice.
**How to apply:** After finishing any code task, stop. Do not summarize.
```

Memory types include `user` (about the person), `feedback` (corrections and preferences), `project` (ongoing work context), and `reference` (pointers to external resources). Claude uses these to stay consistent across sessions.

## When to Use What: Decision Guide

With six different configuration mechanisms, choosing the right one matters. Here is a practical decision guide:

```
What are you trying to do?
│
├─ Give Claude instructions about your project
│  ├─ Under 200 lines total? → CLAUDE.md
│  ├─ Over 200 lines? → Split into .claude/rules/ files
│  └─ Only for certain file types? → rules/ with paths: frontmatter
│
├─ Create a repeatable workflow you trigger manually
│  └─ .claude/commands/workflow-name.md
│
├─ Create a workflow Claude triggers automatically
│  └─ .claude/skills/skill-name/SKILL.md
│
├─ Delegate to a specialist with its own context
│  └─ .claude/agents/specialist-name.md
│
├─ Control what Claude can and cannot do
│  └─ .claude/settings.json (permissions allow/deny)
│
├─ Run code when specific events happen
│  └─ Hooks in settings.json + .claude/hooks/ scripts
│
├─ Give Claude access to external tools/databases
│  └─ .claude/.mcp.json
│
└─ Remember things across sessions
   └─ Memory system (~/.claude/projects/.../memory/)
```

## Getting Started: A Practical Progression

Do not try to set up everything at once. Here is a progression that works well:

**Step 1:** Run `/init` inside Claude Code. It generates a starter CLAUDE.md by reading your project. Edit it down to the essentials – build commands, architecture, conventions, gotchas.

**Step 2:** Add `.claude/settings.json` with allow/deny rules appropriate for your stack. At minimum, allow your run commands and deny `.env` reads and destructive shell commands.

**Step 3:** Create one or two commands for the workflows you repeat most. Code review and issue fixing are good starting points.

**Step 4:** When CLAUDE.md gets crowded, start splitting instructions into `.claude/rules/` files. Scope them by file path where it makes sense.

**Step 5:** Add skills and agents when you have recurring complex workflows worth packaging. A deploy skill, a security audit agent, and a database explorer agent are common first additions.

That covers 95% of projects. Hooks and MCP servers come in when you need event-driven automation or external tool integration.

## Troubleshooting Common Issues

### CLAUDE.md not loading or instructions being ignored

Check the file location. Claude Code looks for `CLAUDE.md` at the project root or inside `.claude/CLAUDE.md`. If it is in a subdirectory without being at the root level, it will only lazy-load when Claude opens files in that directory. Also verify your CLAUDE.md is not too long – files over 200 lines cause adherence to drop.

### Path-scoped rules not applying to specific files

The `paths:` field uses glob patterns. Common mistakes: using `src/*.ts` when you mean `src/**/*.ts` (the double star matches nested directories), or forgetting the file extension. Test your glob pattern with `find src -name "*.ts"` and compare.

### Custom commands not showing up

Commands must be in `.claude/commands/` (project) or `~/.claude/commands/` (personal). The file must be markdown (`.md`) and the filename becomes the command name. Project commands appear as `/project:name` and personal commands as `/user:name`. Try restarting the Claude Code session after adding new commands.

### Skills not auto-invoking

Auto-invocation depends on the `description` field in SKILL.md. If the description does not match what the user is asking, Claude will not trigger it. Write descriptions that include the exact phrases users say: “deploy”, “ship it”, “push to staging”. You can also set `disable-model-invocation: true` to make a skill manual-only.

### Hook script not running or returning errors

Make sure the hook script is executable (`chmod +x .claude/hooks/script.sh`). Hooks receive JSON on stdin and must output JSON on stdout. Exit code 0 means success, exit code 2 means block the action. Any other exit code is treated as a non-blocking error. Test your hook script manually: `echo '{"tool_name":"Bash","tool_input":{"command":"ls"}}' | .claude/hooks/validate-bash.sh`

## Conclusion

The `.claude` directory is a protocol for telling Claude who you are, what your project does, and what rules to follow. CLAUDE.md is the highest-leverage file – get that right first. Rules split your instructions as they grow. Commands automate your manual workflows. Skills handle context-aware automation. Agents delegate specialized work. Settings control permissions. Hooks react to events. And the memory system keeps Claude consistent across sessions. Start small with CLAUDE.md and settings.json, then add complexity as your project needs it.

![](https://secure.gravatar.com/avatar/6074c6c139bb83d4ccb6f0bbebbe5194b528c07121ca3022ad741d8f2d1c5bdf?s=64&r=g)

**[Josphat Mutai](https://computingforgeeks.com/author/mutai-josphat/)**

Founder of Computingforgeeks. Expertise in Virtualization, Cloud, Linux/UNIX Administration, Automation,Storage Systems, Containers, Server Clustering e.t.c.
