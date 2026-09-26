# Release-based user service

Pupler releases include the server, web assets, SQLite migrations, CLI, and
admin-creation tool. The Linux service needs systemd, Bash, curl, tar, sha256sum,
and flock; it does not need Bun, Node, Git, or a source checkout.
Linux x64 releases target glibc 2.35+ (Ubuntu 22.04+); ARM64 releases target
Ubuntu 24.04+. macOS ARM64 and Windows x64 archives are also built, but these
service scripts are Linux-only. Linux binaries are smoke-tested in CI; the other
platforms are build-only until native runtime smoke tests are added.

## Publish

Push a version tag after committing the release changes:

```sh
git tag v1.0.0
git push origin v1.0.0
```

The GitHub Actions **Release Binaries** workflow builds all platforms, tests
Linux, and publishes archives and SHA-256 checksums to GitHub Releases. It can
also be dispatched with an existing tag. It creates a draft first, then publishes
after the uploads finish. Do not move published version tags or replace assets;
use a new tag for each change. There must be a successful release before the
installer can download anything.

## Fresh installation

Download the archive for your machine from
<https://github.com/J45k4/pupler/releases/latest>, along with its `.sha256` file.
For Linux x64, in a directory containing only those downloaded files:

```sh
sha256sum --check pupler-linux-x64.tar.gz.sha256
mkdir pupler-release
tar -xzf pupler-linux-x64.tar.gz -C pupler-release
bash pupler-release/service/install.sh
```

Use `pupler-linux-arm64.tar.gz` on ARM64. The installer downloads and verifies
the latest release again before installation. Set `PUPLER_RELEASE_VERSION=v1.0.0`
to install a specific tag instead.

Defaults: installation at `~/.pupler`, data at `~/.pupler/data`, service name
`pupler`, and listen address `127.0.0.1:5995`. Override at first installation with
`PUPLER_INSTALL_DIR`, `PUPLER_DATA_DIR`, `PUPLER_SERVICE_NAME`, `PUPLER_PORT`, and
`PUPLER_BIND_ADDRESS`. Saved settings in `.env` take precedence on later runs.
Installation paths must be absolute and contain no spaces or shell characters.
Run as the service user, without sudo.

Create the first administrator:

```sh
DATA_PATH="$HOME/.pupler/data" "$HOME/.pupler/current/pupler-create-user" \
  --name Admin --username admin --password 'choose-a-long-password'
```

Use your configured data path if different. For persistence after logout and
startup at boot, have an administrator enable lingering for the service user:
`loginctl enable-linger USER`.

## Move an existing checkout-based service

First inspect the unit with `systemctl --user cat pupler`. Preserve its actual
data directory, port, bind address, and any other custom settings. Stop here if
it has additional environment variables or overrides that need carrying over;
the installer backs up the unit file but generates a new release unit.

For the host using `/home/pupler/data`, run as user `pupler`:

```sh
PUPLER_DATA_DIR=/home/pupler/data \
PUPLER_BIND_ADDRESS=0.0.0.0 \
  bash pupler-release/service/install.sh
```

Use `127.0.0.1` instead if the service should only listen locally. An existing
installation without saved release settings requires an explicit data directory.
The Git checkout is left alone; future updates no longer pull from Git.
Databases previously managed with Prisma migrations reuse `_prisma_migrations`.
An existing database without that ledger is rejected and needs a deliberate
Prisma baseline before migration. Unresolved/modified migrations are rejected.

## HTTPS reverse proxy

When a reverse proxy terminates HTTPS, set `PUBLIC_ORIGIN` to the browser-facing
origin, including its scheme and any non-default port (for example,
`https://pupler.example.com`). Pupler uses this origin to validate browser
mutations, including login. Leave it unset for direct access; Pupler then uses
the request URL's origin. Forwarded headers do not change this check.

For a user service, run `systemctl --user edit pupler` and add:

```ini
[Service]
Environment=PUBLIC_ORIGIN=https://pupler.example.com
Environment=TRUSTED_PROXY_IPS=127.0.0.1
```

Then run `systemctl --user restart pupler`. The override survives release updates.
Set this on the server process; the installer's `~/.pupler/.env` is not loaded
as application environment. Invalid origins cause startup to fail.
Set `TRUSTED_PROXY_IPS` to the address Pupler sees for your reverse proxy; omit
it for direct access. The proxy must set or append the connecting client IP in
`X-Forwarded-For`. Pupler trusts that header only from listed proxies when
limiting public OAuth client registration to 20 requests per minute per IP.

## Update

Administrators on a release-based user service also see an update icon in the
top bar when a newer GitHub release is available. Press it to start the update
and follow download and installation progress. The updater runs in a separate
systemd user unit so it can restart Pupler. Status is saved in
`~/.pupler/update-status.json`, and detailed output in `~/.pupler/update.log`.
The icon is unavailable for a source checkout or legacy system service; use
the installation steps above to migrate those. The bottom-right version label
is visible to signed-in users.

```sh
~/.pupler/update.sh
# Or choose an exact release:
PUPLER_RELEASE_VERSION=v1.1.0 ~/.pupler/update.sh
```

The updater downloads the latest published release, verifies the checksum, checks
archive contents, and runs a binary preflight before stopping the service. It
backs up SQLite consistently under `DATA_PATH/backups`, applies pending
migrations, switches `current` to the new release, restarts, and checks HTTP
health. An already-installed version is a no-op. Configuration, database and
uploads remain outside the release directory. Previous releases are retained.
Checksums detect corrupted downloads; they are fetched from the same HTTPS
release and are not independent signatures.

If migration fails, the service remains stopped and the error identifies the
backup. If startup/health fails, inspect `journalctl --user -u pupler`. There is
no automatic database downgrade: restoring an older binary may also require
restoring its database backup while stopped. Backups and old releases are not
automatically pruned.

These scripts replace only the `service/` user-service flow. `deploy/` retains
its Docker and system-level source-install workflows.

## Manual full backup

After installing the release service, run:

```sh
~/.pupler/backup.sh
# Optional destination (no automatic pruning):
PUPLER_BACKUP_DIR=/path/to/backups ~/.pupler/backup.sh
```

The command creates `DATA_PATH/backups/pupler-full-TIMESTAMP-ID.tar.gz` containing:

- `data/pupler.db`: a SQLite snapshot with an integrity check
- `data/files/`: uploaded files, when present
- `settings/install.env`: saved installation settings
- `settings/pupler.service`: the unit and drop-ins reported by systemd
- `VERSION` and `manifest.txt`: release version and original paths

It shares the install/update lock, stops an active service while taking the
snapshot, then starts it again before compressing. It also attempts to restart
on failure. An already-stopped service stays stopped. Backup-only mode never
runs database migrations. Archives are owner-readable/writable only, do not
include older backups or downloaded binaries, and are not automatically deleted.
The command does not require a checkout, Bun, or the sqlite3 command-line tool.

To recover, extract the archive into a separate directory first and inspect it.
With the service stopped, restore `data/pupler.db` and `data/files/` into the
configured data directory, setting aside the old database and any `-wal`/`-shm`
sidecars together. Use `VERSION` to select the matching release. Review the
saved settings and unit before restoring them because paths may differ on
another machine. Keep the old data until the recovered service is verified.
