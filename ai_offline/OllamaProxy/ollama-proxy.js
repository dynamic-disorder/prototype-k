/*
Install dependencies:
npm init -y
npm install express cors node-fetch

Run it:
node ollama-proxy.js

You now have a fully OpenAI‑compatible server at:
http://localhost:8080/v1
*/
import express from "express";
import cors from "cors";
import fetch from "node-fetch";

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
