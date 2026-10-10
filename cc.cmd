@echo off
rem Launch Claude Code through a local Ollama model.
rem cd /d "%~dp0" goes to this script's own directory (and switches drive if needed),
rem so the repository can live anywhere instead of a hard-coded absolute path.
cd /d "%~dp0"
ollama run north-mini-concise:latest "You're up using Ollama model north-mini-concise:latest. Let's get to work."
ollama launch claude --model north-mini-concise:latest
ollama stop north-mini-concise:latest
