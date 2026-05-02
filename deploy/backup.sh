#!/usr/bin/env bash

set -euo pipefail

fail() {
	echo "backup.sh: $*" >&2
	exit 1
}

require_command() {
	if ! command -v "$1" >/dev/null 2>&1; then
		fail "Missing required command: $1"
	fi
}

is_truthy() {
	case "${1:-}" in
		1 | true | TRUE | yes | YES | y | Y) return 0 ;;
		*) return 1 ;;
	esac
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
INSTALL_DIR="${PUPLER_INSTALL_DIR:-/opt/pupler}"
ENV_FILE="${PUPLER_ENV_FILE:-${INSTALL_DIR}/.env}"

if [ -f "$ENV_FILE" ]; then
	set -a
	. "$ENV_FILE"
	set +a
fi

INSTALL_DIR="${PUPLER_INSTALL_DIR:-$INSTALL_DIR}"
SERVICE_NAME="${PUPLER_SERVICE_NAME:-pupler}"
DATA_DIR="${PUPLER_DATA_DIR:-${INSTALL_DIR}/data}"

if [ ! -f "${DATA_DIR}/pupler.db" ] && [ -f "${REPO_DIR}/pupler.db" ] && [ ! -f "$ENV_FILE" ]; then
	DATA_DIR="$REPO_DIR"
fi

DB_FILE="${PUPLER_DB_PATH:-${DATA_DIR}/pupler.db}"
FILES_DIR="${PUPLER_FILES_DIR:-${DATA_DIR}/files}"
BACKUP_DIR="${PUPLER_BACKUP_DIR:-${INSTALL_DIR}/backups}"
if [ "$DATA_DIR" = "$REPO_DIR" ] && [ -z "${PUPLER_BACKUP_DIR:-}" ]; then
	BACKUP_DIR="${REPO_DIR}/backups"
fi
BACKUP_KEEP="${PUPLER_BACKUP_KEEP:-14}"
STOP_SERVICE="${PUPLER_BACKUP_STOP_SERVICE:-0}"

case "$BACKUP_KEEP" in
	"" | *[!0-9]*) fail "PUPLER_BACKUP_KEEP must be a non-negative integer" ;;
esac

require_command date
require_command mktemp
require_command sqlite3
require_command tar

[ -f "$DB_FILE" ] || fail "Database not found: $DB_FILE"

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
ARCHIVE="${BACKUP_DIR}/pupler-backup-${TIMESTAMP}.tar.gz"
PARTIAL_ARCHIVE="${ARCHIVE}.tmp"
STAGING_DIR="$(mktemp -d "${TMPDIR:-/tmp}/pupler-backup.XXXXXX")"
SERVICE_STOPPED=0

cleanup() {
	local status=$?
	if [ "$SERVICE_STOPPED" -eq 1 ]; then
		systemctl start "$SERVICE_NAME" >/dev/null 2>&1 || true
	fi
	rm -rf "$STAGING_DIR"
	rm -f "$PARTIAL_ARCHIVE"
	exit "$status"
}
trap cleanup EXIT

if is_truthy "$STOP_SERVICE"; then
	require_command systemctl
	if systemctl is-active --quiet "$SERVICE_NAME"; then
		systemctl stop "$SERVICE_NAME"
		SERVICE_STOPPED=1
	fi
fi

mkdir -p "${STAGING_DIR}/data"

DB_BACKUP="${STAGING_DIR}/data/pupler.db"
sqlite3 "$DB_FILE" ".backup '${DB_BACKUP}'"
INTEGRITY_CHECK="$(sqlite3 "$DB_BACKUP" "PRAGMA integrity_check;")"
if [ "$INTEGRITY_CHECK" != "ok" ]; then
	fail "SQLite integrity check failed for backup: $INTEGRITY_CHECK"
fi

if [ -d "$FILES_DIR" ]; then
	cp -a "$FILES_DIR" "${STAGING_DIR}/data/files"
else
	mkdir -p "${STAGING_DIR}/data/files"
fi

cat >"${STAGING_DIR}/manifest.txt" <<EOF
created_at=${TIMESTAMP}
mode=${PUPLER_MODE:-local}
service_name=${SERVICE_NAME}
data_dir=${DATA_DIR}
db_file=${DB_FILE}
files_dir=${FILES_DIR}
EOF

tar -czf "$PARTIAL_ARCHIVE" -C "$STAGING_DIR" .
mv "$PARTIAL_ARCHIVE" "$ARCHIVE"

if [ "$BACKUP_KEEP" -gt 0 ]; then
	BACKUPS=()
	while IFS= read -r backup; do
		BACKUPS+=("$backup")
	done < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name "pupler-backup-*.tar.gz" | sort)

	BACKUP_COUNT="${#BACKUPS[@]}"
	if [ "$BACKUP_COUNT" -gt "$BACKUP_KEEP" ]; then
		REMOVE_COUNT=$((BACKUP_COUNT - BACKUP_KEEP))
		for ((i = 0; i < REMOVE_COUNT; i++)); do
			rm -f "${BACKUPS[$i]}"
		done
	fi
fi

echo "Pupler backup created: $ARCHIVE"
