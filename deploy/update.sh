#!/usr/bin/env bash
# Installs the newest version from GitHub on the server: `bash deploy/update.sh` in the app's folder (/opt/weighme).
# The database stays on its volume, so every measurement is kept.
set -euo pipefail

cd "$(dirname "$0")/.."

# The pull may change this very script, and bash would go on running the old text it has open: the new version is
# started for the rest, so an update always installs the way the code it installs expects.
if [[ "${1:-}" != "--pulled" ]]; then
    git pull --ff-only
    # REQUIRE_SIGNED=1: the pulled commit must carry a signature git trusts (a key in gpg's keyring, or in
    # gpg.ssh.allowedSignersFile for SSH signatures), or nothing from it runs here as root.
    if [[ "${REQUIRE_SIGNED:-0}" == "1" ]] && ! git verify-commit HEAD; then
        echo "The newest commit ($(git rev-parse --short HEAD)) has no trusted signature: not installing it." >&2
        echo "Go back to the previous version with: git reset --hard ORIG_HEAD" >&2
        exit 1
    fi
    exec bash deploy/update.sh --pulled
fi

# The commit becomes the version /v1/health reports, so a client can tell which build it talks to.
APP_VERSION="$(git rev-parse --short HEAD)"
export APP_VERSION
echo "Installing ${APP_VERSION}"
# --wait: the update fails, instead of reporting success, when a service does not come up healthy.
docker compose up -d --build --wait --wait-timeout 300
# Old images are no longer used by anything: without this, every update keeps another copy on the disk.
docker image prune -f >/dev/null
docker builder prune -af --filter until=72h >/dev/null
docker compose ps
