CREATE TABLE "new_time_entries" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "project_id" INTEGER,
    "description" TEXT,
    "started_at" TEXT NOT NULL,
    "ended_at" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    CONSTRAINT "time_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "time_projects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_time_entries" ("id", "project_id", "description", "started_at", "ended_at", "created_at", "updated_at")
SELECT "id", "project_id", "description", "started_at", "ended_at", "created_at", "updated_at"
FROM "time_entries";

DROP TABLE "time_entries";
ALTER TABLE "new_time_entries" RENAME TO "time_entries";

CREATE INDEX "idx_time_entries_project_id" ON "time_entries"("project_id");
CREATE INDEX "idx_time_entries_started_at" ON "time_entries"("started_at");
CREATE INDEX "idx_time_entries_ended_at" ON "time_entries"("ended_at");
