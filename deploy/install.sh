#!/usr/bin/env bash

set -euo pipefail

if [ "$(uname -s)" != "Linux" ]; then
	echo "This installer currently supports Linux only." >&2
	exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
	echo "Run this installer as root, for example:" >&2
	echo "  curl -fsSL https://raw.githubusercontent.com/J45k4/pupler/main/deploy/install.sh | sudo bash" >&2
	exit 1
fi

MODE="${PUPLER_MODE:-docker}"
INSTALL_DIR="${PUPLER_INSTALL_DIR:-/opt/pupler}"
SERVICE_NAME="${PUPLER_SERVICE_NAME:-pupler}"
PUPLER_PORT="${PUPLER_PORT:-5995}"
PUPLER_BIND_ADDRESS="${PUPLER_BIND_ADDRESS:-0.0.0.0}"
PUPLER_DATA_DIR="${PUPLER_DATA_DIR:-${INSTALL_DIR}/data}"

require_command() {
	if ! command -v "$1" >/dev/null 2>&1; then
		echo "Missing required command: $1" >&2
		exit 1
	fi
}

install_update_script() {
	local source_path
	source_path="$(dirname "${BASH_SOURCE[0]}")/update.sh"
	if [ -f "$source_path" ]; then
		install -m 0755 "$source_path" "$INSTALL_DIR/update.sh"
		return
	fi

	if command -v curl >/dev/null 2>&1; then
		curl -fsSL https://raw.githubusercontent.com/J45k4/pupler/main/deploy/update.sh -o "$INSTALL_DIR/update.sh"
		chmod 0755 "$INSTALL_DIR/update.sh"
		return
	fi

	echo "Could not install update.sh: local file missing and curl unavailable." >&2
	exit 1
}

write_env_file() {
	cat >"$INSTALL_DIR/.env" <<EOF
PUPLER_MODE=${MODE}
PUPLER_INSTALL_DIR=${INSTALL_DIR}
PUPLER_SERVICE_NAME=${SERVICE_NAME}
PUPLER_PORT=${PUPLER_PORT}
PUPLER_BIND_ADDRESS=${PUPLER_BIND_ADDRESS}
PUPLER_DATA_DIR=${PUPLER_DATA_DIR}
EOF
}

mkdir -p "$INSTALL_DIR"
mkdir -p "$PUPLER_DATA_DIR"
write_env_file
install_update_script

case "$MODE" in
	docker)
		require_command docker
		require_command systemctl
		if ! docker compose version >/dev/null 2>&1; then
			echo "Docker Compose v2 is required (\`docker compose\`)." >&2
			exit 1
		fi

		IMAGE_REPO="${PUPLER_IMAGE_REPO:-jaska/pupler}"
		IMAGE_TAG="${PUPLER_IMAGE_TAG:-latest}"
		PUPLER_IMAGE="${PUPLER_IMAGE:-${IMAGE_REPO}:${IMAGE_TAG}}"
		PUPLER_VERSION="${PUPLER_VERSION:-${IMAGE_TAG}}"

		cat >"$INSTALL_DIR/compose.yaml" <<'EOF'
services:
  pupler:
    image: ${PUPLER_IMAGE:-ghcr.io/j45k4/pupler:latest}
    container_name: pupler
    restart: unless-stopped
    ports:
      - "${PUPLER_BIND_ADDRESS:-0.0.0.0}:${PUPLER_PORT:-5995}:5995"
    environment:
      PUPLER_VERSION: ${PUPLER_VERSION:-latest}
      PORT: "5995"
      DATA_PATH: ${DATA_PATH:-/data}
    volumes:
      - ${PUPLER_DATA_DIR:-./data}:/data
EOF

		cat >>"$INSTALL_DIR/.env" <<EOF
PUPLER_IMAGE=${PUPLER_IMAGE}
PUPLER_VERSION=${PUPLER_VERSION}
DATA_PATH=/data
EOF

		cat >/etc/systemd/system/${SERVICE_NAME}.service <<EOF
[Unit]
Description=Pupler container stack
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/docker compose up -d --remove-orphans
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

		systemctl daemon-reload
		systemctl enable --now "$SERVICE_NAME"

		echo "Pupler installed."
		echo "Mode: $MODE"
		echo "Install dir: $INSTALL_DIR"
		echo "Service: $SERVICE_NAME"
		echo "Image: $PUPLER_IMAGE"
		echo "Version: $PUPLER_VERSION"
		echo "Data dir: $PUPLER_DATA_DIR"
		echo "URL: http://${PUPLER_BIND_ADDRESS}:${PUPLER_PORT}"
		echo "Updater: $INSTALL_DIR/update.sh"
		;;
	bun-live)
		require_command systemctl
		require_command git

		SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
		DEFAULT_REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
		PUPLER_REPO_DIR="${PUPLER_REPO_DIR:-$DEFAULT_REPO_DIR}"
		if ! git -C "$PUPLER_REPO_DIR" rev-parse --show-toplevel >/dev/null 2>&1; then
			echo "bun-live mode requires a local Pupler checkout. Set PUPLER_REPO_DIR to the repo root." >&2
			exit 1
		fi
		PUPLER_REPO_DIR="$(git -C "$PUPLER_REPO_DIR" rev-parse --show-toplevel)"

		PUPLER_RUN_USER="${PUPLER_RUN_USER:-${SUDO_USER:-root}}"
		PUPLER_RUN_GROUP="${PUPLER_RUN_GROUP:-$(id -gn "$PUPLER_RUN_USER")}"
		PUPLER_BUN_BIN="${PUPLER_BUN_BIN:-}"
		if [ -z "$PUPLER_BUN_BIN" ]; then
			PUPLER_BUN_BIN="$(su - "$PUPLER_RUN_USER" -c 'command -v bun' 2>/dev/null || true)"
		fi
		if [ -z "$PUPLER_BUN_BIN" ]; then
			PUPLER_BUN_BIN="$(command -v bun 2>/dev/null || true)"
		fi
		if [ -z "$PUPLER_BUN_BIN" ]; then
			echo "Could not find bun. Install Bun or set PUPLER_BUN_BIN." >&2
			exit 1
		fi

		PUPLER_BUN_DIR="$(dirname "$PUPLER_BUN_BIN")"
		if ! su - "$PUPLER_RUN_USER" -c "export PATH='$PUPLER_BUN_DIR':\$PATH && cd '$PUPLER_REPO_DIR' && '$PUPLER_BUN_BIN' install"; then
			echo "bun install failed for $PUPLER_REPO_DIR" >&2
			exit 1
		fi

		mkdir -p "$PUPLER_DATA_DIR"
		chown -R "$PUPLER_RUN_USER:$PUPLER_RUN_GROUP" "$PUPLER_DATA_DIR"

		cat >>"$INSTALL_DIR/.env" <<EOF
PUPLER_REPO_DIR=${PUPLER_REPO_DIR}
PUPLER_RUN_USER=${PUPLER_RUN_USER}
PUPLER_RUN_GROUP=${PUPLER_RUN_GROUP}
PUPLER_BUN_BIN=${PUPLER_BUN_BIN}
EOF

		cat >/etc/systemd/system/${SERVICE_NAME}.service <<EOF
[Unit]
Description=Pupler Bun service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${PUPLER_REPO_DIR}
Environment=PORT=${PUPLER_PORT}
Environment=PUPLER_BIND_ADDRESS=${PUPLER_BIND_ADDRESS}
Environment=DATA_PATH=${PUPLER_DATA_DIR}
ExecStart=${PUPLER_BUN_BIN} src/main.ts
Restart=always
RestartSec=2
User=${PUPLER_RUN_USER}
Group=${PUPLER_RUN_GROUP}

[Install]
WantedBy=multi-user.target
EOF

		systemctl daemon-reload
		systemctl enable --now "$SERVICE_NAME"

		echo "Pupler installed."
		echo "Mode: $MODE"
		echo "Repo dir: $PUPLER_REPO_DIR"
		echo "Service: $SERVICE_NAME"
		echo "Run user: $PUPLER_RUN_USER"
		echo "Bun: $PUPLER_BUN_BIN"
		echo "Data dir: $PUPLER_DATA_DIR"
		echo "URL: http://${PUPLER_BIND_ADDRESS}:${PUPLER_PORT}"
		echo "Updater: $INSTALL_DIR/update.sh"
		;;
	*)
		echo "Unknown PUPLER_MODE: $MODE" >&2
		echo "Supported modes: docker, bun-live" >&2
		exit 1
		;;
esac
