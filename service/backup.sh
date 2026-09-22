#!/usr/bin/env bash
# Full application backup: database, uploads, saved configuration, and unit.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/release.sh"
release_init
[[ -L $INSTALL_DIR/current && -f $INSTALL_DIR/.env ]] || fail "This is not a release installation."
[[ -f $DATA_DIR/pupler.db ]] || fail "Database not found: $DATA_DIR/pupler.db"
BACKUP_DIR="${PUPLER_BACKUP_DIR:-$DATA_DIR/backups}"
mkdir -p "$BACKUP_DIR"
STAGING=$(mktemp -d "${TMPDIR:-/tmp}/pupler-full-backup-XXXXXX")
ARCHIVE="$BACKUP_DIR/pupler-full-$(date -u +%Y%m%dT%H%M%SZ)-${STAGING##*-}.tar.gz"
RESTART_SERVICE=0
cleanup() {
	local status=$?
	trap - EXIT
	if [[ $RESTART_SERVICE == 1 ]]; then
		if ! systemctl --user start "$SERVICE_NAME"; then
			echo "Could not restart $SERVICE_NAME; run systemctl --user start $SERVICE_NAME" >&2
			status=1
		fi
	fi
	rm -rf "$STAGING"
	rm -f "$ARCHIVE.tmp"
	exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
STATE=$(systemctl --user show "$SERVICE_NAME" --property=ActiveState --value)
case "$STATE" in
	active|activating|reloading)
		RESTART_SERVICE=1
		systemctl --user stop "$SERVICE_NAME"
		;;
	inactive|failed) ;;
	*) fail "Service is changing state ($STATE); retry once it settles." ;;
esac
mkdir -p "$STAGING/data" "$STAGING/settings"
env -u DB_PATH DATA_PATH="$DATA_DIR" "$INSTALL_DIR/current/pupler-migrate" --backup-only "$STAGING/data/pupler.db"
if [[ -d $DATA_DIR/files ]]; then cp -aL "$DATA_DIR/files" "$STAGING/data/files"; fi
cp "$INSTALL_DIR/.env" "$STAGING/settings/install.env"
cp "$INSTALL_DIR/current/VERSION" "$STAGING/VERSION"
systemctl --user cat "$SERVICE_NAME" > "$STAGING/settings/pupler.service"
cat > "$STAGING/manifest.txt" <<MANIFEST
created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
service_name=$SERVICE_NAME
data_dir=$DATA_DIR
install_dir=$INSTALL_DIR
MANIFEST
# Resume as soon as the consistent snapshot has been captured, before compression.
if [[ $RESTART_SERVICE == 1 ]]; then
	systemctl --user start "$SERVICE_NAME"
	RESTART_SERVICE=0
fi
tar -czf "$ARCHIVE.tmp" -C "$STAGING" .
tar -tzf "$ARCHIVE.tmp" >/dev/null
mv "$ARCHIVE.tmp" "$ARCHIVE"
echo "Full backup created: $ARCHIVE"
