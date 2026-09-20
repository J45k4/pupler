CREATE TABLE "user_api_keys" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "last_used_at" TEXT,
    CONSTRAINT "user_api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "user_api_keys_key_hash_key" ON "user_api_keys"("key_hash");
CREATE INDEX "idx_user_api_keys_user_id" ON "user_api_keys"("user_id");
