#!/usr/bin/env bash
# Install a GitHub Release as a systemd user service, without Bun or a checkout.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/release.sh"
EXPLICIT_DATA_DIR="${PUPLER_DATA_DIR:-}"
release_init
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
if [[ ! -f $INSTALL_DIR/.env ]] && systemctl --user cat "$SERVICE_NAME" >/dev/null 2>&1 && [[ -z $EXPLICIT_DATA_DIR ]]; then
	fail "Existing service detected. Set PUPLER_DATA_DIR to its existing DATA_PATH (and preserve its port/bind settings) to migrate it."
fi
fetch_release
mkdir -p "$UNIT_DIR"
if [[ -f $UNIT_DIR/$SERVICE_NAME.service ]]; then
	cp -p "$UNIT_DIR/$SERVICE_NAME.service" "$INSTALL_DIR/previous-service-$(date +%s).service"
fi
if [[ ! -f $INSTALL_DIR/.env ]]; then
	umask 077
	printf 'PUPLER_INSTALL_DIR=%q\nPUPLER_SERVICE_NAME=%q\nPUPLER_DATA_DIR=%q\nPUPLER_PORT=%q\nPUPLER_BIND_ADDRESS=%q\nPUPLER_RELEASE_REPOSITORY=%q\n' "$INSTALL_DIR" "$SERVICE_NAME" "$DATA_DIR" "$PORT" "$BIND_ADDRESS" "$REPOSITORY" > "$INSTALL_DIR/.env"
fi
cat > "$UNIT_DIR/$SERVICE_NAME.service" <<UNIT
[Unit]
Description=Pupler release service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$DATA_DIR
Environment=NODE_ENV=production
Environment=DATA_PATH=$DATA_DIR
Environment=PORT=$PORT
Environment=BIND_ADDRESS=$BIND_ADDRESS
Environment=PUPLER_INSTALL_DIR=$INSTALL_DIR
Environment=PUPLER_RELEASE_REPOSITORY=$REPOSITORY
ExecStart=$INSTALL_DIR/current/pupler-server
Restart=on-failure
RestartSec=2

[Install]
WantedBy=default.target
UNIT
# Stable wrapper always uses the helper shipped with the active release.
cat > "$INSTALL_DIR/update.sh" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail
export PUPLER_INSTALL_DIR="$(cd "$(dirname "$0")" && pwd)"
exec bash "$PUPLER_INSTALL_DIR/current/service/update.sh" "$@"
WRAPPER
cat > "$INSTALL_DIR/backup.sh" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail
export PUPLER_INSTALL_DIR="$(cd "$(dirname "$0")" && pwd)"
exec bash "$PUPLER_INSTALL_DIR/current/service/backup.sh" "$@"
WRAPPER
chmod 0755 "$INSTALL_DIR/update.sh" "$INSTALL_DIR/backup.sh"
systemctl --user daemon-reload
systemctl --user enable "$SERVICE_NAME"
activate_release
if ! loginctl show-user "$USER" --property=Linger --value 2>/dev/null | grep -qx yes; then
	echo "For startup at boot and after logout, ask an administrator to run: loginctl enable-linger $USER"
fi
echo "Update: $INSTALL_DIR/update.sh"
echo "Full backup: $INSTALL_DIR/backup.sh"
echo "Create admin: DATA_PATH=$DATA_DIR $INSTALL_DIR/current/pupler-create-user --name Admin --username admin --password '<password>'"
