#!/usr/bin/env bash
# Download and activate the latest stable release, or PUPLER_RELEASE_VERSION.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/release.sh"
release_init
[[ -L $INSTALL_DIR/current ]] || fail "This is not a release installation. Run service/install.sh once with your existing data directory."
fetch_release
if [[ $(cat "$INSTALL_DIR/current/VERSION") == "$TAG" ]]; then
	rm -rf "$RELEASE_DIR"
	echo "Pupler $TAG is already installed."
	exit 0
fi
activate_release
