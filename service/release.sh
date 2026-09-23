#!/usr/bin/env bash
# Shared release operations; sourced by install.sh and update.sh.
set -euo pipefail

fail() { echo "$*" >&2; exit 1; }
require_command() { command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"; }

update_stage() {
	[[ -n ${PUPLER_UPDATE_STATUS_PATH:-} ]] || return 0
	local temporary="${PUPLER_UPDATE_STATUS_PATH}.tmp.$$"
	printf '{"phase":"%s","progress":%s,"tag":"%s","message":"%s"}\n' "$1" "$2" "${TAG:-}" "$3" > "$temporary"
	mv -f "$temporary" "$PUPLER_UPDATE_STATUS_PATH"
}

release_init() {
	umask 077
	[[ $(uname -s) == Linux ]] || fail "The service installer supports Linux only."
	[[ $(id -u) != 0 ]] || fail "Run this as the service user, not root."
	for command in curl tar sha256sum systemctl flock; do require_command "$command"; done
	INSTALL_DIR="${PUPLER_INSTALL_DIR:-$HOME/.pupler}"
	[[ $INSTALL_DIR =~ ^/[a-zA-Z0-9_./-]+$ ]] || fail "Use an absolute install path without spaces or shell characters."
	mkdir -p "$INSTALL_DIR"
	exec 9>"$INSTALL_DIR/.release.lock"
	flock -n 9 || fail "Another installation, update, or backup is running."
	REQUESTED_VERSION="${PUPLER_RELEASE_VERSION:-latest}"
	if [[ -f $INSTALL_DIR/.env ]]; then source "$INSTALL_DIR/.env"; fi
	SERVICE_NAME="${PUPLER_SERVICE_NAME:-pupler}"
	DATA_DIR="${PUPLER_DATA_DIR:-$INSTALL_DIR/data}"
	PORT="${PUPLER_PORT:-5995}"
	BIND_ADDRESS="${PUPLER_BIND_ADDRESS:-127.0.0.1}"
	REPOSITORY="${PUPLER_RELEASE_REPOSITORY:-J45k4/pupler}"
	[[ $SERVICE_NAME =~ ^[a-zA-Z0-9_-]+$ ]] || fail "Invalid service name"
	[[ $DATA_DIR =~ ^/[a-zA-Z0-9_./-]+$ ]] || fail "Use an absolute data path without spaces or shell characters."
	[[ $PORT =~ ^[0-9]+$ && $PORT -ge 1 && $PORT -le 65535 ]] || fail "Invalid port"
	[[ $BIND_ADDRESS =~ ^[a-zA-Z0-9.:_-]+$ ]] || fail "Invalid bind address"
	[[ $REPOSITORY =~ ^[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+$ ]] || fail "Invalid release repository"
	mkdir -p "$INSTALL_DIR/releases" "$DATA_DIR"
}

fetch_release() {
	case $(uname -m) in
		x86_64) ARCH=x64 ;;
		aarch64|arm64) ARCH=arm64 ;;
		*) fail "Unsupported architecture: $(uname -m)" ;;
	esac
	TAG="$REQUESTED_VERSION"
	if [[ $TAG == latest ]]; then
		URL=$(curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --output /dev/null --write-out '%{url_effective}' "https://github.com/$REPOSITORY/releases/latest")
		TAG="${URL##*/}"
	fi
	[[ $TAG =~ ^v[0-9][a-zA-Z0-9._-]*$ ]] || fail "Expected a release tag such as v1.0.0; got $TAG"
	ASSET="pupler-linux-$ARCH.tar.gz"
	STAGING=$(mktemp -d "$INSTALL_DIR/releases/.download-XXXXXX")
	trap 'rm -rf "${STAGING:-}"' EXIT
	BASE="https://github.com/$REPOSITORY/releases/download/$TAG"
	update_stage downloading 0 "Downloading $TAG"
	for file in "$ASSET" "$ASSET.sha256"; do
		if [[ -n ${PUPLER_UPDATE_STATUS_PATH:-} && $file == "$ASSET" ]]; then
			curl --fail --show-error --progress-bar --location --retry 3 --proto '=https' --proto-redir '=https' "$BASE/$file" --output "$STAGING/$file" 2> "$INSTALL_DIR/update-download.progress"
		else
			curl --fail --silent --show-error --location --retry 3 --proto '=https' --proto-redir '=https' "$BASE/$file" --output "$STAGING/$file"
		fi
	done
	update_stage verifying 55 "Verifying release archive"
	# Only accept a digest for this archive, never arbitrary checksum file paths.
	read -r DIGEST CHECKSUM_FILE < "$STAGING/$ASSET.sha256"
	[[ $DIGEST =~ ^[a-fA-F0-9]{64}$ && $CHECKSUM_FILE == "$ASSET" ]] || fail "Invalid checksum file"
	printf '%s  %s\n' "$DIGEST" "$STAGING/$ASSET" | sha256sum --check --status || fail "Release checksum mismatch"
	tar -tzf "$STAGING/$ASSET" > "$STAGING/entries"
	while IFS= read -r entry; do
		case "$entry" in
			./|./service/|./VERSION|./pupler-server|./pupler-cli|./pupler-migrate|./pupler-create-user|./service/install.sh|./service/update.sh|./service/web-update.sh|./service/release.sh|./service/uninstall.sh|./service/README.md|./service/backup.sh) ;;
			*) fail "Unexpected archive entry: $entry" ;;
		esac
	done < "$STAGING/entries"
	tar -tvzf "$STAGING/$ASSET" > "$STAGING/types"
	while IFS= read -r entry; do
		[[ $entry == -* || $entry == d* ]] || fail "Release archive contains a link or special file"
	done < "$STAGING/types"
	mkdir "$STAGING/release"
	tar -xzf "$STAGING/$ASSET" -C "$STAGING/release" --no-same-owner --no-same-permissions
	[[ $(cat "$STAGING/release/VERSION") == "$TAG" ]] || fail "Release version does not match tag"
	for binary in pupler-server pupler-cli pupler-migrate pupler-create-user; do
		[[ -f $STAGING/release/$binary ]] || fail "Missing release binary: $binary"
		chmod 0755 "$STAGING/release/$binary"
	done
	for script in install update web-update release uninstall backup; do
		[[ -f $STAGING/release/service/$script.sh ]] || fail "Missing service script: $script"
	done
	# Runs before touching the service, catching unsupported binaries/libraries.
	"$STAGING/release/pupler-cli" --help >/dev/null
	RELEASE_DIR="$INSTALL_DIR/releases/$TAG-$(date +%s)-$$"
	mv "$STAGING/release" "$RELEASE_DIR"
}

activate_release() {
	BACKUP="$DATA_DIR/backups/before-$TAG-$(date +%s).db"
	update_stage backing_up 65 "Backing up database"
	systemctl --user stop "$SERVICE_NAME"
	update_stage migrating 75 "Applying migrations"
	if ! env -u DB_PATH DATA_PATH="$DATA_DIR" "$RELEASE_DIR/pupler-migrate" --backup "$BACKUP"; then
		fail "Migration failed; service remains stopped. Inspect the error. Database backup (if created): $BACKUP"
	fi
	ln -s "$RELEASE_DIR" "$INSTALL_DIR/.current-$$"
	mv -Tf "$INSTALL_DIR/.current-$$" "$INSTALL_DIR/current"
	update_stage restarting 90 "Restarting Pupler"
	systemctl --user restart "$SERVICE_NAME"
	HEALTH_HOST="$BIND_ADDRESS"
	[[ $HEALTH_HOST != 0.0.0.0 ]] || HEALTH_HOST=127.0.0.1
	[[ $HEALTH_HOST != :: ]] || HEALTH_HOST=::1
	[[ $HEALTH_HOST != *:* ]] || HEALTH_HOST="[$HEALTH_HOST]"
	for attempt in {1..30}; do
		if systemctl --user is-active --quiet "$SERVICE_NAME" && curl --noproxy '*' --fail --silent --max-time 2 "http://$HEALTH_HOST:$PORT/health" >/dev/null; then
			update_stage complete 100 "Pupler $TAG is running"
			echo "Pupler $TAG is running. Data: $DATA_DIR"
			return
		fi
		sleep 1
	done
	fail "Release installed but health check failed. Inspect journalctl --user -u $SERVICE_NAME. Previous releases and database backup are retained."
}
