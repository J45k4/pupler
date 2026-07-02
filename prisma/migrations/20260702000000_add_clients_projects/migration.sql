CREATE TABLE "clients" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "archived_at" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL
);

CREATE INDEX "idx_clients_name" ON "clients"("name");
CREATE INDEX "idx_clients_archived_at" ON "clients"("archived_at");

ALTER TABLE "time_projects" RENAME TO "projects";

DROP INDEX IF EXISTS "idx_time_projects_name";
DROP INDEX IF EXISTS "idx_time_projects_archived_at";

ALTER TABLE "projects" ADD COLUMN "client_id" INTEGER REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "idx_projects_client_id" ON "projects"("client_id");
CREATE INDEX "idx_projects_name" ON "projects"("name");
CREATE INDEX "idx_projects_archived_at" ON "projects"("archived_at");
