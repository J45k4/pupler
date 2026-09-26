import sql0 from "../prisma/migrations/20260419064238_init/migration.sql" with { type: "text" }
import sql1 from "../prisma/migrations/20260428000000_add_groups/migration.sql" with { type: "text" }
import sql2 from "../prisma/migrations/20260502000000_add_files_and_image_refs/migration.sql" with { type: "text" }
import sql3 from "../prisma/migrations/20260525000000_add_todos/migration.sql" with { type: "text" }
import sql4 from "../prisma/migrations/20260526000000_add_time_tracking/migration.sql" with { type: "text" }
import sql5 from "../prisma/migrations/20260607000000_allow_running_time_entries_without_project/migration.sql" with { type: "text" }
import sql6 from "../prisma/migrations/20260626000000_add_users_to_time_entries/migration.sql" with { type: "text" }
import sql7 from "../prisma/migrations/20260702000000_add_clients_projects/migration.sql" with { type: "text" }
import sql8 from "../prisma/migrations/20260705000000_add_jobs_and_clockify_links/migration.sql" with { type: "text" }
import sql9 from "../prisma/migrations/20260725000000_add_user_is_admin/migration.sql" with { type: "text" }
import sql10 from "../prisma/migrations/20260905000000_add_user_api_keys/migration.sql" with { type: "text" }
import sql11 from "../prisma/migrations/20260926000000_add_mcp_oauth/migration.sql" with { type: "text" }
import { Database } from "bun:sqlite"
import { createHash, randomUUID } from "node:crypto"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"

export const migrations = [
	{ name: "20260419064238_init", sql: sql0 },
	{ name: "20260428000000_add_groups", sql: sql1 },
	{ name: "20260502000000_add_files_and_image_refs", sql: sql2 },
	{ name: "20260525000000_add_todos", sql: sql3 },
	{ name: "20260526000000_add_time_tracking", sql: sql4 },
	{ name: "20260607000000_allow_running_time_entries_without_project", sql: sql5 },
	{ name: "20260626000000_add_users_to_time_entries", sql: sql6 },
	{ name: "20260702000000_add_clients_projects", sql: sql7 },
	{ name: "20260705000000_add_jobs_and_clockify_links", sql: sql8 },
	{ name: "20260725000000_add_user_is_admin", sql: sql9 },
	{ name: "20260905000000_add_user_api_keys", sql: sql10 },
	{ name: "20260926000000_add_mcp_oauth", sql: sql11 },
]

// Keep Prisma's ledger so source and binary installations can share a database.
export const migrateDatabase = (path: string) => {
	mkdirSync(dirname(path), { recursive: true })
	const db = new Database(path, { create: true })
	try {
		db.exec("PRAGMA busy_timeout = 30000")
		const ledger = db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = '_prisma_migrations'").get()
		if (!ledger && db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").get()) {
			throw new Error("Existing database has no Prisma migration history. Baseline it before installing a binary release.")
		}
		db.exec(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
			"id" TEXT PRIMARY KEY NOT NULL, "checksum" TEXT NOT NULL,
			"finished_at" DATETIME, "migration_name" TEXT NOT NULL,
			"logs" TEXT, "rolled_back_at" DATETIME,
			"started_at" DATETIME NOT NULL DEFAULT current_timestamp,
			"applied_steps_count" INTEGER UNSIGNED NOT NULL DEFAULT 0
		)`)
		for (const migration of migrations) {
			const checksum = createHash("sha256").update(migration.sql).digest("hex")
			db.exec("PRAGMA foreign_keys = OFF")
			db.exec("BEGIN IMMEDIATE")
			try {
				const records = db.query("SELECT checksum, finished_at FROM _prisma_migrations WHERE migration_name = ? AND rolled_back_at IS NULL").all(migration.name) as { checksum: string, finished_at: string | null }[]
				if (records.some(record => !record.finished_at || record.checksum !== checksum)) {
					throw new Error(`Failed or modified migration: ${migration.name}`)
				}
				if (!records.length) {
					db.exec(migration.sql)
					if (db.query("PRAGMA foreign_key_check").all().length) throw new Error(`Foreign key violation in ${migration.name}`)
					db.query("INSERT INTO _prisma_migrations (id, checksum, migration_name, finished_at, applied_steps_count) VALUES (?, ?, ?, ?, 1)").run(randomUUID(), checksum, migration.name, new Date().toISOString())
					console.log(`Applied ${migration.name}`)
				}
				db.exec("COMMIT")
			} catch (error) {
				db.exec("ROLLBACK")
				throw error
			}
		}
	} finally {
		db.close()
	}
}
