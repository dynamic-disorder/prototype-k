#!/bin/bash
# repo-env-paths.sh
# Path/root-resolution helpers for ProductName project environment detection.
# Other repo-env-*.sh files source this for get_repo_root/get_repo_settings_file.
# Source this file directly in skills/hooks that only need PRODUCT_NAME_LOCAL resolution.

# Remote-based check: is $1 the root of a clone of CompanyOrOrganizationName/product_name (not the
# product_name.wiki repo)? Matches the origin URL, so it does not depend on the
# folder name or on any environment variable.
_is_repo_root() {
    local dir="$1" url
    [[ -n "${dir}" ]] && [[ -d "${dir}" ]] || return 1
    url=$(git -C "${dir}" remote get-url origin 2>/dev/null) || return 1
    [[ "${url}" =~ [:/]CompanyOrOrganizationName/product_name(\.git)?/?$ ]]
}

# Get the ProductName project root. Auto-detects via git + marker folders first, so
# PRODUCT_NAME_LOCAL is an optional override rather than a requirement.
# Usage: REPO_ROOT=$(get_repo_root) || exit 1
get_repo_root() {
    # 1. Git auto-detection (fast path when cwd is inside the repo)
    local git_root
    git_root=$(git rev-parse --show-toplevel 2>/dev/null)
    if _is_repo_root "${git_root}"; then
        echo "${git_root}"
        return 0
    fi

    # 2. Marker-based walk-up from the current directory
    local dir="${PWD}"
    while [[ -n "${dir}" ]] && [[ "${dir}" != "/" ]]; do
        if _is_repo_root "${dir}"; then
            echo "${dir}"
            return 0
        fi
        dir="$(dirname "${dir}")"
    done

    # 3. Optional explicit override - not required, but honored if set
    if [[ -n "${PRODUCT_NAME_LOCAL:-}" ]] && [[ -d "${PRODUCT_NAME_LOCAL:-}" ]]; then
        echo "${PRODUCT_NAME_LOCAL}"
        return 0
    fi

    # 4. Nothing worked
    echo "ERROR: Could not auto-detect the ProductName project root (looked for a git clone of CompanyOrOrganizationName/product_name, via git root and walking up from $(pwd))." >&2
    echo "" >&2
    echo "If you're running from outside any ProductName checkout, set PRODUCT_NAME_LOCAL:" >&2
    echo "  export PRODUCT_NAME_LOCAL=\"/path/to/product_name\"" >&2
    echo "" >&2

    # 5. Interactive prompt if stdin is a terminal
    if [[ -t 0 ]]; then
        echo "Enter the path to the ProductName project root (or press Enter to use current directory):" >&2
        read -r user_path

        if [[ -z "${user_path}" ]]; then
            user_path="$(pwd)"
        fi

        # Expand ~ and normalize path
        user_path="${user_path/#\~/$HOME}"
        user_path=$(realpath "${user_path}" 2>/dev/null || echo "${user_path}")

        if [[ -d "${user_path}" ]]; then
            echo "Using: ${user_path}" >&2
            echo "" >&2
            echo "To make this permanent, add to your shell profile (~/.bashrc or ~/.zshrc):" >&2
            echo "  export PRODUCT_NAME_LOCAL=\"${user_path}\"" >&2
            echo "" >&2
            echo "${user_path}"
            return 0
        else
            echo "ERROR: Directory does not exist: ${user_path}" >&2
            return 1
        fi
    fi

    return 1
}

# Get path to settings.local.json with PRODUCT_NAME_LOCAL resolution
# Usage: SETTINGS_FILE=$(get_repo_settings_file) || exit 1
get_repo_settings_file() {
    local repo_root
    repo_root=$(get_repo_root) || return 1

    local settings_file="${repo_root}/.agents/settings.local.json"

    if [[ ! -f "${settings_file}" ]]; then
        echo "ERROR: Settings file not found: ${settings_file}" >&2
        echo "Create it with your credentials." >&2
        return 1
    fi

    echo "${settings_file}"
    return 0
}

# Get the local product_name.wiki clone: $PRODUCT_NAME_WIKI_CLONE if set, else the sibling of
# $PRODUCT_NAME_LOCAL. Non-interactive (safe in hooks); returns 1 when neither is set.
# Usage: WIKI_CLONE=$(get_repo_wiki_clone) || exit 0
get_repo_wiki_clone() {
    if [[ -n "${PRODUCT_NAME_WIKI_CLONE:-}" ]]; then
        echo "${PRODUCT_NAME_WIKI_CLONE}"
        return 0
    fi
    [[ -n "${PRODUCT_NAME_LOCAL:-}" ]] || return 1
    local root
    root=$(cygpath -u "${PRODUCT_NAME_LOCAL}" 2>/dev/null || echo "${PRODUCT_NAME_LOCAL}")
    echo "$(dirname "${root}")/product_name.wiki"
}
