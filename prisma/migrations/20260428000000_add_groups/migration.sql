-- CreateTable
CREATE TABLE "groups" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_receipts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "group_id" INTEGER,
    "store_name" TEXT NOT NULL,
    "purchased_at" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "total_amount" REAL,
    "picture_path" TEXT,
    "picture_content_type" TEXT,
    "picture_filename" TEXT,
    "picture_uploaded_at" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    CONSTRAINT "receipts_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_receipts" ("created_at", "currency", "id", "picture_content_type", "picture_filename", "picture_path", "picture_uploaded_at", "purchased_at", "store_name", "total_amount", "updated_at") SELECT "created_at", "currency", "id", "picture_content_type", "picture_filename", "picture_path", "picture_uploaded_at", "purchased_at", "store_name", "total_amount", "updated_at" FROM "receipts";
DROP TABLE "receipts";
ALTER TABLE "new_receipts" RENAME TO "receipts";
CREATE INDEX "idx_receipts_group_id" ON "receipts"("group_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "groups_name_key" ON "groups"("name");
