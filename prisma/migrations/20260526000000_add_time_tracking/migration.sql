CREATE TABLE "time_projects" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "archived_at" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL
);

CREATE TABLE "time_entries" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "project_id" INTEGER NOT NULL,
    "description" TEXT,
    "started_at" TEXT NOT NULL,
    "ended_at" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    CONSTRAINT "time_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "time_projects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "idx_time_projects_name" ON "time_projects"("name");
CREATE INDEX "idx_time_projects_archived_at" ON "time_projects"("archived_at");
CREATE INDEX "idx_time_entries_project_id" ON "time_entries"("project_id");
CREATE INDEX "idx_time_entries_started_at" ON "time_entries"("started_at");
CREATE INDEX "idx_time_entries_ended_at" ON "time_entries"("ended_at");
