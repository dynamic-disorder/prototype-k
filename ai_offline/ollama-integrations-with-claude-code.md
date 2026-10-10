## Ollama
> Ollama is a platform that allows users to run large language models (LLMs) locally on their own computers, providing privacy, speed, and flexibility without relying on cloud services.

[Download Ollama](https://ollama.com/download)
> Ollama is available on macOS, Windows, and Linux.

## Anthropic's Claude Code
URL: https://docs.ollama.com/integrations/claude-code
> Claude Code is Anthropic’s agentic coding tool that can read, modify, and execute code in your working directory.

Install [Claude Code](https://code.claude.com/docs/en/overview):
> Claude Code is an agentic coding tool that reads your codebase, edits files, runs commands, and integrates with your development tools. Available in your terminal, IDE, desktop app, and browser.

Windows
```text
irm https://claude.ai/install.ps1 | iex
```

## Ollama offline/non-cloud models models compatible with Claude Code

For hardware (RTX 3060 12 GB VRAM, 96 GB RAM DDR3, dual Xeon E5‑2690 v2 (CPU Mark: Multithread Rating: 13290, Single Thread Rating: 1857, Cores: 10, Threads:20), dual: (Cores: 2x10=20, Threads:2x20 = 40))

### ministral-3
```text
ollama pull ministral-3:14b
ollama launch claude --model ministral-3:14b
```

### qwen3.5

URL: https://ollama.com/library/qwen3.5
```text
ollama pull qwen3.5:9b
ollama launch claude --model qwen3.5:9b
```

### glm-4.7-flash
URL: https://ollama.com/library/glm-4.7-flash
```text
ollama pull glm-4.7-flash:q4_K_M
ollama launch claude --model glm-4.7-flash:q4_K_M
```

### 2026-07-10
ANTHROPIC_AUTH_TOKEN=ollama
ANTHROPIC_BASE_URL=http://localhost:11434

#### Env vars:
CLAUDE_CODE_ATTRIBUTION_HEADER=0
CLAUDE_CODE_BLOCKING_LIMIT_OVERRIDE=197000
CLAUDE_CODE_MAX_OUTPUT_TOKENS=64000

you are routing Claude Code to your local Ollama setup on your dual RTX 3060s, these variables are actually performing critical roles.

Here is exactly what they are doing for your local setup:

⚡ CLAUDE_CODE_ATTRIBUTION_HEADER=0 (Keep This!)
What it does: It forces Claude Code to stop injecting an internal tracking header (x-anthropic-billing-header) into the text at the absolute beginning of its system prompts.

Why it matters for you: Without this set to 0, that tracking block slightly changes on every single message turn. For local engines like Ollama/llama.cpp, any change at the beginning of a prompt instantly wipes out your prompt cache. Keeping this at 0 ensures Ollama reuses your existing project context instantly instead of re-processing your entire codebase history on every single prompt.

🛑 CLAUDE_CODE_BLOCKING_LIMIT_OVERRIDE=197000 (Keep This!)
What it does: It manually sets the context window ceiling where Claude Code forces a compaction step (shrinking your conversation history).

Why it matters for you: A bug in recent Claude Code versions causes it to double-subtract output reservations, causing it to throw "Context limit reached" errors prematurely around 130k–160k tokens. This override restores your full capacity. (Just keep an eye on your VRAM usage if your local model's context window settings are lower than this).

📤 CLAUDE_CODE_MAX_OUTPUT_TOKENS=64000 (Keep This!)
What it does: It raises the maximum length of a single response Claude Code is allowed to generate from its restrictive default of 32,000 tokens up to 64,000 tokens.

Why it matters for you: When managing large codebases locally, Claude Code often needs to output long multi-file refactors or heavy structural scripts in a single pass. Leaving this at 64k prevents the CLI from throwing a max output token error mid-generation.

Verdict: They are perfectly tailored optimization flags for power users running local coding agents. Leave them as they are!