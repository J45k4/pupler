# MCP integration

Pupler exposes a Streamable HTTP MCP server at `/mcp`. It supports OAuth browser
login and receipt management: product/group lookup, receipt creation with multiple
lines and an image, editing and deleting receipts/lines, and viewing or replacing
receipt images. Inventory tools find, add, edit, consume and delete inventory items
and organize them in containers. Shopping list tools list accessible lists and items, add and edit
items, remove or restore items, create or rename lists, and manage sharing.

Apply migrations (`bun run prisma:migrate:deploy`) and restart the source server.
Release binaries embed the migration, and the release installer applies it.
Set `PUBLIC_ORIGIN=https://your-pupler-host` to the externally reachable origin.
The reverse proxy must forward `/mcp`, `/oauth/*`, `/.well-known/*`, and the
normal login, settings, and `/mcp/connections` routes to Pupler. Permit
image uploads up to 10 MiB.
Loopback HTTP works for local development; production requires an explicit origin.
OAuth client registration is limited to 20 requests per minute per source IP.
Behind a reverse proxy, set `TRUSTED_PROXY_IPS` to the proxy's IP address so
Pupler can use the client IP from `X-Forwarded-For`. Only list proxies that set
or append the real connecting address in that header.

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

Permissions are `receipts:read`, `receipts:write`, `products:read`,
`products:write`, `inventory:read`, `inventory:write`, `shopping_lists:read`, and
`shopping_lists:write`. Product
creation is optional; importing lines that use existing product IDs needs no
product-write permission. Receipts, products and inventory retain
Pupler's existing shared access model across users. Shopping lists are visible
only to their members; viewers can read, while editors can change lists, items,
and sharing. Existing MCP connections must be reauthorized to gain the new scopes.

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

## Shopping list tools

`list_shopping_lists` returns only lists that include the connected user. It and
`list_shopping_list_items` return pages with `next_before_id`. Item listing shows
active items by default; set `removed` to `removed` or `all` to see hidden items.
The optional `done` filter selects bought or unbought items.

- Lists: `list_shopping_lists`, `get_shopping_list`, `create_shopping_list`,
  `rename_shopping_list`, `delete_shopping_list`.
- Items: `list_shopping_list_items`, `get_shopping_list_item`,
  `create_shopping_list_item`, `update_shopping_list_item`,
  `remove_shopping_list_item`, `restore_shopping_list_item`.
- Sharing: `list_shopping_list_members`, `share_shopping_list`,
  `set_shopping_list_member_role`, `remove_shopping_list_member`.

Reading requires `shopping_lists:read` and membership in the list. Changes
require `shopping_lists:write` and the `editor` role for an existing list.
`remove_shopping_list_item` hides an item but preserves it for restoration;
`delete_shopping_list` permanently deletes the list and its items.

## Inventory tools

- Items: `list_inventory_items`, `get_inventory_item`, `create_inventory_item`,
  `update_inventory_item`, `consume_inventory_item`, `delete_inventory_item`.
- Containers: `list_inventory_containers`, `get_inventory_container`,
  `create_inventory_container`, `update_inventory_container`,
  `delete_inventory_container`.

Reading requires `inventory:read`; changes require `inventory:write`.
`list_inventory_items` shows unconsumed items by default; set `status` to
`consumed` or `all` to include used items. Filter by `query`, `container_id`
(`null` for unassigned items), `product_id`, or `ingredient_id`.
`consume_inventory_item` marks an item consumed, or reduces its quantity when a
smaller `quantity` is given. Deleting a container keeps its items and child
containers, which become unassigned or top-level. Container moves that would
create a cycle are rejected. Timestamps use ISO 8601 with an offset.

Security and integration test coverage is described in [Testing](testing.md).
