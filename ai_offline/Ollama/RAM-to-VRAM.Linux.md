  Given your hardware—RTX 3060 (12GB VRAM), dual Xeon E5-2690 v2 (Ivy Bridge-EP, 10 cores/20 threads each, 40 total threads), and 96GB DDR3—you're in a unique position where you have **massive system RAM but relatively limited VRAM and older, slower CPU architecture**. Let me search for specific optimization guidance for this kind of setup. 
   Based on your hardware profile and the search results, here's your **optimal Ollama configuration** for RTX 3060 12GB + dual Xeon E5-2690 v2 (40 threads total) + 96GB DDR3:

## The Strategy

Your setup has a **massive RAM/VRAM ratio (8:1)** but older, slower Ivy Bridge-EP CPUs with DDR3. The key insight from  is that **hybrid GPU/CPU offloading is significantly slower than pure GPU or pure CPU** due to PCIe overhead and synchronization. With your hardware, you have two viable paths:

1. **Pure GPU mode**: Models ≤12GB total (weights + KV cache) → Fastest for small models
2. **Pure CPU mode**: Large models that don't fit in 12GB → Use your 96GB RAM effectively

Avoid the middle ground where models partially fit in VRAM—it's 4-5x slower than either extreme .

---

## Recommended Environment Variables

### Linux systemd Configuration

```bash
sudo systemctl edit ollama.service
```

Add this configuration:

```ini
[Service]
# GPU Optimization
Environment="OLLAMA_FLASH_ATTENTION=1"
Environment="OLLAMA_GPU_OVERHEAD=1073741824"

# CPU Optimization for Xeon E5-2690 v2
# Use physical cores only (20) - hyperthreading hurts performance on older CPUs
Environment="OLLAMA_NUM_THREADS=20"
# Or try 16 if you want to reserve cores for system

# Memory Management
Environment="OLLAMA_MAX_LOADED_MODELS=1"
Environment="OLLAMA_NUM_PARALLEL=1"
Environment="OLLAMA_KEEP_ALIVE=-1"

# Optional: Force CPU for specific large models via Modelfile later
# Environment="OLLAMA_KV_CACHE_TYPE=q8_0"
```

Then reload:
```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

---

## Model-Specific Strategies

### For Small Models (Fits in 12GB VRAM)

**Target**: 7B-9B models at Q4_K_M with moderate context

| Model | Size | Context | Expected Speed |
|-------|------|---------|----------------|
| `llama3.1:8b` | ~4.7GB | 8K | 40+ tokens/s |
| `qwen3:8b` | ~4.7GB | 8K | 40+ tokens/s |
| `gemma3:12b` | ~7GB | 4K | 25-30 tokens/s |

**Modelfile for GPU-only**:
```dockerfile
FROM llama3.1:8b
PARAMETER num_ctx 8192
PARAMETER num_gpu 999  # Force all layers to GPU
```

### For Large Models (CPU-Only Mode)

**Target**: 30B-70B models using your 96GB RAM

Since your DDR3 bandwidth is limited (~51GB/s theoretical max per socket, ~102GB/s total), pure CPU inference will be slow (~2-6 tokens/s) but functional for batch workloads .

**Modelfile for CPU-only large models**:
```dockerfile
FROM llama3.3:70b
PARAMETER num_ctx 4096
PARAMETER num_gpu 0  # Force CPU-only
PARAMETER num_thread 20
```

---

## Why These Settings?

| Setting | Rationale |
|---------|-----------|
| `OLLAMA_NUM_THREADS=20` | Your Xeons have 20 physical cores total (10 per socket). Hyperthreading on older architectures often hurts LLM performance due to cache thrashing  |
| `OLLAMA_MAX_LOADED_MODELS=1` | With 96GB RAM but slow DDR3, swapping models is expensive. Keep one loaded  |
| `OLLAMA_NUM_PARALLEL=1` | Prevents context cache competition between conversations  |
| `OLLAMA_KEEP_ALIVE=-1` | Model reloads from DDR3 are slow; keep it resident  |
| `OLLAMA_FLASH_ATTENTION=1` | Essential for 12GB VRAM to save memory and improve speed  |
| `OLLAMA_GPU_OVERHEAD=1GB` | Prevents OOM when pushing context limits on 12GB  |

---

## Monitoring Commands

```bash
# Check what's loaded and where
ollama ps

# Watch GPU utilization
watch -n 1 nvidia-smi

# Check Ollama logs for configuration
sudo journalctl -u ollama -f | grep "server config env"
```

---

## Pro Tips for Your Setup

1. **Avoid the "partial offload trap"**: If a model doesn't fit entirely in 12GB VRAM, either use a smaller context to make it fit, or force CPU-only with `num_gpu 0`. The hybrid mode will be painfully slow on your DDR3 .

2. **Quantization sweet spot**: Stick to `Q4_K_M` for GPU models. For CPU-only large models, you might try `Q4_0` or `Q3_K_M` to reduce memory bandwidth pressure .

3. **Context length trade-offs**: On GPU, 8K context is safe for 7B-8B models. For 12B models, drop to 4K. Every doubling of context adds ~0.5-1GB VRAM for 8B models .

4. **CPU Governor**: Set your Xeons to performance mode:
   ```bash
   echo performance | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor
   ```

Your 96GB RAM is your superpower—use it for running massive models on CPU when needed, but keep smaller models entirely in that 12GB VRAM for interactive speed.