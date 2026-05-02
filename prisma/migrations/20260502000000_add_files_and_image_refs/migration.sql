CREATE TABLE "files" (
	"id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	"path" TEXT NOT NULL,
	"content_type" TEXT NOT NULL,
	"filename" TEXT,
	"size_bytes" INTEGER NOT NULL,
	"created_at" TEXT NOT NULL
);

CREATE UNIQUE INDEX "files_path_key" ON "files"("path");

CREATE TABLE "inventory_item_images" (
	"id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	"inventory_item_id" INTEGER NOT NULL,
	"file_id" INTEGER NOT NULL,
	"created_at" TEXT NOT NULL,
	CONSTRAINT "inventory_item_images_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT "inventory_item_images_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "idx_inventory_item_images_inventory_item_id" ON "inventory_item_images"("inventory_item_id");
CREATE INDEX "idx_inventory_item_images_file_id" ON "inventory_item_images"("file_id");

ALTER TABLE "products" ADD COLUMN "picture_file_id" INTEGER REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "idx_products_picture_file_id" ON "products"("picture_file_id");

INSERT OR IGNORE INTO "files" ("path", "content_type", "filename", "size_bytes", "created_at")
SELECT
	"picture_path",
	COALESCE("picture_content_type", 'application/octet-stream'),
	"picture_filename",
	0,
	COALESCE("picture_uploaded_at", "updated_at", "created_at")
FROM "products"
WHERE "picture_path" IS NOT NULL;

UPDATE "products"
SET "picture_file_id" = (
	SELECT "files"."id"
	FROM "files"
	WHERE "files"."path" = "products"."picture_path"
)
WHERE "picture_path" IS NOT NULL;

ALTER TABLE "receipts" ADD COLUMN "picture_file_id" INTEGER REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "idx_receipts_picture_file_id" ON "receipts"("picture_file_id");

INSERT OR IGNORE INTO "files" ("path", "content_type", "filename", "size_bytes", "created_at")
SELECT
	"picture_path",
	COALESCE("picture_content_type", 'application/octet-stream'),
	"picture_filename",
	0,
	COALESCE("picture_uploaded_at", "updated_at", "created_at")
FROM "receipts"
WHERE "picture_path" IS NOT NULL;

UPDATE "receipts"
SET "picture_file_id" = (
	SELECT "files"."id"
	FROM "files"
	WHERE "files"."path" = "receipts"."picture_path"
)
WHERE "picture_path" IS NOT NULL;

INSERT OR IGNORE INTO "files" ("path", "content_type", "filename", "size_bytes", "created_at")
SELECT
	"path",
	COALESCE("content_type", 'application/octet-stream'),
	"filename",
	0,
	"created_at"
FROM "recipe_images"
WHERE "path" IS NOT NULL;

CREATE TABLE "recipe_images_new" (
	"id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	"recipe_id" INTEGER NOT NULL,
	"file_id" INTEGER NOT NULL,
	"created_at" TEXT NOT NULL,
	CONSTRAINT "recipe_images_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT "recipe_images_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "recipe_images_new" ("id", "recipe_id", "file_id", "created_at")
SELECT
	"recipe_images"."id",
	"recipe_images"."recipe_id",
	"files"."id",
	"recipe_images"."created_at"
FROM "recipe_images"
JOIN "files" ON "files"."path" = "recipe_images"."path";

DROP TABLE "recipe_images";
ALTER TABLE "recipe_images_new" RENAME TO "recipe_images";

CREATE INDEX "idx_recipe_images_recipe_id" ON "recipe_images"("recipe_id");
CREATE INDEX "idx_recipe_images_file_id" ON "recipe_images"("file_id");
