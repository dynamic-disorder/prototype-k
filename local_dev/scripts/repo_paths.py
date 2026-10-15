"""Repository locations for Python helpers, resolved from this file's own path.

Nothing here is machine-specific: the root is derived from where this file sits, so a script
anywhere in the tree can find the repository without hard-coding an absolute path.

Import it from a script elsewhere in the repo:

    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "local_dev" / "scripts"))
    from repo_paths import repo_root, local_user_files, solution

    scratch = local_user_files()
    project = solution("CliUtils")

Run it directly for a summary:

    python3 local_dev/scripts/repo_paths.py
"""

from __future__ import annotations

from pathlib import Path

__all__ = [
    "repo_root",
    "local_dev",
    "local_user_files",
    "solution",
    "host_os",
]


def repo_root() -> Path:
    """Absolute path of the repository root, derived from this file's location."""
    # <repo>/local_dev/scripts/repo_paths.py -> parents[2] is <repo>
    return Path(__file__).resolve().parents[2]


def local_dev() -> Path:
    """Absolute path of the committed development-support directory."""
    return repo_root() / "local_dev"


def local_user_files() -> Path:
    """Absolute path of the git-ignored scratch directory."""
    return repo_root() / "local_user_files"


def solution(name: str) -> Path:
    """Absolute path of a solution by name, e.g. ``solution("FilenameTools")``.

    Handles both layouts: a solution at the repository root, and a solution inside a
    directory named after it. Returns whichever exists, preferring the root.
    """
    at_root = repo_root() / f"{name}.sln"
    nested = repo_root() / name / f"{name}.sln"
    return at_root if at_root.exists() or not nested.exists() else nested


def host_os() -> str:
    """``"windows"``, ``"macos"``, ``"linux"`` or ``"unknown"``."""
    import sys

    if sys.platform.startswith("win"):
        return "windows"
    if sys.platform == "darwin":
        return "macos"
    if sys.platform.startswith("linux"):
        return "linux"
    return "unknown"


if __name__ == "__main__":
    print(f"repository : {repo_root()}")
    print(f"local_dev  : {local_dev()}")
    print(f"scratch    : {local_user_files()}")
    print(f"host OS    : {host_os()}")
    print("solutions  :")
    found = sorted(repo_root().glob("*.sln")) + sorted(repo_root().glob("*/[A-Za-z]*.sln"))
    for path in found:
        print(f"  {path.relative_to(repo_root()).as_posix()}")
    if not found:
        print("  (none in this repository)")
