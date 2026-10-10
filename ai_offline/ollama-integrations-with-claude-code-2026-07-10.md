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
* **`ministral-3:8b` (Deep Context Failure):** Works fluently initially, but hits a failure wall around the **32k token horizon**. Under deep multi-file sessions, it fails to emit proper EOS/Stop tokens within Claude Code, entering an infinite loop that exhausts the maximum output limits ("Baking" for over 4 minutes).

#### 🎯 Performance Strategy & Claude Code Requirements

To run Claude Code locally without system stalling, your system must respect **VRAM Headroom Requirements**. Claude Code does not just load the static model; it aggressively builds context memory maps (KV Cache) from your project files.

* **Safe Tier (Under 15B parameters):** Leaves a massive **12GB to 16GB VRAM buffer** on your dual cards. This allows heavy repository context indexing to stay entirely inside lightning-fast GPU memory.
* **Upper Limit Tier (24B parameters):** Leaves a **9.5GB VRAM buffer**. It operates right on the edge of safety—capable of working fluently on medium/structured projects without CPU offloading but requires tight context management.

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

### Does not seems to support Claude Code Tooling

That is the classic "agent loop trap." What you are seeing is the model trying to hold a polite conversation about the task instead of actually spitting out the precise structured tool call that Claude Code expects. When it gives you that text, Claude Code's engine doesn't see a tool request, so it just feeds the text back to the model, causing an infinite loop of empty promises.

* mistral-small3.2
* deepseek-r1:14b

#### Bug: Output Token Maximum Exceeded / "Baking" Loops (e.g., `gemma4:12b`, `ministral-3:8b`)

* **Symptom:** Claude Code stalls for minutes ("Baked for 4m+") and crashes with `API Error: Claude's response exceeded the 64000 output token maximum`.
* **Cause 1 (Thinking Models - `gemma4`):** The model wastes thousands of generated tokens on internal `<think>` reasoning paths, exhausting the output allowance.
* **Cause 2 (Smaller Models - `ministral-3:8b` around ~32k tokens):** The model misses or fails to emit the correct EOS/Stop tokens within Claude Code's complex environment, getting trapped in an infinite loop of repeating empty sequences or tool headers until hitting the 64k limit.
* **Fixes:**
1. Add `CLAUDE_CODE_DISABLE_THINKING=1` or `MAX_THINKING_TOKENS=0` to Windows Environment Variables to suppress thinking loops.
2. Explicitly append formatting commands to the end of long prompts: *"...Do the task in one direct response and stop writing immediately once completed."*
3. If a <10B model keeps getting stuck on deep context sessions (>30k tokens), pivot up to the robust **`qwen3.5:9b`** or **`gemma4:12b`** for cleaner token boundary handling.



```
