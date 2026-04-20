Pupler is a service for managing stuff

## Architecture

- Build with bun and Bun.serve using routes.
- Main entrypoint is in ./src/main.ts and web frontend is in ./src/web folder.

## Inventory CLI workflows

- Inventory item expiration dates are stored on `InventoryItem.expires_at`.
- Link inventory items with `bun ./cli/cli.ts inventory-items update <id> --product-id <product-id>`.
- Link receipt rows with `bun ./cli/cli.ts inventory-items update <id> --receipt-item-id <receipt-item-id>`.
- Clear nullable links or timestamps with `null`, for example `--product-id null` or `--expires-at null`.
