#!/usr/bin/env bash
#
# Install Pupler as a systemd user service from a local checkout.
# No root, no Docker: just Bun + systemd --user.
#
#   ./service/install.sh
#
# Env overrides:
#   PUPLER_SERVICE_NAME=pupler  PUPLER_PORT=5995
#   PUPLER_BIND_ADDRESS=127.0.0.1
#   PUPLER_INSTALL_DIR=~/.pupler PUPLER_DATA_DIR=~/.pupler/data
#   PUPLER_REPO_DIR (defaults to this checkout)  PUPLER_BUN_BIN (auto-detected)
#
# Note: user services stop at logout unless lingering is enabled.
# This script tries `loginctl enable-linger` and warns when it lacks
# permission; ask an admin to run `loginctl enable-linger "$USER"` once
# for boot persistence.

set -euo pipefail

if [ "$(uname -s)" != "Linux" ]; then
	echo "User services are a Linux/systemd feature." >&2
	exit 1
fi

if [ "$(id -u)" -eq 0 ]; then
	echo "Do not run the user installer as root; run it as your own user." >&2
	exit 1
fi

require_command() {
	if ! command -v "$1" >/dev/null 2>&1; then
		echo "Missing required command: $1" >&2
		exit 1
	fi
}

SERVICE_NAME="${PUPLER_SERVICE_NAME:-pupler}"
PUPLER_PORT="${PUPLER_PORT:-5995}"
PUPLER_BIND_ADDRESS="${PUPLER_BIND_ADDRESS:-127.0.0.1}"
INSTALL_DIR="${PUPLER_INSTALL_DIR:-$HOME/.pupler}"
PUPLER_DATA_DIR="${PUPLER_DATA_DIR:-${INSTALL_DIR}/data}"
UNIT_DIR="$HOME/.config/systemd/user"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

require_command systemctl

mkdir -p "$INSTALL_DIR" "$PUPLER_DATA_DIR" "$UNIT_DIR"

cat >"$INSTALL_DIR/.env" <<EOF
PUPLER_INSTALL_DIR=${INSTALL_DIR}
PUPLER_SERVICE_NAME=${SERVICE_NAME}
PUPLER_PORT=${PUPLER_PORT}
PUPLER_BIND_ADDRESS=${PUPLER_BIND_ADDRESS}
PUPLER_DATA_DIR=${PUPLER_DATA_DIR}
EOF

require_command systemctl
require_command git

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PUPLER_REPO_DIR="${PUPLER_REPO_DIR:-$SCRIPT_DIR/..}"
if ! git -C "$PUPLER_REPO_DIR" rev-parse --show-toplevel >/dev/null 2>&1; then
	echo "Installer needs the Pupler checkout. Set PUPLER_REPO_DIR to the repo root." >&2
	exit 1
fi
PUPLER_REPO_DIR="$(git -C "$PUPLER_REPO_DIR" rev-parse --show-toplevel)"

PUPLER_BUN_BIN="${PUPLER_BUN_BIN:-$(command -v bun 2>/dev/null || true)}"
if [ -z "$PUPLER_BUN_BIN" ]; then
	echo "Could not find bun. Install Bun or set PUPLER_BUN_BIN." >&2
	exit 1
fi

if ! (cd "$PUPLER_REPO_DIR" && bun install); then
	echo "bun install failed for $PUPLER_REPO_DIR" >&2
	exit 1
fi

cat >>"$INSTALL_DIR/.env" <<EOF
PUPLER_REPO_DIR=${PUPLER_REPO_DIR}
PUPLER_BUN_BIN=${PUPLER_BUN_BIN}
EOF

sed -e "s|@PUPLER_REPO_DIR@|${PUPLER_REPO_DIR}|g" \
	-e "s|@PUPLER_PORT@|${PUPLER_PORT}|g" \
	-e "s|@PUPLER_DATA_DIR@|${PUPLER_DATA_DIR}|g" \
	-e "s|@PUPLER_BUN_BIN@|${PUPLER_BUN_BIN}|g" \
	"$SCRIPT_DIR/pupler-bun.service" >"$UNIT_DIR/${SERVICE_NAME}.service"

cp "$SCRIPT_DIR/update.sh" "$INSTALL_DIR/update.sh"
chmod 0755 "$INSTALL_DIR/update.sh"

systemctl --user daemon-reload
systemctl --user enable --now "$SERVICE_NAME"

if ! loginctl show-user "$USER" 2>/dev/null | grep -q '^Linger=yes'; then
	if loginctl enable-linger "$USER" 2>/dev/null; then
		echo "Lingering enabled: service persists after logout and at boot."
	else
		echo "NOTE: could not enable linger (needs admin once)." >&2
		echo "Ask an admin to run: loginctl enable-linger $USER" >&2
		echo "Until then the service stops when you log out." >&2
	fi
fi

echo "Pupler installed as user service."
echo "Install dir: $INSTALL_DIR"
echo "Service: $SERVICE_NAME (systemctl --user)"
echo "URL: http://${PUPLER_BIND_ADDRESS}:${PUPLER_PORT}"
echo "Updater: $INSTALL_DIR/update.sh"
