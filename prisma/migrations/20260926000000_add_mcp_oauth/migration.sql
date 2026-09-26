CREATE TABLE "oauth_clients" (
    "id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "redirect_uris" TEXT NOT NULL, "created_at" TEXT NOT NULL
);
CREATE TABLE "oauth_grants" (
    "id" TEXT NOT NULL PRIMARY KEY, "client_id" TEXT NOT NULL, "user_id" INTEGER NOT NULL,
    "scope" TEXT NOT NULL, "resource" TEXT NOT NULL, "created_at" TEXT NOT NULL, "last_used_at" TEXT, "revoked_at" TEXT,
    FOREIGN KEY ("client_id") REFERENCES "oauth_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "oauth_grants_user_id_idx" ON "oauth_grants"("user_id");
CREATE TABLE "oauth_authorizations" (
    "id" TEXT NOT NULL PRIMARY KEY, "client_id" TEXT NOT NULL, "redirect_uri" TEXT NOT NULL,
    "scope" TEXT NOT NULL, "resource" TEXT NOT NULL, "state" TEXT NOT NULL, "challenge" TEXT NOT NULL,
    "expires_at" TEXT NOT NULL, "user_id" INTEGER, "session_hash" TEXT, "csrf_hash" TEXT,
    "code_hash" TEXT, "grant_id" TEXT, "consumed" BOOLEAN NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX "oauth_authorizations_code_hash_key" ON "oauth_authorizations"("code_hash");
CREATE INDEX "oauth_authorizations_expires_at_idx" ON "oauth_authorizations"("expires_at");
CREATE TABLE "oauth_tokens" (
    "hash" TEXT NOT NULL PRIMARY KEY, "grant_id" TEXT NOT NULL, "kind" TEXT NOT NULL, "expires_at" TEXT NOT NULL, "used_at" TEXT,
    FOREIGN KEY ("grant_id") REFERENCES "oauth_grants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "oauth_tokens_grant_id_idx" ON "oauth_tokens"("grant_id");
CREATE TABLE "mcp_uploads" (
    "id" TEXT NOT NULL PRIMARY KEY, "grant_id" TEXT, "token_hash" TEXT NOT NULL,
    "filename" TEXT NOT NULL, "content_type" TEXT NOT NULL, "expires_at" TEXT NOT NULL,
    "path" TEXT, "size_bytes" INTEGER, "consumed" BOOLEAN NOT NULL DEFAULT false,
    FOREIGN KEY ("grant_id") REFERENCES "oauth_grants"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "mcp_uploads_token_hash_key" ON "mcp_uploads"("token_hash");
CREATE INDEX "mcp_uploads_expires_at_idx" ON "mcp_uploads"("expires_at");
CREATE TABLE "mcp_imports" (
    "grant_id" TEXT NOT NULL, "key" TEXT NOT NULL, "payload_hash" TEXT NOT NULL, "result_json" TEXT NOT NULL,
    PRIMARY KEY ("grant_id", "key"),
    FOREIGN KEY ("grant_id") REFERENCES "oauth_grants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
