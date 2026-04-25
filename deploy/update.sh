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

require_command() {
	if ! command -v "$1" >/dev/null 2>&1; then
		echo "Missing required command: $1" >&2
		exit 1
	fi
}

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

MODE="${PUPLER_MODE:-docker}"

case "$MODE" in
	docker)
		require_command docker
		require_command systemctl
		if ! docker compose version >/dev/null 2>&1; then
			echo "Docker Compose v2 is required (\`docker compose\`)." >&2
			exit 1
		fi

		docker compose pull
		systemctl restart "$SERVICE_NAME"
		systemctl --no-pager --full status "$SERVICE_NAME"

		echo "Pupler updated."
		echo "Mode: $MODE"
		echo "Install dir: $INSTALL_DIR"
		echo "Service: $SERVICE_NAME"
		echo "Image: ${PUPLER_IMAGE:-unknown}"
		echo "Version: ${PUPLER_VERSION:-unknown}"
		echo "URL: http://${PUPLER_BIND_ADDRESS}:${PUPLER_PORT}"
		;;
	bun-live)
		require_command git
		require_command systemctl

		if [ -z "${PUPLER_REPO_DIR:-}" ] || [ ! -d "$PUPLER_REPO_DIR" ]; then
			echo "Missing or invalid PUPLER_REPO_DIR in $INSTALL_DIR/.env" >&2
			exit 1
		fi
		if [ -z "${PUPLER_RUN_USER:-}" ]; then
			echo "Missing PUPLER_RUN_USER in $INSTALL_DIR/.env" >&2
			exit 1
		fi
		if [ -z "${PUPLER_BUN_BIN:-}" ]; then
			echo "Missing PUPLER_BUN_BIN in $INSTALL_DIR/.env" >&2
			exit 1
		fi

		PUPLER_BUN_DIR="$(dirname "$PUPLER_BUN_BIN")"
		su - "$PUPLER_RUN_USER" -c "export PATH='$PUPLER_BUN_DIR':\$PATH && cd '$PUPLER_REPO_DIR' && git pull --ff-only && '$PUPLER_BUN_BIN' install"
		systemctl restart "$SERVICE_NAME"
		systemctl --no-pager --full status "$SERVICE_NAME"

		echo "Pupler updated."
		echo "Mode: $MODE"
		echo "Repo dir: $PUPLER_REPO_DIR"
		echo "Service: $SERVICE_NAME"
		echo "Run user: $PUPLER_RUN_USER"
		echo "URL: http://${PUPLER_BIND_ADDRESS}:${PUPLER_PORT}"
		;;
	*)
		echo "Unknown PUPLER_MODE: $MODE" >&2
		echo "Supported modes: docker, bun-live" >&2
		exit 1
		;;
esac
