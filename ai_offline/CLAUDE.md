# ai_offline: Offline AI Experiments

This directory contains experiments with locally-hosted AI models and tools. No cloud dependencies, all models run on local hardware.

**Subdirectories:**
- **Ollama/**: Ollama image and runtime-specific guides
- **OllamaProxy/**: OpenAI-compatible Ollama proxy service
- **OpenWebUI/**: Open WebUI Dockerfile, Compose files, and persistent data
- **DeepSeekHarness/**: DeepSeek model Compose harness

**Related:** The `CsvTranslations/OllamaTranslatorApi` project integrates with Ollama for offline translation.

## Ollama Setup for Claude Code

See `ollama-integrations-with-claude-code.md` for:
- Installing Ollama on Windows
- Compatible models for local hardware (gemma4:12b, qwen3.5:9b, glm-4.7-flash)
- Launching Claude Code with offline models: `ollama launch claude --model qwen3.5:9b`

## Hardware Requirements

Local setup:
- 2x NVIDIA RTX 3060 - 24 GB VRAM total (12 GB each)
- ~48 GB system RAM
- Intel Xeon E5-2660 v4

Smaller models (7B-14B parameters) work well with this configuration.

## Usage

Navigate to subdirectories for specific projects. This level is organizational only.
