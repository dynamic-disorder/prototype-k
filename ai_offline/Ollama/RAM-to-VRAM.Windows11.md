# RAM → VRAM Offloading Guide for Ollama on Windows 11

![Windows](https://img.shields.io/badge/Platform-Windows_11-0078D6?logo=windows)
![GPU](https://img.shields.io/badge/GPU-RTX_3060_12GB-76B900?logo=nvidia)
![CPU](https://img.shields.io/badge/CPU-Dual_Xeon_E5_2690_v2-6d6d6d)
![RAM](https://img.shields.io/badge/RAM-96GB_DDR3-4A90E2)
![Ollama](https://img.shields.io/badge/Ollama-Optimized-00A67E)

A performance‑tuned configuration for running Ollama on a Windows 11 workstation with **large system RAM**, **limited VRAM**, and **older dual‑socket Xeon CPUs**.  
The goal is to maximize throughput by choosing the right execution mode:

- **Small models → GPU‑only (fastest)**
- **Large models → CPU‑only (stable, uses 96GB RAM)**
- **Avoid hybrid GPU/CPU offloading**, which is slow on DDR3 systems

---

## **📑 Table of Contents**

1. [Overview](#overview)
2. [Environment Variables](#1-configure-environment-variables-windows-11)
3. [GPU‑Only Modelfile](#2-gpuonly-modelfile-for-models-that-fit-in-12gb-vram)
4. [CPU‑Only Modelfile](#3-cpuonly-modelfile-for-large-models-that-exceed-vram)
5. [Monitoring Tools](#4-monitoring-tools-on-windows)
6. [Best Practices](#notes--best-practices)

---

## **Overview**

Your hardware profile:

- **GPU:** NVIDIA RTX 3060 (12GB VRAM)  
- **CPU:** Dual Xeon E5‑2690 v2 (20 physical cores total)  
- **RAM:** 96GB DDR3  

This configuration excels at running **large models in RAM** and **small models entirely in VRAM**, but performs poorly when models spill between CPU and GPU.  
This guide ensures you stay on the fast path.

---

## **1. Configure Environment Variables (Windows 11)**

Ollama on Windows uses **system environment variables** for configuration.

### Steps

1. Open **Start Menu** → search for **Environment Variables**
2. Select **Edit the system environment variables**
3. Click **Environment Variables…**
4. Under **System variables**, click **New…**
5. Add the following:

| Variable | Value |
|---------|--------|
| `OLLAMA_FLASH_ATTENTION` | `1` |
| `OLLAMA_GPU_OVERHEAD` | `1073741824` |
| `OLLAMA_NUM_THREADS` | `20` |
| `OLLAMA_MAX_LOADED_MODELS` | `1` |
| `OLLAMA_NUM_PARALLEL` | `1` |
| `OLLAMA_KEEP_ALIVE` | `-1` |

### Using `setx` (Command Line)

You can set the same variables via PowerShell or CMD:

```powershell
setx OLLAMA_FLASH_ATTENTION 1 /M
setx OLLAMA_GPU_OVERHEAD 1073741824 /M
setx OLLAMA_NUM_THREADS 20 /M
setx OLLAMA_MAX_LOADED_MODELS 1 /M
setx OLLAMA_NUM_PARALLEL 1 /M
setx OLLAMA_KEEP_ALIVE -1 /M
```

➡️ **Restart Windows** to apply changes.

---

## **2. GPU‑Only Modelfile (for models that fit in 12GB VRAM)**

Use this for **7B–9B models** or any model that fits fully in VRAM.

```text
FROM llama3.1:8b
PARAMETER num_ctx 8192
PARAMETER num_gpu 999
```

## **3. CPU‑Only Modelfile (for large models that exceed VRAM)**
Use this for 30B–70B models that cannot fit in 12GB VRAM.
```text
FROM llama3.3:70b
PARAMETER num_ctx 4096
PARAMETER num_gpu 0
PARAMETER num_thread 20
```

## **4. Monitoring Tools on Windows**
Check GPU usage
```powershell
nvidia-smi
```
Check which models are loaded
```powershell
ollama ps
```
These help confirm whether a model is running on GPU or CPU and whether VRAM is saturated.

## **5. Monitoring Tools on Windows**
Check GPU usage
```powershell
nvidia-smi
```

Check which models are loaded
```powershell
ollama ps
```
## **Notes & Best Practices**
Keep only one model loaded  
OLLAMA_MAX_LOADED_MODELS=1 prevents slow DDR3 reloads.

- **Flash attention**
OLLAMA_FLASH_ATTENTION=1 reduces VRAM usage for supported models.

- **Thread tuning**
20 threads matches your 20 physical cores.
You may experiment with 24 if SMT helps specific models.

- **Avoid hybrid mode**  
If a model doesn’t fully fit in VRAM, force CPU mode.
Hybrid mode is significantly slower on older Xeons.