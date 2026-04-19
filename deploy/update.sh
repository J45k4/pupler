#!/usr/bin/env bash

set -euo pipefail

if [ "$(uname -s)" != "Linux" ]; then
	echo "This updater currently supports Linux only." >&2
	exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
	echo "Run this updater as root, for example:" >&2
	echo "  sudo bash update.sh" >&2
	exit 1
fi

for required in docker systemctl; do
	if ! command -v "$required" >/dev/null 2>&1; then
		echo "Missing required command: $required" >&2
		exit 1
	fi
done

if ! docker compose version >/dev/null 2>&1; then
	echo "Docker Compose v2 is required (`docker compose`)." >&2
	exit 1
fi

INSTALL_DIR="${PUPLER_INSTALL_DIR:-/opt/pupler}"
SERVICE_NAME="${PUPLER_SERVICE_NAME:-pupler}"
PUPLER_PORT="${PUPLER_PORT:-5995}"
PUPLER_BIND_ADDRESS="${PUPLER_BIND_ADDRESS:-0.0.0.0}"

if [ ! -d "$INSTALL_DIR" ]; then
	echo "Install dir not found: $INSTALL_DIR" >&2
	exit 1
fi

cd "$INSTALL_DIR"

if [ -f .env ]; then
	set -a
	. ./.env
	set +a
fi

docker compose pull
systemctl restart "$SERVICE_NAME"
systemctl --no-pager --full status "$SERVICE_NAME"

echo "Pupler updated."
echo "Install dir: $INSTALL_DIR"
echo "Service: $SERVICE_NAME"
echo "Image: ${PUPLER_IMAGE:-unknown}"
echo "Version: ${PUPLER_VERSION:-unknown}"
echo "URL: http://${PUPLER_BIND_ADDRESS}:${PUPLER_PORT}"
