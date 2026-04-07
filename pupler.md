# Pupler

Puppy butler service.

## Feature

| Feature | Notes |
| --- | --- |
| Manage food items | When new food items are added store metdata to it to database like expiration date and links to foods. |
| Manage food recepies | Collect list of good receipts that household likes and what food items these receipts need and how much. Use this information to automatically generate food menu. Try to optimize food menu so that incredients can be shared as much of possible. |
| Manage items | Manage what items there are when they are bought and their receipts. |
| Shoppinglist | Automaticaly generate shoppinglists for based of menu like what items are needed also consider expiration dates of food items. |

## DB schema

### Conventions

| Rule | Value |
| --- | --- |
| Primary keys | `id BIGINT PRIMARY KEY` |
| Foreign keys | `<name>_id BIGINT NOT NULL REFERENCES ...` |
| Timestamps | `created_at TIMESTAMP NOT NULL`, `updated_at TIMESTAMP NOT NULL` |
| Quantities | `DECIMAL(10,2)` |
| Dates | `DATE` for calendar dates, `TIMESTAMP` for events |

### products

Catalog of things the app buys or tracks.

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| id | BIGINT | PK |
| name | VARCHAR(255) | NOT NULL |
| category | VARCHAR(50) | NOT NULL, e.g. `food`, `electronics`, `clothes` |
| default_unit | VARCHAR(50) | NULL, e.g. `pcs`, `g`, `ml` |
| is_perishable | BOOLEAN | NOT NULL DEFAULT FALSE |
| created_at | TIMESTAMP | NOT NULL |
| updated_at | TIMESTAMP | NOT NULL |

### product_links

External links for a product, such as store pages or food metadata.

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| id | BIGINT | PK |
| product_id | BIGINT | FK -> products.id, NOT NULL |
| label | VARCHAR(255) | NOT NULL |
| url | TEXT | NOT NULL |
| created_at | TIMESTAMP | NOT NULL |

### purchase_receipts

Receipt header for one shopping trip or order.

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| id | BIGINT | PK |
| store_name | VARCHAR(255) | NOT NULL |
| purchased_at | TIMESTAMP | NOT NULL |
| currency | CHAR(3) | NOT NULL |
| total_amount | DECIMAL(10,2) | NULL |
| created_at | TIMESTAMP | NOT NULL |
| updated_at | TIMESTAMP | NOT NULL |

### purchase_receipt_items

Line items on a receipt.

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| id | BIGINT | PK |
| receipt_id | BIGINT | FK -> purchase_receipts.id, NOT NULL |
| product_id | BIGINT | FK -> products.id, NOT NULL |
| quantity | DECIMAL(10,2) | NOT NULL |
| unit | VARCHAR(50) | NOT NULL |
| unit_price | DECIMAL(10,2) | NULL |
| line_total | DECIMAL(10,2) | NULL |
| created_at | TIMESTAMP | NOT NULL |

### inventory_items

Physical stock currently owned.

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| id | BIGINT | PK |
| product_id | BIGINT | FK -> products.id, NOT NULL |
| receipt_item_id | BIGINT | FK -> purchase_receipt_items.id, NULL |
| quantity | DECIMAL(10,2) | NOT NULL |
| unit | VARCHAR(50) | NOT NULL |
| purchased_at | TIMESTAMP | NULL |
| expires_at | TIMESTAMP | NULL |
| consumed_at | TIMESTAMP | NULL |
| notes | TEXT | NULL |
| created_at | TIMESTAMP | NOT NULL |
| updated_at | TIMESTAMP | NOT NULL |

### recipes

Recipe metadata.

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| id | BIGINT | PK |
| name | VARCHAR(255) | NOT NULL |
| description | TEXT | NULL |
| instructions | TEXT | NULL |
| servings | INTEGER | NULL |
| is_active | BOOLEAN | NOT NULL DEFAULT TRUE |
| created_at | TIMESTAMP | NOT NULL |
| updated_at | TIMESTAMP | NOT NULL |

### recipe_ingredients

Join table between recipes and products.

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| id | BIGINT | PK |
| recipe_id | BIGINT | FK -> recipes.id, NOT NULL |
| product_id | BIGINT | FK -> products.id, NOT NULL |
| quantity | DECIMAL(10,2) | NOT NULL |
| unit | VARCHAR(50) | NOT NULL |
| is_optional | BOOLEAN | NOT NULL DEFAULT FALSE |
| notes | TEXT | NULL |
| created_at | TIMESTAMP | NOT NULL |

### meal_plan_items

Planned meals for a given date and meal slot.

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| id | BIGINT | PK |
| recipe_id | BIGINT | FK -> recipes.id, NOT NULL |
| planned_date | DATE | NOT NULL |
| meal_type | VARCHAR(50) | NOT NULL, e.g. `breakfast`, `lunch`, `dinner`, `snack` |
| servings | INTEGER | NOT NULL DEFAULT 1 |
| status | VARCHAR(50) | NOT NULL DEFAULT `planned` |
| created_at | TIMESTAMP | NOT NULL |
| updated_at | TIMESTAMP | NOT NULL |

### shopping_lists

Shopping list header, usually generated from a meal plan window.

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| id | BIGINT | PK |
| name | VARCHAR(255) | NOT NULL |
| start_date | DATE | NULL |
| end_date | DATE | NULL |
| status | VARCHAR(50) | NOT NULL DEFAULT `open` |
| generated_from_meal_plan | BOOLEAN | NOT NULL DEFAULT FALSE |
| created_at | TIMESTAMP | NOT NULL |
| updated_at | TIMESTAMP | NOT NULL |

### shopping_list_items

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| id | BIGINT | PK |
| shopping_list_id | BIGINT | FK -> shopping_lists.id, NOT NULL |
| product_id | BIGINT | FK -> products.id, NOT NULL |
| quantity | DECIMAL(10,2) | NOT NULL |
| unit | VARCHAR(50) | NOT NULL |
| done | BOOLEAN | NOT NULL DEFAULT FALSE |
| source_recipe_id | BIGINT | FK -> recipes.id, NULL |
| notes | TEXT | NULL |
| created_at | TIMESTAMP | NOT NULL |
| updated_at | TIMESTAMP | NOT NULL |

### Key relationships

| From | To | Meaning |
| --- | --- | --- |
| purchase_receipts | purchase_receipt_items | A receipt has many line items |
| products | inventory_items | A product can exist in inventory many times |
| recipes | recipe_ingredients | A recipe has many required ingredients |
| products | recipe_ingredients | A product can be used in many recipes |
| recipes | meal_plan_items | A meal plan item usually points to one recipe |
| shopping_lists | shopping_list_items | A shopping list has many entries |
| products | shopping_list_items | A shopping list entry requests one product |

## Interfaces

| Interface | Notes |
| --- | --- |
| Web UI |  |
| Embended | Some raspberry pi level device for viewing recepies or timers in the kitchen. Should be optimized for low input needs. |
| CLI | Primary for agents for for humans too if they want. Manage things and search for this you know... |
