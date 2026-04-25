# pupler

Pupler is a service for managing stuff.

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
- [`deploy/pupler.service`](./deploy/pupler.service)
- [`deploy/pupler-bun.service`](./deploy/pupler-bun.service)

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
