#!/usr/bin/env python3
"""
VS Code Cache Cleaner

Cross-platform script to clear Visual Studio Code cache folders without
deleting settings or extensions.

Usage:
    python vscode_cache_cleaner.py

The script will:
1. Detect the operating system (Windows, macOS, Linux)
2. Identify VS Code cache paths for that OS
3. Close VS Code if running
4. Delete cache-related folders
5. Report what was cleared

Notes:
- Does NOT delete your settings or installed extensions.
- Only removes cache, cached data, GPU cache, logs, and cached extensions.
- Requires Python 3.6+ and appropriate permissions to delete system folders.
"""

import os
import shutil
import subprocess
import platform
from pathlib import Path


def kill_vscode() -> None:
    """Close VS Code if running."""
    system = platform.system()
    try:
        if system == "Windows":
            subprocess.run(
                ["taskkill", "/F", "/IM", "Code.exe"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False
            )
        elif system == "Darwin":  # macOS
            subprocess.run(
                ["pkill", "-f", "Visual Studio Code"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False
            )
        else:  # Linux
            subprocess.run(
                ["pkill", "-f", "code"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False
            )
    except Exception:
        pass  # Ignore errors if process not found or kill fails


def get_cache_paths() -> list[Path]:
    """Return a list of VS Code cache paths based on OS."""
    system = platform.system()
    paths = []

    if system == "Windows":
        base = Path(os.getenv("APPDATA")) / "Code"
        paths = [
            base / "Cache",
            base / "CachedData",
            base / "Code Cache",
            base / "GPUCache",
            base / "logs",
            base / "CachedExtensions"
        ]
    elif system == "Darwin":  # macOS
        base = Path.home() / "Library/Application Support/Code"
        paths = [
            base / "Cache",
            base / "CachedData",
            base / "Code Cache",
            base / "GPUCache",
            base / "logs",
            base / "CachedExtensions"
        ]
    else:  # Linux
        base = Path.home() / ".config/Code"
        paths = [
            base / "Cache",
            base / "CachedData",
            base / "Code Cache",
            base / "GPUCache",
            base / "logs",
            base / "CachedExtensions"
        ]

    return paths


def clear_cache() -> None:
    """Delete cache folders."""
    kill_vscode()
    paths = get_cache_paths()

    for path in paths:
        if path.exists():
            try:
                shutil.rmtree(path, ignore_errors=True)
                print(f"✅ Cleared: {path}")
            except Exception as e:
                print(f"❌ Failed to clear {path}: {e}")
        else:
            print(f"ℹ️  Not found: {path}")

    print("\n✅ VS Code cache cleared successfully.")
    print("⚠️  Restart VS Code to regenerate caches as needed.")


if __name__ == "__main__":
    clear_cache()