#!/usr/bin/env bash
#
# Remove a user-service Pupler install. No root required.
# Data is kept by default; pass --purge to delete it too.
#
#   ./service/uninstall.sh
#   ./service/uninstall.sh --purge

set -euo pipefail

if [ "$(id -u)" -eq 0 ]; then
	echo "Run the user uninstaller as your own user, not root." >&2
	exit 1
fi

PURGE=0
for arg in "$@"; do
	case "$arg" in
		--purge) PURGE=1 ;;
		*) echo "Unknown argument: $arg (only --purge)" >&2 && exit 1 ;;
	esac
done

INSTALL_DIR="${PUPLER_INSTALL_DIR:-$HOME/.pupler}"
SERVICE_NAME="${PUPLER_SERVICE_NAME:-pupler}"
UNIT_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user/${SERVICE_NAME}.service"

if [ -f "$INSTALL_DIR/.env" ]; then
	set -a
	. "$INSTALL_DIR/.env"
	set +a
	UNIT_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user/${PUPLER_SERVICE_NAME:-$SERVICE_NAME}.service"
	SERVICE_NAME="${PUPLER_SERVICE_NAME:-$SERVICE_NAME}"
fi

if systemctl --user list-unit-files 2>/dev/null | grep -q "^${SERVICE_NAME}.service"; then
	systemctl --user disable --now "$SERVICE_NAME" || true
fi
rm -f "$UNIT_FILE"
systemctl --user daemon-reload || true

if [ "$PURGE" -eq 1 ]; then
	rm -rf "$INSTALL_DIR"
	echo "Removed $INSTALL_DIR including data."
else
	echo "Kept data in $INSTALL_DIR (re-run with --purge to delete it)."
fi

echo "Pupler user service removed."
