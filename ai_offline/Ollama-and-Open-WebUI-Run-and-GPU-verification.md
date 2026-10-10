# Open WebUI + Ollama — Run & GPU verification

Prerequisites

Quick GPU test
```powershell
docker run --gpus all --rm nvidia/cuda:12.1.0-base-ubuntu22.04 nvidia-smi
```
 # Open WebUI + Ollama — Run & GPU verification
 
 This folder contains a Compose stack that runs `ollama` and an Open WebUI frontend. The README below describes prerequisites, GPU verification, how to run (image vs local build), model pull notes, and common troubleshooting steps for Windows + WSL2.
 
 Prerequisites
 - Docker Desktop with WSL2 backend enabled
 - NVIDIA driver for WSL installed (verify with `nvidia-smi` inside your WSL distro)
 - Docker Compose V2 (`docker compose`) recommended (supports `deploy.resources.reservations.devices`)
 - Optional: `curl` or Postman for HTTP checks
 
 Quick GPU test
 ```powershell
 docker run --gpus all --rm nvidia/cuda:12.1.0-base-ubuntu22.04 nvidia-smi
 ```
 
  Start the services (using the published image)
 ```powershell
 docker compose -f Ollama/docker-compose.yml up -d
 docker compose -f OpenWebUI/docker-compose.yml up -d
 ```

## Environment Variable Configuration

The Docker Compose files now support the `OLLAMA_MODELS_PATH` environment variable to customize where Ollama models are stored.

### Using Ollama-Docker-Compose.env-config.example.txt
A configuration template is available at `Ollama-Docker-Compose.env-config.example.txt`. To use it from `ai_offline`:

1. **Copy the example configuration:**
   ```powershell
	copy Ollama-Docker-Compose.env-config.example.txt .env
   ```

2. **Edit the `.env` file** to set your Ollama models path:
   ```bash
   # Windows example
   OLLAMA_MODELS_PATH=D:/Your/Ollama/Models

   # Linux/Mac example  
   OLLAMA_MODELS_PATH=/home/yourname/ollama_models
   ```

3. Ensure `OLLAMA_MODELS_PATH` is also defined in the machine environment when using Compose without a `.env` file.

4. **Run with environment variables:**
   ```powershell
	docker compose -f Ollama/docker-compose.yml up -d
	docker compose -f OpenWebUI/docker-compose.yml up -d
   ```

### Alternative: Set Environment Variable Directly
You can also set the variable directly in your shell:

**Windows Command Prompt:**
```cmd
set OLLAMA_MODELS_PATH=D:\Ollama_models
```

**Windows PowerShell:**
```powershell
$env:OLLAMA_MODELS_PATH="D:/Your/Ollama/Models"
```

**Linux/Mac:**
```bash
export OLLAMA_MODELS_PATH=/home/user/ollama_models
```

**Persistent setting on Windows (using setx):**
```cmd
setx OLLAMA_MODELS_PATH "D:\Ollama_models"
```

### How It Works
The docker-compose files use `${OLLAMA_MODELS_PATH}` syntax and require the
`OLLAMA_MODELS_PATH` environment variable to be defined on the machine or in a
`.env` file.

This allows you to customize the models directory without modifying the docker-compose files.

Build from the local `Ollama/Dockerfile` (recommended if you modify `Ollama/entrypoint.sh`)
 - Why: `image:` pulls a remote prebuilt image; `build:` builds locally from `Ollama/Dockerfile` so local changes are included.
 
 Example `docker-compose` service change (use when you want to build locally):
 ```yaml
 ollama:
	 build:
		 context: .
		 dockerfile: Ollama/Dockerfile
	 image: ollama_local:latest
	 ports:
		 - "11434:11434"
	 volumes:
		 - ollama_data:/root/.ollama
 	 deploy:
 		 resources:
 			 reservations:
 				 devices:
 					 - driver: nvidia
 						 count: all
 						 capabilities: ["gpu"]
 - `image:` — fast startup, uses the published `ollama/ollama` image. Good if you don't change the image.
 - `build:` — required if you edit `Ollama/entrypoint.sh` or other image contents and want those changes used by the container.
 - Hybrid: include both `build:` and `image:` — Compose will build and tag the resulting image with the given name.
 
 GPU notes (Windows / WSL2)
 - Ensure Docker Desktop exposes GPU to WSL and that the WSL distro can run `nvidia-smi`.
 - Compose V2 supports `deploy.resources.reservations.devices`. If using legacy `docker-compose` you may need `docker run --gpus all ...` or upgrade to the newer `docker compose` CLI.
 
 Verify Ollama
 ```powershell
 # List models via the Ollama CLI inside the running container
 docker exec -it ollama ollama list
 
 # Or query the HTTP API
 curl http://localhost:11434/v1/models
 ```
 
 Pulling models
 - From inside the running container:
	 `docker exec -it ollama ollama pull <model>`
 - Example:
	 `docker exec -it ollama ollama pull llama3.2:3b`
 
 TLS / model-pull errors
 - If model downloads fail with TLS certificate errors in proxied/corporate networks, the Compose file sets `OLLAMA_NO_VERIFY=true` to skip cert verification. Use with caution.

Running a model in Docker container, example: translategemma:12b
 ```commandline
 docker exec -it ollama ollama run translategemma:12b
 ```
 
 Troubleshooting
 - If GPU tests fail: confirm `nvidia-smi` from WSL and that Docker Desktop shows GPU support enabled.
 - If using `docker-compose` (legacy) and `deploy.resources.reservations.devices` is ignored, switch to `docker compose`.
 - If `ollama` CLI commands fail inside the container, `docker logs ollama` may show startup errors or model download issues.
 
 Security & notes
 - The Open WebUI service supports a `WEBUI_SECRET_KEY` environment variable; set a strong secret before exposing the UI publicly.
 - This repository is public — do not commit secrets or keys.
 
 If you'd like, I can also:
 - Add an example `docker-compose` snippet in the file to show the `build:` variant alongside the existing `image:` entry.
 - Create a small `make` or PowerShell script to run the common build/start/stop commands.
