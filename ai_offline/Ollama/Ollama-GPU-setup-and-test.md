# GPU — Setup & Tests

This section covers GPU prerequisites and quick verification steps for Windows (WSL2) and Linux/macOS systems with Docker.

Windows (WSL2 + Docker Desktop)
- Install NVIDIA driver for WSL: follow NVIDIA/Windows instructions.
- Enable WSL2 backend in Docker Desktop and enable GPU support.
- Ensure your WSL distro has access to the GPU: open WSL and run `nvidia-smi`.

Quick GPU test (host/WSL)
```powershell
docker run --gpus all --rm nvidia/cuda:12.1.0-base-ubuntu22.04 nvidia-smi
```

Inside the running `ollama` container (if started):
```bash
docker exec -it ollama nvidia-smi
```

Docker Compose notes
- Use Docker Compose V2 (`docker compose`) for `deploy.resources.reservations.devices` support (used in the Compose file).
- Use Docker Compose V2 (`docker compose`) for `deploy.resources.reservations.devices` support (used in the Compose file).
- If you must use legacy `docker-compose` (or your compose binary rejects `deploy.resources.reservations.devices`), either:
	- Upgrade to Docker Desktop / Compose V2 and run `docker compose` (recommended), or
	- Use the fallback in the Compose file: it includes `runtime: nvidia` and an `NVIDIA_VISIBLE_DEVICES=all` env var which may work if `nvidia-container-runtime` is installed on the host.

If `nvidia-smi` fails
- On Windows: confirm the WSL NVIDIA driver is installed and Docker Desktop -> Settings -> Resources -> WSL Integration is enabled.
- On Linux: install the official NVIDIA driver and the Docker NVIDIA runtime (`nvidia-docker2` / `nvidia-container-toolkit`) and restart Docker.
