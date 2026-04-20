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
[`deploy/update.sh`](./deploy/update.sh). They expect:

- Docker with the Compose v2 plugin
- `systemd`
- root access

Recommended command:

```bash
curl -fsSL https://raw.githubusercontent.com/J45k4/pupler/main/deploy/install.sh | sudo bash
```

By default the installer:

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

To update an existing install:

```bash
sudo /opt/pupler/update.sh
```

You can still run the updater directly from GitHub if needed:

```bash
curl -fsSL https://raw.githubusercontent.com/J45k4/pupler/main/deploy/update.sh | sudo bash
```

Static deployment assets are also included in:

- [`deploy/compose.yaml`](./deploy/compose.yaml)
- [`deploy/pupler.service`](./deploy/pupler.service)

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
