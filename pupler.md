# Pupler

Puppy butler service.

## Feature

| Feature              | Notes                                                                                                                                                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manage food items    | When new food items are added store metdata to it to database like expiration date and links to foods.                                                                                                                                              |
| Manage food recepies | Collect list of good receipts that household likes and what food items these receipts need and how much. Use this information to automatically generate food menu. Try to optimize food menu so that incredients can be shared as much of possible. |
| Manage items         | Manage what items there are when they are bought and their receipts.                                                                                                                                                                                |
| Shoppinglist         | Automaticaly generate shoppinglists for based of menu like what items are needed also consider expiration dates of food items.                                                                                                                      |

## Server implementation

Uses [Bun](https://bun.com/docs) with bun routes like

```
Bun.serve({
  port: 5995,
  routes: {
    "/api/products" => {
      POST: () => new Response("ok")
    }
  }
})
```

- see how to use at: https://bun.com/docs/runtime/http/server.md
- entrypoint is ./src/main.ts
- inline routes into the `Bun.serve` route map
- persistence uses SQLite through Prisma
- Prisma schema lives in `./prisma/schema.prisma`
- generated Prisma client lives in `./src/generated/prisma`
- database path still comes from `DB_PATH` and defaults to `pupler.db`
- the app does not run migrations or schema sync on startup
- apply schema changes manually with Prisma CLI before running the server

## CLI

There should be internal Bun CLI in folder `./cli`.

- run with `bun ./cli/cli.ts ...`
- or via package script `bun run cli -- ...`
- CLI should call the existing HTTP API, not open SQLite directly
- default server URL comes from `PUPLER_BASE_URL` or `http://localhost:5995`
- support human-readable output by default and `--json` for scripting

Examples:

```sh
bun ./cli/cli.ts products list --barcode 6414893400012
bun ./cli/cli.ts products create --name Milk --category food --is-perishable true
bun ./cli/cli.ts receipts create --store-name Prisma --purchased-at 2026-04-14T08:00:00Z --currency EUR
bun ./cli/cli.ts receipt-items create --receipt-id 1 --product-id 2 --quantity 1 --unit pcs
```

### Migrations

Prisma owns the database schema now.

- schema source of truth is `./prisma/schema.prisma`
- baseline SQL snapshot lives under `./prisma/migrations`
- run `bun run prisma:generate` after schema changes so the generated client stays in sync
- use `bun run prisma:migrate:dev`, `bun run prisma:migrate:deploy`, or `bun run prisma:db:push` manually when you want to change the database

## API

### products

Base resource: `/api/products`

| Method | Path                | Purpose                  |
| ------ | ------------------- | ------------------------ |
| GET    | `/api/products`     | List products            |
| GET    | `/api/products/:id` | Fetch one product by id  |
| POST   | `/api/products`     | Create product           |
| PUT    | `/api/products/:id` | Replace product          |
| PATCH  | `/api/products/:id` | Update part of a product |
| DELETE | `/api/products/:id` | Delete product           |

Product payload fields:

| Field         | Type      | Notes            |
| ------------- | --------- | ---------------- |
| id            | BIGINT    | Server generated |
| name          | string    | Required         |
| category      | string    | Required         |
| barcode       | string    | Optional, unique |
| default_unit  | string    | Optional         |
| is_perishable | boolean   | Required         |
| created_at    | timestamp | Server generated |
| updated_at    | timestamp | Server generated |

Example create body:

```json
{p
	"name": "Milk",
	"category": "food",
	"barcode": "6414893400012",
	"default_unit": "pcs",
	"is_perishable": true
}
```

Notes:

| Topic          | Behavior                                                                         |
| -------------- | -------------------------------------------------------------------------------- |
| List filtering | Support filtering by `category`, `is_perishable`, and `barcode`                  |
| List sorting   | Default sort by `name ASC`                                                       |
| Validation     | Reject duplicate `barcode` values                                                |
| Delete         | Reject delete if product is still referenced, or use soft delete later if needed |

### product_links

Base resource: `/api/product-links`

| Method | Path                     | Purpose                       |
| ------ | ------------------------ | ----------------------------- |
| GET    | `/api/product-links`     | List product links            |
| GET    | `/api/product-links/:id` | Fetch one product link by id  |
| POST   | `/api/product-links`     | Create product link           |
| PUT    | `/api/product-links/:id` | Replace product link          |
| PATCH  | `/api/product-links/:id` | Update part of a product link |
| DELETE | `/api/product-links/:id` | Delete product link           |

Product link payload fields:

| Field      | Type      | Notes            |
| ---------- | --------- | ---------------- |
| id         | BIGINT    | Server generated |
| product_id | BIGINT    | Required         |
| label      | string    | Required         |
| url        | string    | Required         |
| created_at | timestamp | Server generated |

### receipts

Base resource: `/api/receipts`

| Method | Path                | Purpose                  |
| ------ | ------------------- | ------------------------ |
| GET    | `/api/receipts`     | List receipts            |
| GET    | `/api/receipts/:id` | Fetch one receipt by id  |
| POST   | `/api/receipts`     | Create receipt           |
| PUT    | `/api/receipts/:id` | Replace receipt          |
| PATCH  | `/api/receipts/:id` | Update part of a receipt |
| DELETE | `/api/receipts/:id` | Delete receipt           |

Receipt payload fields:

| Field        | Type      | Notes                   |
| ------------ | --------- | ----------------------- |
| id           | BIGINT    | Server generated        |
| store_name   | string    | Required                |
| purchased_at | timestamp | Required                |
| currency     | string    | Required, ISO 4217 code |
| total_amount | decimal   | Optional                |
| created_at   | timestamp | Server generated        |
| updated_at   | timestamp | Server generated        |

### receipt_items

Base resource: `/api/receipt-items`

| Method | Path                     | Purpose                       |
| ------ | ------------------------ | ----------------------------- |
| GET    | `/api/receipt-items`     | List receipt items            |
| GET    | `/api/receipt-items/:id` | Fetch one receipt item by id  |
| POST   | `/api/receipt-items`     | Create receipt item           |
| PUT    | `/api/receipt-items/:id` | Replace receipt item          |
| PATCH  | `/api/receipt-items/:id` | Update part of a receipt item |
| DELETE | `/api/receipt-items/:id` | Delete receipt item           |

Receipt item payload fields:

| Field      | Type      | Notes            |
| ---------- | --------- | ---------------- |
| id         | BIGINT    | Server generated |
| receipt_id | BIGINT    | Required         |
| product_id | BIGINT    | Required         |
| quantity   | decimal   | Required         |
| unit       | string    | Required         |
| unit_price | decimal   | Optional         |
| line_total | decimal   | Optional         |
| created_at | timestamp | Server generated |

### inventory_containers

Base resource: `/api/inventory-containers`

| Method | Path                            | Purpose                               |
| ------ | ------------------------------- | ------------------------------------- |
| GET    | `/api/inventory-containers`     | List inventory containers             |
| GET    | `/api/inventory-containers/:id` | Fetch one inventory container by id   |
| POST   | `/api/inventory-containers`     | Create inventory container            |
| PUT    | `/api/inventory-containers/:id` | Replace inventory container           |
| PATCH  | `/api/inventory-containers/:id` | Update part of an inventory container |
| DELETE | `/api/inventory-containers/:id` | Delete inventory container            |

Inventory container payload fields:

| Field               | Type      | Notes                                 |
| ------------------- | --------- | ------------------------------------- |
| id                  | BIGINT    | Server generated                      |
| name                | string    | Required                              |
| parent_container_id | BIGINT    | Optional, points to another container |
| notes               | string    | Optional                              |
| created_at          | timestamp | Server generated                      |
| updated_at          | timestamp | Server generated                      |

Delete behavior:

- child containers become top-level by setting `parent_container_id = null`
- inventory items inside the deleted container become unassigned by setting `container_id = null`

Inventory web UI:

- the `/inventory` page manages containers and active inventory in one drag-and-drop tree
- new containers are created from the root-level `Add Container` modal
- each container has an `Open` action that leads to a container detail page for editing metadata
- containers can be nested by dragging them under other containers
- inventory items and containers share one root drop area, and dragging into the open space returns them to the top level

### inventory_items

Base resource: `/api/inventory-items`

| Method | Path                       | Purpose                          |
| ------ | -------------------------- | -------------------------------- |
| GET    | `/api/inventory-items`     | List inventory items             |
| GET    | `/api/inventory-items/:id` | Fetch one inventory item by id   |
| POST   | `/api/inventory-items`     | Create inventory item            |
| PUT    | `/api/inventory-items/:id` | Replace inventory item           |
| PATCH  | `/api/inventory-items/:id` | Update part of an inventory item |
| DELETE | `/api/inventory-items/:id` | Delete inventory item            |

Inventory item payload fields:

| Field           | Type      | Notes            |
| --------------- | --------- | ---------------- |
| id              | BIGINT    | Server generated |
| product_id      | BIGINT    | Required         |
| receipt_item_id | BIGINT    | Optional         |
| container_id    | BIGINT    | Optional         |
| quantity        | decimal   | Required         |
| unit            | string    | Required         |
| purchased_at    | timestamp | Optional         |
| expires_at      | timestamp | Optional         |
| consumed_at     | timestamp | Optional         |
| notes           | string    | Optional         |
| created_at      | timestamp | Server generated |
| updated_at      | timestamp | Server generated |

### recipes

Base resource: `/api/recipes`

| Method | Path               | Purpose                 |
| ------ | ------------------ | ----------------------- |
| GET    | `/api/recipes`     | List recipes            |
| GET    | `/api/recipes/:id` | Fetch one recipe by id  |
| POST   | `/api/recipes`     | Create recipe           |
| PUT    | `/api/recipes/:id` | Replace recipe          |
| PATCH  | `/api/recipes/:id` | Update part of a recipe |
| DELETE | `/api/recipes/:id` | Delete recipe           |
| POST   | `/api/recipes/:id/pictures` | Upload one or more recipe images |
| GET    | `/api/recipes/:id/pictures` | List recipe image metadata |
| GET    | `/api/recipes/:id/pictures/:pictureId` | Fetch one recipe image |
| DELETE | `/api/recipes/:id/pictures/:pictureId` | Remove one recipe image |

Recipe payload fields:

| Field        | Type      | Notes            |
| ------------ | --------- | ---------------- |
| id           | BIGINT    | Server generated |
| name         | string    | Required         |
| description  | string    | Optional         |
| instructions | string    | Optional         |
| servings     | integer   | Optional         |
| is_active    | boolean   | Required         |
| created_at   | timestamp | Server generated |
| updated_at   | timestamp | Server generated |

Recipe web UI:

- the `/recipes` page lists saved recipes and exposes an `Add Recipe` action
- `/recipes/new` is a dedicated create page for recipe basics like name, servings, description, instructions, and active state
- clicking a recipe in `/recipes` opens a dedicated `/recipes/:id` page where the recipe can be edited directly and ingredients can be added or removed
- the recipe detail layout shows recipe info and ingredients in separate panels, with the ingredient panel following the main info/details panel
- recipe ingredients are added from an `Add Ingredient` modal on the recipe detail page, and selecting an existing ingredient opens the same modal prefilled for editing
- product default units and recipe ingredient units now use one shared HTML select with grouped common unit options, while still preserving unknown existing units during edit flows
- the recipe ingredient modal will reuse an existing product or create a lightweight ingredient product record when needed
- the recipe detail page can upload, preview, and remove multiple recipe images
- product, receipt, and recipe image uploads use one shared drag-and-drop upload field component in the frontend
- drag-over state on shared upload fields now uses a stronger highlighted dashed border, and standalone upload forms like the recipe image uploader submit immediately when files are dropped
- the frontend navbar keeps the same visual styling for visited links instead of falling back to browser default colors
- the frontend navbar also keeps route matching consistent so the root `Overview` link still renders with normal nav styling on non-root pages

### recipe_ingredients

Base resource: `/api/recipe-ingredients`

| Method | Path                          | Purpose                            |
| ------ | ----------------------------- | ---------------------------------- |
| GET    | `/api/recipe-ingredients`     | List recipe ingredients            |
| GET    | `/api/recipe-ingredients/:id` | Fetch one recipe ingredient by id  |
| POST   | `/api/recipe-ingredients`     | Create recipe ingredient           |
| PUT    | `/api/recipe-ingredients/:id` | Replace recipe ingredient          |
| PATCH  | `/api/recipe-ingredients/:id` | Update part of a recipe ingredient |
| DELETE | `/api/recipe-ingredients/:id` | Delete recipe ingredient           |

Recipe ingredient payload fields:

| Field       | Type      | Notes            |
| ----------- | --------- | ---------------- |
| id          | BIGINT    | Server generated |
| recipe_id   | BIGINT    | Required         |
| product_id  | BIGINT    | Required         |
| quantity    | decimal   | Required         |
| unit        | string    | Required         |
| is_optional | boolean   | Required         |
| notes       | string    | Optional         |
| created_at  | timestamp | Server generated |

### meal_plan_items

Base resource: `/api/meal-plan-items`

| Method | Path                       | Purpose                         |
| ------ | -------------------------- | ------------------------------- |
| GET    | `/api/meal-plan-items`     | List meal plan items            |
| GET    | `/api/meal-plan-items/:id` | Fetch one meal plan item by id  |
| POST   | `/api/meal-plan-items`     | Create meal plan item           |
| PUT    | `/api/meal-plan-items/:id` | Replace meal plan item          |
| PATCH  | `/api/meal-plan-items/:id` | Update part of a meal plan item |
| DELETE | `/api/meal-plan-items/:id` | Delete meal plan item           |

Meal plan item payload fields:

| Field        | Type      | Notes            |
| ------------ | --------- | ---------------- |
| id           | BIGINT    | Server generated |
| recipe_id    | BIGINT    | Required         |
| planned_date | date      | Required         |
| meal_type    | string    | Required         |
| servings     | integer   | Required         |
| status       | string    | Required         |
| created_at   | timestamp | Server generated |
| updated_at   | timestamp | Server generated |

### shopping_list_items

Base resource: `/api/shopping-list-items`

| Method | Path                           | Purpose                             |
| ------ | ------------------------------ | ----------------------------------- |
| GET    | `/api/shopping-list-items`     | List shopping list items            |
| GET    | `/api/shopping-list-items/:id` | Fetch one shopping list item by id  |
| POST   | `/api/shopping-list-items`     | Create shopping list item           |
| PUT    | `/api/shopping-list-items/:id` | Replace shopping list item          |
| PATCH  | `/api/shopping-list-items/:id` | Update part of a shopping list item |
| DELETE | `/api/shopping-list-items/:id` | Delete shopping list item           |

Shopping list item payload fields:

| Field            | Type      | Notes            |
| ---------------- | --------- | ---------------- |
| id               | BIGINT    | Server generated |
| product_id       | BIGINT    | Required         |
| quantity         | decimal   | Required         |
| unit             | string    | Required         |
| done             | boolean   | Required         |
| source_recipe_id | BIGINT    | Optional         |
| notes            | string    | Optional         |
| created_at       | timestamp | Server generated |
| updated_at       | timestamp | Server generated |

## DB schema

### Conventions

| Rule         | Value                                                            |
| ------------ | ---------------------------------------------------------------- |
| Primary keys | `id BIGINT PRIMARY KEY`                                          |
| Foreign keys | `<name>_id BIGINT NOT NULL REFERENCES ...`                       |
| Timestamps   | `created_at TIMESTAMP NOT NULL`, `updated_at TIMESTAMP NOT NULL` |
| Quantities   | `DECIMAL(10,2)`                                                  |
| Dates        | `DATE` for calendar dates, `TIMESTAMP` for events                |

### products

Catalog of things the app buys or tracks.

| Column        | Type         | Constraints / Notes                             |
| ------------- | ------------ | ----------------------------------------------- |
| id            | BIGINT       | PK                                              |
| name          | VARCHAR(255) | NOT NULL                                        |
| category      | VARCHAR(50)  | NOT NULL, e.g. `food`, `electronics`, `clothes` |
| barcode       | VARCHAR(64)  | NULL, optional GTIN/EAN/UPC style code, UNIQUE  |
| default_unit  | VARCHAR(50)  | NULL, e.g. `pcs`, `g`, `ml`                     |
| is_perishable | BOOLEAN      | NOT NULL DEFAULT FALSE                          |
| created_at    | TIMESTAMP    | NOT NULL                                        |
| updated_at    | TIMESTAMP    | NOT NULL                                        |

### product_links

External links for a product, such as store pages or food metadata.

| Column     | Type         | Constraints / Notes         |
| ---------- | ------------ | --------------------------- |
| id         | BIGINT       | PK                          |
| product_id | BIGINT       | FK -> products.id, NOT NULL |
| label      | VARCHAR(255) | NOT NULL                    |
| url        | TEXT         | NOT NULL                    |
| created_at | TIMESTAMP    | NOT NULL                    |

### receipts

Receipt header for one shopping trip or order.

| Column       | Type          | Constraints / Notes |
| ------------ | ------------- | ------------------- |
| id           | BIGINT        | PK                  |
| store_name   | VARCHAR(255)  | NOT NULL            |
| purchased_at | TIMESTAMP     | NOT NULL            |
| currency     | CHAR(3)       | NOT NULL            |
| total_amount | DECIMAL(10,2) | NULL                |
| created_at   | TIMESTAMP     | NOT NULL            |
| updated_at   | TIMESTAMP     | NOT NULL            |

### receipt_items

Line items on a receipt.

| Column     | Type          | Constraints / Notes         |
| ---------- | ------------- | --------------------------- |
| id         | BIGINT        | PK                          |
| receipt_id | BIGINT        | FK -> receipts.id, NOT NULL |
| product_id | BIGINT        | FK -> products.id, NOT NULL |
| quantity   | DECIMAL(10,2) | NOT NULL                    |
| unit       | VARCHAR(50)   | NOT NULL                    |
| unit_price | DECIMAL(10,2) | NULL                        |
| line_total | DECIMAL(10,2) | NULL                        |
| created_at | TIMESTAMP     | NOT NULL                    |

### inventory_containers

Named storage locations for household inventory. Containers can be nested, so a room can contain a closet or shelf.

| Column              | Type         | Constraints / Notes                 |
| ------------------- | ------------ | ----------------------------------- |
| id                  | BIGINT       | PK                                  |
| name                | VARCHAR(255) | NOT NULL                            |
| parent_container_id | BIGINT       | FK -> inventory_containers.id, NULL |
| notes               | TEXT         | NULL                                |
| created_at          | TIMESTAMP    | NOT NULL                            |
| updated_at          | TIMESTAMP    | NOT NULL                            |

### inventory_items

Physical stock currently owned.

| Column          | Type          | Constraints / Notes                 |
| --------------- | ------------- | ----------------------------------- |
| id              | BIGINT        | PK                                  |
| product_id      | BIGINT        | FK -> products.id, NOT NULL         |
| receipt_item_id | BIGINT        | FK -> receipt_items.id, NULL        |
| container_id    | BIGINT        | FK -> inventory_containers.id, NULL |
| quantity        | DECIMAL(10,2) | NOT NULL                            |
| unit            | VARCHAR(50)   | NOT NULL                            |
| purchased_at    | TIMESTAMP     | NULL                                |
| expires_at      | TIMESTAMP     | NULL                                |
| consumed_at     | TIMESTAMP     | NULL                                |
| notes           | TEXT          | NULL                                |
| created_at      | TIMESTAMP     | NOT NULL                            |
| updated_at      | TIMESTAMP     | NOT NULL                            |

### recipes

Recipe metadata.

| Column       | Type         | Constraints / Notes   |
| ------------ | ------------ | --------------------- |
| id           | BIGINT       | PK                    |
| name         | VARCHAR(255) | NOT NULL              |
| description  | TEXT         | NULL                  |
| instructions | TEXT         | NULL                  |
| servings     | INTEGER      | NULL                  |
| is_active    | BOOLEAN      | NOT NULL DEFAULT TRUE |
| created_at   | TIMESTAMP    | NOT NULL              |
| updated_at   | TIMESTAMP    | NOT NULL              |

### recipe_ingredients

Join table between recipes and products. The recipe detail API now includes the joined ingredient rows with basic product metadata so the frontend can render ingredient lists without extra lookups.

| Column      | Type          | Constraints / Notes         |
| ----------- | ------------- | --------------------------- |
| id          | BIGINT        | PK                          |
| recipe_id   | BIGINT        | FK -> recipes.id, NOT NULL  |
| product_id  | BIGINT        | FK -> products.id, NOT NULL |
| quantity    | DECIMAL(10,2) | NOT NULL                    |
| unit        | VARCHAR(50)   | NOT NULL                    |
| is_optional | BOOLEAN       | NOT NULL DEFAULT FALSE      |
| notes       | TEXT          | NULL                        |
| created_at  | TIMESTAMP     | NOT NULL                    |

### meal_plan_items

Planned meals for a given date and meal slot.

| Column       | Type        | Constraints / Notes                                    |
| ------------ | ----------- | ------------------------------------------------------ |
| id           | BIGINT      | PK                                                     |
| recipe_id    | BIGINT      | FK -> recipes.id, NOT NULL                             |
| planned_date | DATE        | NOT NULL                                               |
| meal_type    | VARCHAR(50) | NOT NULL, e.g. `breakfast`, `lunch`, `dinner`, `snack` |
| servings     | INTEGER     | NOT NULL DEFAULT 1                                     |
| status       | VARCHAR(50) | NOT NULL DEFAULT `planned`                             |
| created_at   | TIMESTAMP   | NOT NULL                                               |
| updated_at   | TIMESTAMP   | NOT NULL                                               |

### shopping_list_items

Direct buy queue entries. There is no separate parent `shopping_lists` table anymore.

| Column           | Type          | Constraints / Notes         |
| ---------------- | ------------- | --------------------------- |
| id               | BIGINT        | PK                          |
| product_id       | BIGINT        | FK -> products.id, NOT NULL |
| quantity         | DECIMAL(10,2) | NOT NULL                    |
| unit             | VARCHAR(50)   | NOT NULL                    |
| done             | BOOLEAN       | NOT NULL DEFAULT FALSE      |
| source_recipe_id | BIGINT        | FK -> recipes.id, NULL      |
| notes            | TEXT          | NULL                        |
| created_at       | TIMESTAMP     | NOT NULL                    |
| updated_at       | TIMESTAMP     | NOT NULL                    |

### Key relationships

| From     | To                  | Meaning                                       |
| -------- | ------------------- | --------------------------------------------- |
| receipts | receipt_items       | A receipt has many line items                 |
| products | inventory_items     | A product can exist in inventory many times   |
| recipes  | recipe_ingredients  | A recipe has many required ingredients        |
| products | recipe_ingredients  | A product can be used in many recipes         |
| recipes  | meal_plan_items     | A meal plan item usually points to one recipe |
| products | shopping_list_items | A shopping list entry requests one product    |

## Interfaces

| Interface | Notes                                                                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------------- |
| Web UI    |                                                                                                                        |
| Embended  | Some raspberry pi level device for viewing recepies or timers in the kitchen. Should be optimized for low input needs. |
| CLI       | Primary for agents for for humans too if they want. Manage things and search for this you know...                      |
