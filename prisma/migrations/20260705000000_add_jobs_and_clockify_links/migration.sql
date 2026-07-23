CREATE TABLE "external_integrations" (
	"id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	"provider" INTEGER NOT NULL,
	"name" TEXT NOT NULL,
	"status" INTEGER NOT NULL DEFAULT 1,
	"config_json" TEXT NOT NULL,
	"credentials_encrypted_json" TEXT NOT NULL,
	"created_at" TEXT NOT NULL,
	"updated_at" TEXT NOT NULL
);

CREATE UNIQUE INDEX "external_integrations_provider_name_key" ON "external_integrations"("provider", "name");
CREATE INDEX "idx_external_integrations_provider" ON "external_integrations"("provider");
CREATE INDEX "idx_external_integrations_status" ON "external_integrations"("status");

CREATE TABLE "import_schedules" (
	"id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	"integration_id" INTEGER NOT NULL,
	"type" INTEGER NOT NULL,
	"status" INTEGER NOT NULL DEFAULT 1,
	"name" TEXT NOT NULL,
	"cadence" INTEGER NOT NULL,
	"timezone" TEXT NOT NULL,
	"cursor_json" TEXT,
	"params_json" TEXT NOT NULL,
	"next_run_at" TEXT,
	"last_run_at" TEXT,
	"last_job_id" INTEGER,
	"created_at" TEXT NOT NULL,
	"updated_at" TEXT NOT NULL,
	CONSTRAINT "import_schedules_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "external_integrations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "idx_import_schedules_integration_id" ON "import_schedules"("integration_id");
CREATE INDEX "idx_import_schedules_type_status" ON "import_schedules"("type", "status");
CREATE INDEX "idx_import_schedules_next_run_at" ON "import_schedules"("next_run_at");

CREATE TABLE "jobs" (
	"id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	"schedule_id" INTEGER,
	"integration_id" INTEGER,
	"type" INTEGER NOT NULL,
	"status" INTEGER NOT NULL DEFAULT 1,
	"params_json" TEXT NOT NULL,
	"cursor_json" TEXT,
	"total_rows" INTEGER NOT NULL DEFAULT 0,
	"processed_rows" INTEGER NOT NULL DEFAULT 0,
	"result_json" TEXT,
	"error_json" TEXT,
	"error_message" TEXT,
	"started_at" TEXT,
	"finished_at" TEXT,
	"created_at" TEXT NOT NULL,
	"updated_at" TEXT NOT NULL,
	CONSTRAINT "jobs_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "import_schedules" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
	CONSTRAINT "jobs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "external_integrations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "idx_jobs_schedule_id" ON "jobs"("schedule_id");
CREATE INDEX "idx_jobs_integration_id" ON "jobs"("integration_id");
CREATE INDEX "idx_jobs_type_status" ON "jobs"("type", "status");
CREATE INDEX "idx_jobs_created_at" ON "jobs"("created_at");

CREATE TABLE "clockify_project_links" (
	"id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	"integration_id" INTEGER NOT NULL,
	"project_id" INTEGER NOT NULL,
	"clockify_workspace_id" TEXT NOT NULL,
	"clockify_project_id" TEXT NOT NULL,
	"clockify_client_id" TEXT,
	"clockify_name" TEXT NOT NULL,
	"clockify_client_name" TEXT,
	"last_seen_at" TEXT NOT NULL,
	"created_at" TEXT NOT NULL,
	"updated_at" TEXT NOT NULL,
	CONSTRAINT "clockify_project_links_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "external_integrations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT "clockify_project_links_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "clockify_project_links_external_key" ON "clockify_project_links"("integration_id", "clockify_workspace_id", "clockify_project_id");
CREATE UNIQUE INDEX "clockify_project_links_project_key" ON "clockify_project_links"("integration_id", "project_id");
CREATE INDEX "idx_clockify_project_links_project_id" ON "clockify_project_links"("project_id");

CREATE TABLE "clockify_time_entry_links" (
	"id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	"integration_id" INTEGER NOT NULL,
	"time_entry_id" INTEGER NOT NULL,
	"clockify_workspace_id" TEXT NOT NULL,
	"clockify_time_entry_id" TEXT NOT NULL,
	"clockify_project_id" TEXT,
	"clockify_user_id" TEXT,
	"last_seen_at" TEXT NOT NULL,
	"created_at" TEXT NOT NULL,
	"updated_at" TEXT NOT NULL,
	CONSTRAINT "clockify_time_entry_links_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "external_integrations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT "clockify_time_entry_links_time_entry_id_fkey" FOREIGN KEY ("time_entry_id") REFERENCES "time_entries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "clockify_time_entry_links_external_key" ON "clockify_time_entry_links"("integration_id", "clockify_workspace_id", "clockify_time_entry_id");
CREATE UNIQUE INDEX "clockify_time_entry_links_time_entry_key" ON "clockify_time_entry_links"("integration_id", "time_entry_id");
CREATE INDEX "idx_clockify_time_entry_links_time_entry_id" ON "clockify_time_entry_links"("time_entry_id");
