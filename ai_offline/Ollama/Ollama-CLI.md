# Ollama CLI & API — Quick Reference

Common `ollama` CLI commands and API examples used when managing models or testing the server.

CLI examples (inside container or with `docker exec`)
```bash
# Download / manage models
ollama pull llama3:8b
ollama pull llama3.2:3b
ollama list
ollama run llama3:8b
ollama stop llama3:8b

# Create / push models (advanced)
ollama create my-model -f Modelfile
ollama push my-model
```

Use the `ollama-cli` helper service (one-off container with access to volumes and GPU):
“Start the ollama-cli container just long enough to run ollama pull llama3.2:3b, then delete the container when it's done.”
```bash
docker compose -f docker-compose.yml run --rm ollama-cli ollama pull llama3.2:3b
```

HTTP API examples
- Base URL: `http://localhost:11434`
```bash
# Health / root
curl http://localhost:11434

# List models (example API path)
curl http://localhost:11434/api/tags

# Chat example
curl http://localhost:11434/api/chat -d '{"model":"llama3:8b","messages":[{"role":"user","content":"Hello"}]}'
```

Notes
- Persist models using the named volume `ollama_data` mounted at `/root/.ollama`.
- If model pulls fail due to TLS/proxy issues, the Compose file sets `OLLAMA_NO_VERIFY=true` (use cautiously).
