# pupler

Pupler is a service for managing stuff.

## Docker image

The container listens on port `5995` and stores its SQLite database at
`/data/pupler.db` inside the container. The image uses
`DATABASE_URL=file:/data/pupler.db`.

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
[deploy/install.sh](/Users/puppy/work/my/pupler/deploy/install.sh). It expects:

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
- uses the image `ghcr.io/j45k4/pupler:latest`
- binds the service to `127.0.0.1:5995`

You can override those defaults:

```bash
curl -fsSL https://raw.githubusercontent.com/J45k4/pupler/main/deploy/install.sh | \
  sudo PUPLER_IMAGE=ghcr.io/j45k4/pupler:latest \
  PUPLER_BIND_ADDRESS=0.0.0.0 \
  PUPLER_PORT=5995 \
  bash
```

Static deployment assets are also included in:

- [deploy/compose.yaml](/Users/puppy/work/my/pupler/deploy/compose.yaml)
- [deploy/pupler.service](/Users/puppy/work/my/pupler/deploy/pupler.service)
