#!/usr/bin/env bash
# Runs as a separate user unit so Pupler can stop and restart during an update.
set -euo pipefail

[[ ${PUPLER_UPDATE_STATUS_PATH:-} == "${PUPLER_INSTALL_DIR:-}/update-status.json" ]] || exit 1
LOG="$PUPLER_INSTALL_DIR/update.log"
if bash "$PUPLER_INSTALL_DIR/update.sh" > "$LOG" 2>&1; then
	printf '{"phase":"complete","progress":100,"tag":"%s","message":"Update complete"}\n' "$PUPLER_RELEASE_VERSION" > "$PUPLER_UPDATE_STATUS_PATH"
else
	printf '{"phase":"failed","progress":0,"tag":"%s","message":"Update failed; check update.log"}\n' "$PUPLER_RELEASE_VERSION" > "$PUPLER_UPDATE_STATUS_PATH"
	exit 1
fi
