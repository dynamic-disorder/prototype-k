FROM ollama/ollama:latest

# Environment configuration
ENV OLLAMA_HOST=0.0.0.0:11434
ENV OLLAMA_KEEP_ALIVE=30m

# Copy entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]