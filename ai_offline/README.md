# AI Offline

Documentation, guides, and Docker configurations for running a local AI stack offline.

## Contents

### ollama_with_open_webui

Docker-based setup for running [Ollama](https://ollama.com/) with [Open WebUI](https://openwebui.com/) locally.

- `docker-compose-ollama-with-open-webui.yml` — Main Docker Compose configuration
- `docker-compose-ollama-with-open-webui.legacy.yml` — Legacy Compose configuration (older engine versions)
- Detailed READMEs covering GPU support, troubleshooting, configuration, and CLI usage
- Proxy setup for AI Toolkit integration with VS Code

### Documentation Files

- `ollama_integrations_claude-code.md` — Guide for integrating Ollama with Claude Code
- `Run Qwen2.5‑Coder‑7B‑Instruct with AirLLM on Windows 10.md` — Running Qwen models with AirLLM
- `Cline-Ollama - Practical Model Compatibility Guide.md` — Model compatibility guidance for Cline + Ollama

## Quick Start

```bash
cd ai_offline/ollama_with_open_webui
docker compose -f docker-compose-ollama-with-open-webui.yml up -d
```

See the detailed READMEs in `ollama_with_open_webui/` for configuration options, GPU passthrough, and troubleshooting.