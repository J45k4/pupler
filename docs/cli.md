# CLI

## Receipt repair

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
