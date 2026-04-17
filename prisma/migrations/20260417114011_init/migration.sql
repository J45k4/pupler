-- CreateTable
CREATE TABLE "ingredients" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "default_unit" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "products" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ingredient_id" INTEGER,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "barcode" TEXT,
    "default_unit" TEXT,
    "is_perishable" BOOLEAN NOT NULL,
    "picture_blob" BLOB,
    "picture_content_type" TEXT,
    "picture_filename" TEXT,
    "picture_uploaded_at" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    CONSTRAINT "products_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "product_links" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "product_id" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    CONSTRAINT "product_links_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "store_name" TEXT NOT NULL,
    "purchased_at" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "total_amount" REAL,
    "picture_blob" BLOB,
    "picture_content_type" TEXT,
    "picture_filename" TEXT,
    "picture_uploaded_at" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "receipt_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "receipt_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "unit_price" REAL,
    "line_total" REAL,
    "created_at" TEXT NOT NULL,
    CONSTRAINT "receipt_items_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "receipts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "receipt_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "inventory_containers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "parent_container_id" INTEGER,
    "notes" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    CONSTRAINT "inventory_containers_parent_container_id_fkey" FOREIGN KEY ("parent_container_id") REFERENCES "inventory_containers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "ingredient_id" INTEGER,
    "product_id" INTEGER,
    "receipt_item_id" INTEGER,
    "container_id" INTEGER,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "purchased_at" TEXT,
    "expires_at" TEXT,
    "consumed_at" TEXT,
    "notes" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    CONSTRAINT "inventory_items_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "inventory_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "inventory_items_receipt_item_id_fkey" FOREIGN KEY ("receipt_item_id") REFERENCES "receipt_items" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "inventory_items_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "inventory_containers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "servings" INTEGER,
    "is_active" BOOLEAN NOT NULL,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "recipe_images" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "recipe_id" INTEGER NOT NULL,
    "blob" BLOB NOT NULL,
    "content_type" TEXT NOT NULL,
    "filename" TEXT,
    "created_at" TEXT NOT NULL,
    CONSTRAINT "recipe_images_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "recipe_ingredients" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "recipe_id" INTEGER NOT NULL,
    "ingredient_id" INTEGER,
    "product_id" INTEGER,
    "name" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "is_optional" BOOLEAN NOT NULL,
    "notes" TEXT,
    "created_at" TEXT NOT NULL,
    CONSTRAINT "recipe_ingredients_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "recipe_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "recipe_ingredients_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "meal_plan_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "recipe_id" INTEGER NOT NULL,
    "planned_date" TEXT NOT NULL,
    "meal_type" TEXT NOT NULL,
    "servings" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    CONSTRAINT "meal_plan_items_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "shopping_list_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "ingredient_id" INTEGER,
    "product_id" INTEGER,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL,
    "source_recipe_id" INTEGER,
    "notes" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    CONSTRAINT "shopping_list_items_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "shopping_list_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "shopping_list_items_source_recipe_id_fkey" FOREIGN KEY ("source_recipe_id") REFERENCES "recipes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "products_barcode_key" ON "products"("barcode");

-- CreateIndex
CREATE INDEX "idx_products_ingredient_id" ON "products"("ingredient_id");

-- CreateIndex
CREATE INDEX "idx_product_links_product_id" ON "product_links"("product_id");

-- CreateIndex
CREATE INDEX "idx_receipt_items_receipt_id" ON "receipt_items"("receipt_id");

-- CreateIndex
CREATE INDEX "idx_receipt_items_product_id" ON "receipt_items"("product_id");

-- CreateIndex
CREATE INDEX "idx_inventory_containers_parent_id" ON "inventory_containers"("parent_container_id");

-- CreateIndex
CREATE INDEX "idx_inventory_ingredient_id" ON "inventory_items"("ingredient_id");

-- CreateIndex
CREATE INDEX "idx_inventory_product_id" ON "inventory_items"("product_id");

-- CreateIndex
CREATE INDEX "idx_inventory_container_id" ON "inventory_items"("container_id");

-- CreateIndex
CREATE INDEX "idx_recipe_images_recipe_id" ON "recipe_images"("recipe_id");

-- CreateIndex
CREATE INDEX "idx_recipe_ingredients_recipe_id" ON "recipe_ingredients"("recipe_id");

-- CreateIndex
CREATE INDEX "idx_recipe_ingredients_ingredient_id" ON "recipe_ingredients"("ingredient_id");

-- CreateIndex
CREATE INDEX "idx_recipe_ingredients_product_id" ON "recipe_ingredients"("product_id");

-- CreateIndex
CREATE INDEX "idx_meal_plan_recipe_id" ON "meal_plan_items"("recipe_id");

-- CreateIndex
CREATE INDEX "idx_shopping_list_items_ingredient_id" ON "shopping_list_items"("ingredient_id");

-- CreateIndex
CREATE INDEX "idx_shopping_list_items_product_id" ON "shopping_list_items"("product_id");
