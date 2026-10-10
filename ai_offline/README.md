# AI Offline

Documentation, guides, and Docker configurations for running a local AI stack offline.

## Contents

### Ollama and Open WebUI

Docker-based setup for running [Ollama](https://ollama.com/) with [Open WebUI](https://openwebui.com/) locally.

- `Ollama/docker-compose.yml` — Main Ollama Compose configuration
- `Ollama/docker-compose.legacy.yml` — Legacy Ollama Compose configuration
- `Ollama/` — Ollama Dockerfile, entrypoint, and Ollama-specific guides
- `OllamaProxy/` — OpenAI-compatible Ollama proxy service
- `OpenWebUI/docker-compose.yml` — Main Open WebUI Compose configuration
- `OpenWebUI/docker-compose.legacy.yml` — Legacy Open WebUI Compose configuration
- `OpenWebUI/` — Open WebUI Dockerfile and persistent data
- Detailed READMEs covering GPU support, troubleshooting, configuration, and CLI usage
- Proxy setup for AI Toolkit integration with VS Code

### DeepSeek Harness

- `DeepSeekHarness/` — Ollama and Open WebUI stack configured for a DeepSeek model

### Documentation Files

- `ollama-integrations-with-claude-code.md` — Guide for integrating Ollama with Claude Code
- `AirLLM-Run-Qwen2.5-Coder-7B-Instruct-with-AirLLM-on-Windows-10.md` — Running Qwen models with AirLLM
- `Ollama-integrations-with-Cline-Practical-Model-Compatibility-Guide.md` — Model compatibility guidance for Cline + Ollama

## Quick Start

```bash
cd ai_offline
docker compose -f Ollama/docker-compose.yml up -d
docker compose -f OpenWebUI/docker-compose.yml up -d
```

See the detailed READMEs in `ai_offline/` and `ai_offline/Ollama/` for configuration options, GPU passthrough, and troubleshooting.