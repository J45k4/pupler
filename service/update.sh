#!/usr/bin/env bash
#
# Update a user-service Pupler install. No root required.
# Reads $INSTALL_DIR/.env (defaults to ~/.pupler/.env).
#
#   ~/.pupler/update.sh
#   PUPLER_INSTALL_DIR=~/apps/pupler ~/.pupler/update.sh

set -euo pipefail

if [ "$(id -u)" -eq 0 ]; then
	echo "Run the user updater as your own user, not root." >&2
	exit 1
fi

INSTALL_DIR="${PUPLER_INSTALL_DIR:-$HOME/.pupler}"

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

SERVICE_NAME="${PUPLER_SERVICE_NAME:-pupler}"

require_command() {
	if ! command -v "$1" >/dev/null 2>&1; then
		echo "Missing required command: $1" >&2
		exit 1
	fi
}

require_command git
require_command systemctl

if [ -z "${PUPLER_REPO_DIR:-}" ] || [ ! -d "$PUPLER_REPO_DIR" ]; then
	echo "Missing or invalid PUPLER_REPO_DIR in $INSTALL_DIR/.env" >&2
	exit 1
fi
if [ -z "${PUPLER_BUN_BIN:-}" ]; then
	echo "Missing PUPLER_BUN_BIN in $INSTALL_DIR/.env" >&2
	exit 1
fi
PUPLER_BUN_DIR="$(dirname "$PUPLER_BUN_BIN")"
export PATH="$PUPLER_BUN_DIR:$PATH"
cd "$PUPLER_REPO_DIR" && git pull --ff-only && "$PUPLER_BUN_BIN" install
systemctl --user restart "$SERVICE_NAME"
systemctl --user --no-pager --full status "$SERVICE_NAME"

echo "Pupler updated (user service $SERVICE_NAME)."
