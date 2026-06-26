CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "username" TEXT,
    "email" TEXT,
    "password_hash" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL
);

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

CREATE TABLE "user_sessions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "last_seen_at" TEXT,
    CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "user_sessions_token_hash_key" ON "user_sessions"("token_hash");
CREATE INDEX "idx_user_sessions_user_id" ON "user_sessions"("user_id");
CREATE INDEX "idx_user_sessions_expires_at" ON "user_sessions"("expires_at");

ALTER TABLE "time_entries" ADD COLUMN "user_id" INTEGER REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "idx_time_entries_user_id" ON "time_entries"("user_id");
