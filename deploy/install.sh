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
IMAGE_REPO="${PUPLER_IMAGE_REPO:-ghcr.io/j45k4/pupler}"
IMAGE_TAG="${PUPLER_IMAGE_TAG:-latest}"
PUPLER_IMAGE="${PUPLER_IMAGE:-${IMAGE_REPO}:${IMAGE_TAG}}"
PUPLER_PORT="${PUPLER_PORT:-5995}"
PUPLER_BIND_ADDRESS="${PUPLER_BIND_ADDRESS:-127.0.0.1}"

mkdir -p "$INSTALL_DIR"

cat >"$INSTALL_DIR/compose.yaml" <<'EOF'
services:
  pupler:
    image: ${PUPLER_IMAGE:-ghcr.io/j45k4/pupler:latest}
    container_name: pupler
    restart: unless-stopped
    ports:
      - "${PUPLER_BIND_ADDRESS:-127.0.0.1}:${PUPLER_PORT:-5995}:5995"
    environment:
      APP_VERSION: ${PUPLER_IMAGE:-ghcr.io/j45k4/pupler:latest}
      PORT: "5995"
      DATABASE_URL: file:/data/pupler.db
    volumes:
      - pupler-data:/data

volumes:
  pupler-data:
EOF

if [ ! -f "$INSTALL_DIR/.env" ]; then
	cat >"$INSTALL_DIR/.env" <<EOF
PUPLER_IMAGE=${PUPLER_IMAGE}
PUPLER_PORT=${PUPLER_PORT}
PUPLER_BIND_ADDRESS=${PUPLER_BIND_ADDRESS}
EOF
fi

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
echo "Install dir: $INSTALL_DIR"
echo "Service: $SERVICE_NAME"
echo "Image: $PUPLER_IMAGE"
echo "URL: http://${PUPLER_BIND_ADDRESS}:${PUPLER_PORT}"
