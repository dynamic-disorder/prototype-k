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
irm [https://claude.ai/install.ps1](https://claude.ai/install.ps1) | iex

```

## Ollama offline/non-cloud models compatible with Claude Code

### Current Hardware Specification

* **GPUs:** 2x NVIDIA GeForce RTX 3060 (Discrete, CUDA, Compute Capability 8.6)
* **VRAM:** 24 GB Total (12 GB dedicated per card)


* **CPU:** Intel(R) Xeon(R) CPU E5-2660 v4 @ 2.00GHz (x86_64, AVX, AVX2 supported)
* **System RAM:** ~48 GB usable RAM (51.4 GB capacity)

---

### 🚨 Hardware Bottleneck & Testing Logs

#### ❌ Failed / Unsuitable Models

* **`qwen2.5-coder:32b` (Fits but Too Slow):** While the model weights fit into the 24GB VRAM pool, Claude Code's extensive workspace context scans cause the KV Cache to expand and spill over into the 2.00GHz Xeon CPU. This triggers extreme prompt processing delays (taking upwards of 19+ minutes on high effort settings).
* **`ministral-3:14b` (Failed/Crashed):** Tested on this setup but failed to complete its assigned task inside Claude Code, resulting in an outright execution freeze or application crash.

#### 🎯 Performance Strategy

To keep execution 100% inside GPU VRAM and prevent slow CPU offloading, **stick to models under 15B parameters.** This guarantees a massive VRAM headroom buffer (12GB to 16GB free space) dedicated completely to Claude Code's large multi-file text contexts.

---

### Verified Fluent Models (Proven with Full Tooling Support)

#### gemma4:12b (Recommended Frontier Model)

Google DeepMind's unified, encoder-free frontier model. Engineered optimally for local agentic workflows and multi-step reasoning. It leaves an enormous VRAM buffer on your dual GPUs, runs lightning-fast, and natively handles complex tool layouts smoothly.

```text
ollama pull gemma4:12b
ollama launch claude --model gemma4:12b

```

#### qwen3.5:9b (Highly Snappy & Reliable)

The lightweight model from the newer Qwen generation line. Highly performant for swift codebase modifications, structural file edits, and incredibly rapid terminal responses without VRAM exhaustion.
URL: https://ollama.com/library/qwen3.5

```text
ollama pull qwen3.5:9b
ollama launch claude --model qwen3.5:9b

```

#### ministral-3:8b (Efficient Agentic Baseline)

The compact counterpart to the 14B variant. It fixes the stability issues encountered with the larger version, providing quick, tool-supported functions while preserving maximum memory headroom.

```text
ollama pull ministral-3:8b
ollama launch claude --model ministral-3:8b

```

#### glm-4.7-flash (Alternative)

URL: https://ollama.com/library/glm-4.7-flash

```text
ollama pull glm-4.7-flash:q4_K_M
ollama launch claude --model glm-4.7-flash:q4_K_M

```

---

### Configuration & Environment Variables

#### Base Connection (2026-07-11)

```text
ANTHROPIC_AUTH_TOKEN=ollama
ANTHROPIC_BASE_URL=http://localhost:11434

```

#### Optimized Local Performance Flags

These flags are highly recommended when routing Claude Code to a local Ollama instance on a dual RTX 3060 platform.

```text
CLAUDE_CODE_ATTRIBUTION_HEADER=0
CLAUDE_CODE_BLOCKING_LIMIT_OVERRIDE=197000
CLAUDE_CODE_MAX_OUTPUT_TOKENS=64000

```

* ⚡ **`CLAUDE_CODE_ATTRIBUTION_HEADER=0`** (Keep This!)
* *What it does:* Stops Claude Code from inserting a variable billing tracking header (`x-anthropic-billing-header`) at the very beginning of its system prompts.
* *Why it matters:* Any string mutation at the front of a prompt completely breaks local prompt caching. Setting this to `0` ensures Ollama instantly reuses your existing project context instead of re-processing your entire codebase history on every single turn.


* 🛑 **`CLAUDE_CODE_BLOCKING_LIMIT_OVERRIDE=197000`** (Keep This!)
* *What it does:* Manually forces the context window ceiling limit where Claude Code performs conversation history compaction.
* *Why it matters:* Prevents premature "Context limit reached" bugs caused by output room calculation errors in recent versions of the CLI.


* 📤 **`CLAUDE_CODE_MAX_OUTPUT_TOKENS=64000`** (Keep This!)
* *What it does:* Increases the maximum output text length permitted in a single generation step up to 64,000 tokens.
* *Why it matters:* Necessary when asking local agents to perform long, multi-file architectural modifications or generating long code blocks in one go.



---

### 💡 Pro-Tips for Local Agent Execution

* **Manage Hybrid Thinking Models:** Since `gemma4:12b` is a hybrid reasoning model, type `/effort low` or `/effort medium` inside the Claude Code interface if you want to speed up execution and reduce the time spent generating internal chain-of-thought tokens.
* **Maintain Workspace Hygiene:** Keep your `.gitignore` or `.claudeignore` file meticulously updated. Preventing the local LLM from scanning heavy assets or build directories (`node_modules`, `bin/`, `dist/`) completely protects your local GPU VRAM from cache choking.

---

### 🛠️ Troubleshooting

#### Bug: Output Token Maximum Exceeded (e.g., `gemma4:12b`)

* **Symptom:** Claude Code crashes with `API Error: Claude's response exceeded the 64000 output token maximum`.
* **Cause:** Local hybrid reasoning models like `gemma4:12b` can waste thousands of generated tokens on internal `<think>` reasoning loops, exhausting the output limit before the actual code response is printed.
* **Fix:** Add `CLAUDE_CODE_DISABLE_THINKING=1` (or `MAX_THINKING_TOKENS=0`) to your Windows Environment Variables. This stops the model from wasting tokens on prolonged chain-of-thought processing, saving the full token allowance for direct code generation.

```
