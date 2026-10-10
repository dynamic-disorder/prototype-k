# Run / Start

Quick commands to start and stop the stack. These are the recommended, copy-paste commands for common workflows.

Start (legacy compose file — recommended)
```bash
docker compose -f Ollama/docker-compose.legacy.yml up -d
docker compose -f OpenWebUI/docker-compose.legacy.yml up -d
```

Start (modern Compose V2 with deploy.resources.reservations.devices support)
```bash
docker compose -f Ollama/docker-compose.yml up -d
docker compose -f OpenWebUI/docker-compose.yml up -d
```

Start (build local `Ollama/Dockerfile` first) — recommended if you edit `Ollama/entrypoint.sh` or the Dockerfile
```bash
docker compose -f Ollama/docker-compose.legacy.yml up -d --build
docker compose -f OpenWebUI/docker-compose.legacy.yml up -d --build
```

Stop and remove containers
```bash
docker compose -f Ollama/docker-compose.legacy.yml down
```

Remove volumes and images (clean)
```bash
docker compose -f Ollama/docker-compose.legacy.yml down -v --rmi all
```

Compatibility notes
- Use the **legacy files** (`Ollama/docker-compose.legacy.yml` and `OpenWebUI/docker-compose.legacy.yml`) if your `docker compose` rejects `deploy.resources.reservations.devices`.
- Use the **primary files** (`Ollama/docker-compose.yml` and `OpenWebUI/docker-compose.yml`) with Docker Compose V2.
