# DeepSeek Harness

Docker Compose harness for running a DeepSeek model locally through Ollama and Open WebUI.

The shared runtime references are in [Ollama](../Ollama/) and [OpenWebUI](../OpenWebUI/).

## Start

Copy `.env.example` to `.env`, adjust `OLLAMA_MODELS_PATH` if needed, and start the stack:

```powershell
Copy-Item .env.example .env
docker compose up -d
docker compose --profile setup run --rm deepseek-pull
```

Open <http://localhost:3000> and select the configured model. The Ollama API is available at <http://localhost:11434>.

The default model is `deepseek-r1:8b`, which can be changed with `DEEPSEEK_MODEL` in `.env`. The setup profile is intentionally separate so starting the stack does not automatically download a large model.

## Stop

```powershell
docker compose down
```

Named volumes preserve Ollama and Open WebUI data. `docker compose down -v` removes that data.