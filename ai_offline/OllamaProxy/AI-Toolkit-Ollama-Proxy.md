# Ollama + Open WebUI + AI Toolkit Proxy (Docker Setup)

This project provides a complete local AI development stack using:

- **Ollama** — Local LLM runtime
- **Open WebUI** — Browser‑based chat UI
- **Ollama‑Proxy** — OpenAI‑compatible API wrapper
- **Docker Compose** — Orchestration
- **Microsoft AI Toolkit for VS Code** — Local development & model integration

The proxy enables the AI Toolkit to detect and use Ollama models by exposing a fully OpenAI‑compatible `/v1/models` endpoint.

## Why Ollama in Docker Doesn't Show Up in AI Toolkit

The AI Toolkit automatically detects Ollama only when it is installed natively on the host (macOS, Linux, Windows).

When Ollama runs inside Docker:

- The Toolkit cannot detect the Ollama binary
- It cannot read `~/.ollama`
- It cannot detect the running service
- **Critically**: Ollama does not implement the `/v1/models` endpoint

The Toolkit expects:

```
GET /v1/models
```

But Ollama exposes:

```
GET /api/tags
```

Because of this mismatch, the Toolkit hides Ollama from the model picker.

## The Solution

Run a small proxy that:

- Implements `/v1/models`
- Translates it to `/api/tags`
- Forwards chat + completion requests to Ollama

Once the proxy is running, the AI Toolkit can finally list your models.

## Architecture Overview

```
               ┌──────────────────────────────┐
               │      Visual Studio Code       │
               │        AI Toolkit             │
               │  (expects OpenAI API)         │
               └──────────────┬───────────────┘
                              │  http://localhost:8080/v1
                              ▼
                 ┌──────────────────────────┐
                 │      Ollama-Proxy        │
                 │  OpenAI-compatible API   │
                 │  /v1/models              │
                 │  /v1/chat/completions    │
                 │  /v1/completions         │
                 └──────────────┬───────────┘
                                │  http://ollama:11434
                                ▼
                     ┌──────────────────────┐
                     │       Ollama         │
                     │   /api/tags          │
                     │   /api/chat          │
                     │   /api/generate      │
                     └──────────┬───────────┘
                                │
                                ▼
                     ┌──────────────────────┐
                     │     Open WebUI       │
                     │  (optional frontend) │
                     └──────────────────────┘
```

## Files in This Setup

### OllamaProxy/Dockerfile

```dockerfile
FROM node:18
WORKDIR /app
COPY package.json package.json
RUN npm install
COPY . .
EXPOSE 8080
CMD ["node", "ollama-proxy.js"]
```

### Ollama/docker-compose.legacy.yml and OpenWebUI/docker-compose.legacy.yml

```yaml
services:
  ollama:
    image: ollama/ollama
    container_name: ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
      - G:/Ollama_models:/root/.ollama/models
    environment:
      - NVIDIA_VISIBLE_DEVICES=all
      - OLLAMA_NO_VERIFY=true
      - OLLAMA_KEEP_ALIVE=30m
    runtime: nvidia
    healthcheck:
      test: ["CMD", "ollama", "list"]
    networks:
      - ai_network

  ollama-proxy:
    build:
      context: ../OllamaProxy
      dockerfile: Dockerfile
    container_name: ollama-proxy
    ports:
      - "8080:8080"
    depends_on:
      - ollama
    environment:
      - OLLAMA_BASE_URL=http://ollama:11434
    networks:
      - ai_network

networks:
  ai_network:
    driver: bridge
    attachable: true

volumes:
  ollama_data:
```

Start the Ollama stack first, then start Open WebUI from its own Compose file:

```powershell
docker compose -f ../Ollama/docker-compose.legacy.yml up -d --build
docker compose -f ../OpenWebUI/docker-compose.legacy.yml up -d --build
```

This exposes the proxy on: `http://localhost:8080/v1`

### OllamaProxy/ollama-proxy.js (Fixed)

The proxy now correctly reads the `OLLAMA_BASE_URL` environment variable from Docker Compose:

```javascript
import express from "express";
import cors from "cors";
import fetch from "node-fetch";

// Reads OLLAMA_BASE_URL from environment, defaults to Docker service name
const OLLAMA_URL = process.env.OLLAMA_BASE_URL || "http://ollama:11434";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ---- MODELS ENDPOINT (AI Toolkit requires this) ----
app.get("/v1/models", async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    const data = await response.json();

    const models = data.models.map(m => ({
      id: m.name,
      object: "model",
      created: Math.floor(Date.now() / 1000),
      owned_by: "ollama"
    }));

    res.json({ object: "list", data: models });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- CHAT COMPLETIONS ----
app.post("/v1/chat/completions", async (req, res) => {
  try {
    const { model, messages, stream } = req.body;

    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, stream })
    });

    if (stream) {
      res.setHeader("Content-Type", "text/event-stream");
      response.body.pipe(res);
    } else {
      const data = await response.json();
      res.json({
        id: "chatcmpl-" + Date.now(),
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            message: data.message,
            finish_reason: "stop"
          }
        ]
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- TEXT COMPLETIONS ----
app.post("/v1/completions", async (req, res) => {
  try {
    const { model, prompt, stream } = req.body;

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream })
    });

    if (stream) {
      res.setHeader("Content-Type", "text/event-stream");
      response.body.pipe(res);
    } else {
      const data = await response.json();
      res.json({
        id: "cmpl-" + Date.now(),
        object: "text_completion",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            text: data.response,
            finish_reason: "stop"
          }
        ]
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = 8080;
app.listen(PORT, () => {
  console.log(`Ollama OpenAI proxy running on http://localhost:${PORT}`);
});
```

## Testing the Proxy

After running:

```bash
docker compose -f Ollama/docker-compose.legacy.yml up -d --build
docker compose -f OpenWebUI/docker-compose.legacy.yml up -d --build
```

Test the models endpoint:

```bash
curl http://localhost:8080/v1/models
```

Expected output:

```json
{
  "object": "list",
  "data": [
    { "id": "llama3.1:8b", "object": "model" },
    { "id": "qwen2.5:7b", "object": "model" }
  ]
}
```

If you see your models, the proxy is working.

## Connecting VS Code AI Toolkit

1. Open AI Toolkit in VS Code
2. Go to **Model Providers**
3. Click **Add Custom OpenAI Endpoint**
4. Enter:
   - **Base URL**: `http://localhost:8080/v1`
   - **API Key**: (leave empty)
5. Save
6. Open the model picker → your Ollama models should now appear

## Troubleshooting (Docker Networking & Toolkit Issues)

### 1. AI Toolkit still doesn't show models

Check the proxy logs:

```bash
docker logs ollama-proxy
```

If you see connection errors, your proxy cannot reach Ollama.

### 2. Proxy cannot reach Ollama

Inside the proxy container:

```bash
docker exec -it ollama-proxy sh
curl http://ollama:11434/api/tags
```

If this fails:

- Ensure both containers share the same network (`ai_network`)
- Ensure the service name is `ollama`
- Ensure Ollama exposes port 11434 internally
- Verify `OLLAMA_BASE_URL` is set in the proxy environment

### 3. Curl to proxy works, but Toolkit still shows nothing

AI Toolkit caches providers.

**Fix:**

- Restart VS Code
- Remove + re‑add the custom endpoint
- Ensure the endpoint ends with `/v1`

### 4. "ECONNREFUSED" errors

This means the proxy cannot reach Ollama.

**Check:**

- Is Ollama container running?
- Is the internal URL correct?
- Does your compose file include `depends_on: - ollama`?
- Is `OLLAMA_BASE_URL` correctly set to `http://ollama:11434`?

### 5. Windows users: WSL2 port conflicts

If you run Docker Desktop + WSL2:

- Ensure nothing else is using port 8080
- Try changing the proxy port:

```yaml
ports:
  - "8081:8080"
```

Then update AI Toolkit: `http://localhost:8081/v1`

### 6. Proxy returns empty model list

This means Ollama has no models installed.

**Check:**

```bash
docker exec -it ollama ollama list
```

**Install one:**

```bash
docker exec -it ollama ollama pull llama3.1:8b
```

## Summary

This setup gives you:

- Ollama running in Docker with GPU support
- Open WebUI for local chat interface
- A full OpenAI‑compatible proxy
- VS Code AI Toolkit integration
- Model auto‑detection in the model picker

The proxy bridges the gap between Ollama's native API and the OpenAI-compatible interface expected by modern AI development tools.


AI Toolkit Error: “Unable to verify Ollama server version”
When adding the proxy endpoint to the AI Toolkit, you may see:

Unable to verify Ollama server version. Please ensure you have Ollama version 0.6.4 or higher installed.

This message appears even when your proxy works perfectly and curl http://localhost:8080/v1/models returns valid data.

✔️ **Why this happens**
The AI Toolkit tries to detect Ollama by calling:

```Code
GET /api/version
```
But:

Your proxy does not implement /api/version

Ollama inside Docker is not visible to the host, so the Toolkit cannot detect it directly

The Toolkit assumes “Ollama is missing or outdated” when it cannot verify the version

This is expected behavior when using Docker‑based Ollama.

✔️ **The important part**
This warning does NOT prevent the Toolkit from using your custom OpenAI endpoint.  
It only means the Toolkit cannot auto‑detect a native Ollama installation.

Your proxy is the actual provider — not Ollama itself — so the version check is irrelevant.

✅ How to Make AI Toolkit Accept the Proxy and Show Ollama Models
Even after the proxy works, the AI Toolkit caches failed providers.
Follow this exact sequence to force a refresh.

1. Remove the old custom endpoint
VS Code → AI Toolkit → Model Providers → Remove the existing custom endpoint.

This clears the cached “bad provider” state.

2. Fully restart VS Code
Not a window reload — a full quit and reopen.

The Toolkit caches provider metadata in memory.

3. Re‑add the custom endpoint
Use:

```Code
Base URL: http://localhost:8080/v1
API Key: (leave empty)
```
Click Save.

If the proxy is reachable, the Toolkit will immediately call:

```Code
GET http://localhost:8080/v1/models
```
…and populate the model list.

4. Open Copilot Chat → Model Picker
You should now see a new provider section:

Custom OpenAI Provider (http://localhost:8080/v1)

Under it, your Ollama models will appear:

llama3.1:8b

qwen2.5:7b

mistral:7b

etc.

🧪 **If the warning still appears**
This is normal.
The Toolkit will always show the warning when:

Ollama is not installed natively

/api/version is missing

The provider is not the real Ollama server

But as long as:

```script
curl http://localhost:8080/v1/models
```
returns your models, the Toolkit will still use them.

🧩 Optional: Add /api/version to the Proxy (to silence the warning)
If you want to eliminate the warning entirely, add this to your proxy:

```js
app.get("/api/version", (req, res) => {
  res.json({ version: "0.6.4" });
});
```
This satisfies the Toolkit’s version check.

🏁 **Summary**
The AI Toolkit warning is expected when using Docker‑based Ollama

It does not prevent the Toolkit from using your proxy

Removing the endpoint, restarting VS Code, and re‑adding it forces a refresh

Your models will appear under the Custom OpenAI Provider section

Adding /api/version to the proxy can silence the warning completely