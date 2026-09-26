# pupler

Pupler is a service for managing stuff.

## Codex and MCP receipt management

Pupler exposes a Streamable HTTP MCP server at `/mcp`. It supports OAuth browser
login and receipt management: product/group lookup, receipt creation with multiple
lines and an image, editing and deleting receipts/lines, and viewing or replacing
receipt images.

Apply migrations (`bun run prisma:migrate:deploy`) and restart the source server.
Release binaries embed the migration, and the release installer applies it.
Set `PUBLIC_ORIGIN=https://your-pupler-host` to the externally reachable origin.
The reverse proxy must forward `/mcp`, `/oauth/*`, `/.well-known/*`, and the
normal login, settings, and `/mcp/connections` routes to Pupler. Permit
image uploads up to 10 MiB.
Loopback HTTP works for local development; production requires an explicit origin.

Connect from Codex:

```sh
codex mcp add pupler --url https://your-pupler-host/mcp
codex mcp login pupler
```

Sign in with your Pupler username/password and approve the requested permissions.
Dynamic client registration and authorization code with PKCE S256 are supported.
Access tokens expire after 15 minutes; refresh tokens rotate and have a 30-day
absolute lifetime. Reusing an old refresh token revokes that connection.
Disconnect an app on the **MCP** page (`/mcp/connections`) to immediately revoke its
access, refresh tokens, and pending upload links. Normal browser logout ends the
browser session; connected apps stay connected until revoked or expired.

Permissions are `receipts:read`, `receipts:write`, `products:read`, and
`products:write`. Product creation is optional; importing lines that use existing
product IDs needs no product-write permission. Receipts and products retain
Pupler's existing shared access model across users.

For example, ask Codex: **“Import this receipt photo into Pupler with every line,
reuse matching products, and keep the original image.”** Codex can read the image
and submit its extracted fields. Pupler validates and stores the supplied data;
it does not run a separate OCR service. Unclear amounts or product matches should
be resolved before saving.

The image workflow transfers the original file bytes:

1. Call `prepare_receipt_image_upload` with a filename and MIME type.
2. From the machine holding the image, `PUT` the file bytes to the returned
   `upload_url`, for example `curl --fail --upload-file receipt.jpg "$UPLOAD_URL"`.
   Treat this URL as a secret. It expires after 15 minutes and accepts one upload.
3. Optionally call `get_uploaded_receipt_image` to inspect the image.
4. Pass its `image_id` to `create_receipt` or `replace_receipt_image` before expiry.

Codex must have access to the original image file to perform step 2. Seeing an
image in a chat does not guarantee its original bytes are available to tools;
provide a local file when needed. PNG, JPEG, GIF, WebP, and AVIF are accepted,
up to 10 MiB. Images stay private behind Pupler authentication. Abandoned uploads
expire and are cleaned up automatically.

Example `create_receipt` arguments:

```json
{
  "idempotency_key": "receipt-import-unique-id",
  "store_name": "Example shop",
  "purchased_at": "2026-09-26T12:30:00+03:00",
  "currency": "EUR",
  "total_amount": 5.0,
  "image_id": "returned-upload-image-id",
  "lines": [
    {
      "product_id": 123,
      "quantity": 2,
      "unit": "pcs",
      "unit_price": 2.5,
      "line_total": 5.0
    }
  ]
}
```

Each line supplies exactly one of `product_id` or `new_product`. A new product
requires `name`, `category`, and `is_perishable`; `barcode` and `default_unit` are
optional. Search products first to avoid duplicates. Receipt groups can be looked
up and supplied through `group_id`. Prices can be null when unknown, and negative
prices can represent discounts. The printed total is preserved and differences
from calculated line totals are reported. New receipts accept up to 300 lines.

The receipt, lines, any new products, and the image attachment commit together.
Reuse the same `idempotency_key` and arguments after a timeout; the original result
is returned without creating a duplicate. Keys are scoped to the OAuth connection.
`add_receipt_lines` also accepts an idempotency key. Deleting receipts/lines
unlinks their inventory references while preserving inventory items.

## Personal API keys and Puplerbar

In **Settings → API keys**, each user can create named keys for their account
and revoke them individually. The full key appears only when created; Pupler
stores its SHA-256 hash. Send keys as `Authorization: Bearer <key>` to use
the owner's existing API permissions. Keys remain valid until revoked or the
owning account is deleted. Creating, listing and revoking keys requires a
browser session through `/api/auth/api-keys` (GET/POST) and
`/api/auth/api-keys/:id` (DELETE).

Apply database migrations and restart Pupler before using API keys.
The [Puplerbar Omarchy plugin](./omarchy/README.md) shows the current timer
and provides a menu action to stop it using a personal API key.

## Docker image

The container listens on port `5995` and stores its SQLite database at
`/data/pupler.db` inside the container, with uploaded files stored under
`/data/files`. The image uses `DATA_PATH=/data` and runs `prisma migrate deploy`
automatically from `run.sh` before starting the server.

Build locally:

```bash
docker build -t pupler:local .
```

Run locally:

```bash
docker run --rm -p 5995:5995 -v pupler-data:/data pupler:local
```

## Release binaries and user service

Push a `v*` tag to build and publish standalone binaries with GitHub Actions.
The [release service installer and updater](./service/README.md) download
verified release archives; the server needs no Git checkout or Bun installation.
Web assets, migrations, CLI and admin creation are included, while database and
uploads stay in the configured data directory.

## Linux install

The repo includes a Linux bootstrap installer at
[`deploy/install.sh`](./deploy/install.sh) and an updater at
[`deploy/update.sh`](./deploy/update.sh). Both install modes expect `systemd`
and root access.

### Docker mode (default)

Docker mode expects Docker with the Compose v2 plugin.

Recommended command:

```bash
curl -fsSL https://raw.githubusercontent.com/J45k4/pupler/main/deploy/install.sh | sudo bash
```

By default the Docker installer:

- writes the deployment bundle to `/opt/pupler`
- installs `/opt/pupler/update.sh` for future updates
- installs a `pupler` systemd service
- uses the image `jaska/pupler:latest`
- binds the service to `0.0.0.0:5995`
- stores persistent data in a host bind mount at `/opt/pupler/data`

You can override those defaults:

```bash
curl -fsSL https://raw.githubusercontent.com/J45k4/pupler/main/deploy/install.sh | \
  sudo PUPLER_IMAGE=jaska/pupler:latest \
  PUPLER_PORT=5995 \
  PUPLER_DATA_DIR=/opt/pupler/data \
  bash
```

### Bun live mode

Bun live mode runs Pupler directly from the current checkout via systemd, so a
`git pull` in that repo affects what the service runs after restart/update.

Requirements:

- a local Pupler git checkout
- Bun installed for the run user
- `git`
- `systemd`
- root access

Recommended command from inside the cloned repo:

```bash
sudo PUPLER_MODE=bun-live ./deploy/install.sh
```

The installer will:

- detect the repo root and write it into the service `WorkingDirectory`
- run `bun install` in that checkout
- install `/opt/pupler/update.sh`
- install a systemd service that runs `bun src/main.ts`

Useful overrides:

```bash
sudo PUPLER_MODE=bun-live \
  PUPLER_RUN_USER=$USER \
  PUPLER_DATA_DIR=/var/lib/pupler \
  PUPLER_PORT=5995 \
  ./deploy/install.sh
```

If Bun is not on the default login shell path, set it explicitly:

```bash
sudo PUPLER_MODE=bun-live \
  PUPLER_BUN_BIN=/home/you/.bun/bin/bun \
  ./deploy/install.sh
```

### Updating an existing install

For either mode:

```bash
sudo /opt/pupler/update.sh
```

The updater uses the installed `.env` file to decide whether to pull a Docker
image or update the live checkout and restart the service.

Static deployment assets are also included in:

- [`deploy/compose.yaml`](./deploy/compose.yaml)
- [`deploy/backup.sh`](./deploy/backup.sh)
- [`deploy/pupler.service`](./deploy/pupler.service)
- [`deploy/pupler-bun.service`](./deploy/pupler-bun.service)

### Backups

The installer writes a backup script to `/opt/pupler/backup.sh`.

```bash
sudo /opt/pupler/backup.sh
```

The script creates a timestamped `pupler-backup-*.tar.gz` archive containing a
consistent SQLite backup plus uploaded files. It reads `/opt/pupler/.env` by
default, stores archives in `/opt/pupler/backups`, and keeps the latest 14
archives. Configure it with:

- `PUPLER_BACKUP_DIR=/path/to/backups`
- `PUPLER_BACKUP_KEEP=30`
- `PUPLER_BACKUP_STOP_SERVICE=1` to stop the systemd service while files are copied

For a local checkout, run:

```bash
bun run backup
```

## Data paths

Pupler resolves its SQLite location in this order:

- explicit server `dbPath` override
- `DB_PATH`
- `DATA_PATH/pupler.db`
- fallback `./pupler.db`

Uploaded files are stored in:

- `DATA_PATH/files` when `DATA_PATH` is set
- otherwise a sibling `files/` directory next to the resolved SQLite file

## CLI receipt repair

The CLI already supports partial updates and deletes for receipts and receipt
items, which makes OCR cleanup and manual corrections much easier.

Examples:

```bash
# List the items on one receipt
bun ./cli/cli.ts receipt-items list --receipt-id 1

# Fix a receipt total or store name
bun ./cli/cli.ts receipts update 1 --store-name "K-Citymarket" --total-amount 61.12

# Fix one receipt item
bun ./cli/cli.ts receipt-items update 17 --product-id 42 --quantity 1.038 --line-total 1.92

# Remove a mistaken receipt item
bun ./cli/cli.ts receipt-items delete 17
```

## CLI inventory item linking

Inventory items can be linked to products and receipt line items. This is useful
when an item was created manually and later needs to point at the product catalog
or the original receipt row.

Find the IDs first:

```bash
bun ./cli/cli.ts products list --name Milk
bun ./cli/cli.ts receipt-items list --receipt-id 1
bun ./cli/cli.ts inventory-items list --name Milk
```

Link an inventory item to a product or receipt item:

```bash
bun ./cli/cli.ts inventory-items update 7 --product-id 42
bun ./cli/cli.ts inventory-items update 7 --receipt-item-id 17
```

Link both in one update:

```bash
bun ./cli/cli.ts inventory-items update 7 --product-id 42 --receipt-item-id 17
```

Clear links by passing `null` to nullable fields:

```bash
bun ./cli/cli.ts inventory-items update 7 --product-id null
bun ./cli/cli.ts inventory-items update 7 --receipt-item-id null
```

Expiration dates also live on inventory items:

```bash
bun ./cli/cli.ts inventory-items update 7 --expires-at 2026-05-01T00:00:00.000Z
bun ./cli/cli.ts inventory-items update 7 --expires-at null
```
