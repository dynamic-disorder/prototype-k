# README for Ollama/docker-compose.legacy.yml

Run / Start the Ollama services:

```powershell
# Start the legacy Compose file
docker compose -f docker-compose.legacy.yml up -d

# Start and rebuild the local Ollama/proxy images
docker compose -f docker-compose.legacy.yml up -d --build

# Stop and remove the Ollama services
docker compose -f docker-compose.legacy.yml down

# Remove Ollama volumes and images
docker compose -f docker-compose.legacy.yml down -v --rmi all
```

Use this legacy file if your Docker Compose installation rejects `deploy.resources.reservations.devices`. Start the OpenWebUI legacy stack separately from `../OpenWebUI`.
