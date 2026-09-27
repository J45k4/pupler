ALTER TABLE "shopping_list_items" ADD COLUMN "removed_at" TEXT;

CREATE TABLE "shoppinglists" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL
);

INSERT INTO "shoppinglists" ("id", "name", "created_at", "updated_at")
VALUES (1, 'Shopping', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

CREATE TABLE "new_shopping_list_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shopping_list_id" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "ingredient_id" INTEGER,
    "product_id" INTEGER,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "removed_at" TEXT,
    "done" BOOLEAN NOT NULL,
    "source_recipe_id" INTEGER,
    "notes" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    CONSTRAINT "shopping_list_items_shopping_list_id_fkey" FOREIGN KEY ("shopping_list_id") REFERENCES "shoppinglists" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "shopping_list_items_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "shopping_list_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "shopping_list_items_source_recipe_id_fkey" FOREIGN KEY ("source_recipe_id") REFERENCES "recipes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_shopping_list_items" ("id", "shopping_list_id", "name", "ingredient_id", "product_id", "quantity", "unit", "removed_at", "done", "source_recipe_id", "notes", "created_at", "updated_at")
SELECT "id", 1, "name", "ingredient_id", "product_id", "quantity", "unit", "removed_at", "done", "source_recipe_id", "notes", "created_at", "updated_at" FROM "shopping_list_items";

DROP TABLE "shopping_list_items";
ALTER TABLE "new_shopping_list_items" RENAME TO "shopping_list_items";

CREATE INDEX "idx_shopping_list_items_shopping_list_id" ON "shopping_list_items"("shopping_list_id");
CREATE INDEX "idx_shopping_list_items_ingredient_id" ON "shopping_list_items"("ingredient_id");
CREATE INDEX "idx_shopping_list_items_product_id" ON "shopping_list_items"("product_id");

CREATE TABLE "shopping_list_members" (
    "shopping_list_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role" TEXT NOT NULL CHECK ("role" IN ('viewer', 'editor')),
    "created_at" TEXT NOT NULL,
    PRIMARY KEY ("shopping_list_id", "user_id"),
    CONSTRAINT "shopping_list_members_shopping_list_id_fkey" FOREIGN KEY ("shopping_list_id") REFERENCES "shoppinglists" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "shopping_list_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "idx_shopping_list_members_user_id" ON "shopping_list_members"("user_id");

INSERT INTO "shopping_list_members" ("shopping_list_id", "user_id", "role", "created_at")
SELECT 1, "id", 'editor', strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM "users";
