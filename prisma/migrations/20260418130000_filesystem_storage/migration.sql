PRAGMA foreign_keys=OFF;

CREATE TABLE "new_products" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ingredient_id" INTEGER,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "barcode" TEXT,
    "default_unit" TEXT,
    "is_perishable" BOOLEAN NOT NULL,
    "picture_path" TEXT,
    "picture_content_type" TEXT,
    "picture_filename" TEXT,
    "picture_uploaded_at" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    CONSTRAINT "products_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_products" (
    "id",
    "ingredient_id",
    "name",
    "category",
    "barcode",
    "default_unit",
    "is_perishable",
    "picture_path",
    "picture_content_type",
    "picture_filename",
    "picture_uploaded_at",
    "created_at",
    "updated_at"
)
SELECT
    "id",
    "ingredient_id",
    "name",
    "category",
    "barcode",
    "default_unit",
    "is_perishable",
    NULL,
    NULL,
    NULL,
    NULL,
    "created_at",
    "updated_at"
FROM "products";

DROP TABLE "products";
ALTER TABLE "new_products" RENAME TO "products";
CREATE UNIQUE INDEX "products_barcode_key" ON "products"("barcode");
CREATE INDEX "idx_products_ingredient_id" ON "products"("ingredient_id");

CREATE TABLE "new_receipts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "store_name" TEXT NOT NULL,
    "purchased_at" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "total_amount" REAL,
    "picture_path" TEXT,
    "picture_content_type" TEXT,
    "picture_filename" TEXT,
    "picture_uploaded_at" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL
);

INSERT INTO "new_receipts" (
    "id",
    "store_name",
    "purchased_at",
    "currency",
    "total_amount",
    "picture_path",
    "picture_content_type",
    "picture_filename",
    "picture_uploaded_at",
    "created_at",
    "updated_at"
)
SELECT
    "id",
    "store_name",
    "purchased_at",
    "currency",
    "total_amount",
    NULL,
    NULL,
    NULL,
    NULL,
    "created_at",
    "updated_at"
FROM "receipts";

DROP TABLE "receipts";
ALTER TABLE "new_receipts" RENAME TO "receipts";

CREATE TABLE "new_recipe_images" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "recipe_id" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "filename" TEXT,
    "created_at" TEXT NOT NULL,
    CONSTRAINT "recipe_images_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

DROP TABLE "recipe_images";
ALTER TABLE "new_recipe_images" RENAME TO "recipe_images";
CREATE INDEX "idx_recipe_images_recipe_id" ON "recipe_images"("recipe_id");

PRAGMA foreign_keys=ON;
