# Troubleshooting — Common Issues

Model download TLS errors
- Symptom: model pull fails with `tls: failed to verify certificate: x509: certificate signed by unknown authority`.
- Workarounds:
  - If behind a corporate proxy, configure system/proxy certs. As a last resort use `OLLAMA_NO_VERIFY=true` (already set in Compose) to skip verification.
  - Re-run pull from inside the container: `docker exec -it ollama ollama pull <model>` to see full logs.

GPU not available / `nvidia-smi` missing
- Ensure WSL2 NVIDIA driver (Windows) or host NVIDIA driver + `nvidia-container-toolkit` (Linux) are installed.
- Test: `docker run --gpus all --rm nvidia/cuda:12.1.0-base-ubuntu22.04 nvidia-smi`.

Service not healthy / open-webui failing
- Check logs: `docker compose -f OpenWebUI/docker-compose.yml logs open-webui` and `docker compose -f Ollama/docker-compose.yml logs ollama`.
- Ensure `OLLAMA_BASE_URL` in the `open-webui` environment points to `http://ollama:11434` (as in compose).

Clean state
- Remove containers and volumes and start fresh:
```bash
docker compose -f OpenWebUI/docker-compose.yml down -v --rmi all
docker compose -f Ollama/docker-compose.yml up -d --build
docker compose -f OpenWebUI/docker-compose.yml up -d --build
```

Where to get help
- Check the `ollama` logs and the Open WebUI project docs (GitHub) for service-specific issues.
