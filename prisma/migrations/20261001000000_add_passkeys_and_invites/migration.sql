CREATE TABLE "passkeys" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "credential_id" TEXT NOT NULL,
    "public_key" TEXT NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "transports" TEXT,
    "created_at" TEXT NOT NULL,
    "last_used_at" TEXT,
    CONSTRAINT "passkeys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "passkeys_credential_id_key" ON "passkeys"("credential_id");
CREATE INDEX "idx_passkeys_user_id" ON "passkeys"("user_id");
CREATE TABLE "user_invites" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    CONSTRAINT "user_invites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "user_invites_token_hash_key" ON "user_invites"("token_hash");
CREATE INDEX "idx_user_invites_user_id" ON "user_invites"("user_id");
ALTER TABLE "user_sessions" ADD COLUMN "passkey_id" INTEGER REFERENCES "passkeys" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "idx_user_sessions_passkey_id" ON "user_sessions"("passkey_id");
