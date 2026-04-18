# pupler

Pupler is a service for managing stuff.

## Docker image

The container listens on port `5995` and stores its SQLite database at
`/data/pupler.db` inside the container. The image uses
`DATABASE_URL=file:/data/pupler.db` and runs `prisma migrate deploy`
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
- installs a `pupler` systemd service
- uses the image `jaska/pupler:latest`
- binds the service to `127.0.0.1:5995`

You can override those defaults:

```bash
curl -fsSL https://raw.githubusercontent.com/J45k4/pupler/main/deploy/install.sh | \
  sudo PUPLER_IMAGE=jaska/pupler:latest \
  PUPLER_BIND_ADDRESS=0.0.0.0 \
  PUPLER_PORT=5995 \
  bash
```

To update an existing install:

```bash
curl -fsSL https://raw.githubusercontent.com/J45k4/pupler/main/deploy/update.sh | sudo bash
```

Static deployment assets are also included in:

- [`deploy/compose.yaml`](./deploy/compose.yaml)
- [`deploy/pupler.service`](./deploy/pupler.service)

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
