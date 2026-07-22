@echo off
D:
cd D:\code\GitHub\My\prototype-k
ollama run north-mini-concise:latest "You're up using Ollama model north-mini-concise:latest. Let's get to work."
ollama launch claude --model north-mini-concise:latest
ollama stop north-mini-concise:latest