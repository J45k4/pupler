CREATE TABLE "recipe_images" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "recipe_id" INTEGER NOT NULL,
  "blob" BLOB NOT NULL,
  "content_type" TEXT NOT NULL,
  "filename" TEXT,
  "created_at" TEXT NOT NULL,
  CONSTRAINT "recipe_images_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "idx_recipe_images_recipe_id" ON "recipe_images"("recipe_id");

INSERT INTO "recipe_images" ("recipe_id", "blob", "content_type", "filename", "created_at")
SELECT
  "id",
  "picture_blob",
  "picture_content_type",
  "picture_filename",
  COALESCE("picture_uploaded_at", "updated_at", "created_at")
FROM "recipes"
WHERE "picture_blob" IS NOT NULL AND "picture_content_type" IS NOT NULL;
