# README for OpenWebUI/docker-compose.legacy.yml

Start the Ollama legacy stack first, then run OpenWebUI:

```powershell
# Start the legacy OpenWebUI Compose file
docker compose -f docker-compose.legacy.yml up -d

# Start and rebuild the local OpenWebUI image
docker compose -f docker-compose.legacy.yml up -d --build

# Stop and remove OpenWebUI
docker compose -f docker-compose.legacy.yml down

# Remove the OpenWebUI volume and image
docker compose -f docker-compose.legacy.yml down -v --rmi all
```

Use this legacy file if your Docker Compose installation rejects `deploy.resources.reservations.devices`. The Ollama legacy stack is in `../Ollama` and creates the shared `ai_network`.
