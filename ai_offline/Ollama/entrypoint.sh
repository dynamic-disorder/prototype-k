#!/bin/bash

# Start Ollama server
echo "Starting Ollama server..."
ollama serve &

# Show user instructions
echo ""
echo "MANUAL MODEL SETUP REQUIRED:"
echo "1. Open a new terminal tab/window"
echo "2. Run this command to pull your model:"
echo "   docker exec -it ollama ollama pull incept5/llama3.1-claude"
echo "3. Verify it worked with:"
echo "   docker exec ollama ollama list"
echo ""
echo "The Ollama API is now available at http://localhost:11434"
echo "Press Ctrl+C to stop the container"
echo ""

# Keep container running
wait