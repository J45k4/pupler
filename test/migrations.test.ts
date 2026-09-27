import { afterEach, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { createHash } from "node:crypto"
import { mkdtempSync, rmSync, readdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { migrateDatabase, migrations } from "../src/migrations"

const directories: string[] = []
const databasePath = () => {
	const directory = mkdtempSync(join(tmpdir(), "pupler-migrations-"))
	directories.push(directory)
	return join(directory, "pupler.db")
}
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }) })

test("the embedded migration list includes every repository migration", () => {
	const names = readdirSync(resolve(import.meta.dir, "../prisma/migrations"), { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort()
	expect(migrations.map(migration => migration.name)).toEqual(names)
})

test("binary migrations initialize a database and repeat without losing data", () => {
	const path = databasePath()
	migrateDatabase(path)
	const db = new Database(path)
	db.exec("INSERT INTO users (name, created_at, updated_at) VALUES ('Preserved', '2026-01-01', '2026-01-01')")
	migrateDatabase(path)
	expect(db.query("SELECT name FROM users").get()).toEqual({ name: "Preserved" })
	expect(db.query("SELECT COUNT(*) AS count FROM _prisma_migrations").get()).toEqual({ count: migrations.length })
	db.close()
})

test("Prisma accepts embedded migration history", async () => {
	const path = databasePath()
	const deploy = async () => {
		const child = Bun.spawn([process.execPath, "node_modules/prisma/build/index.js", "migrate", "deploy"], { cwd: resolve(import.meta.dir, ".."), env: { ...process.env, DB_PATH: path }, stdout: "pipe", stderr: "pipe" })
		const [code, output, error] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
		if (code) throw new Error(`${output}\n${error}`)
	}
	await deploy()
	const previous = new Database(path)
	previous.exec("DROP TABLE user_api_keys")
	previous.query("DELETE FROM _prisma_migrations WHERE migration_name = ?").run("20260905000000_add_user_api_keys")
	previous.close()
	migrateDatabase(path)
	await deploy()
	const db = new Database(path)
	expect(db.query("SELECT COUNT(*) AS count FROM _prisma_migrations").get()).toEqual({ count: migrations.length })
	db.close()
}, 30000)

test("combined shopping list migration preserves items and grants existing users editor access", () => {
	const path = databasePath()
	const db = new Database(path)
	const shoppingMigrationIndex = migrations.findIndex(migration => migration.name === "20260925000000_add_shopping_item_removal")
	for (const migration of migrations.slice(0, shoppingMigrationIndex)) db.exec(migration.sql)
	db.exec("INSERT INTO shopping_list_items (name, quantity, unit, done, created_at, updated_at) VALUES ('Milk', 2, 'pcs', 0, '2026-09-25T11:00:00Z', '2026-09-25T12:00:00Z')")
	db.exec("INSERT INTO ingredients (name, created_at, updated_at) VALUES ('Flour', '2026-01-01', '2026-01-01')")
	db.exec("INSERT INTO products (ingredient_id, name, category, is_perishable, created_at, updated_at) VALUES (1, 'Wheat flour', 'Baking', 0, '2026-01-01', '2026-01-01')")
	db.exec("INSERT INTO recipes (name, is_active, created_at, updated_at) VALUES ('Bread', 1, '2026-01-01', '2026-01-01')")
	db.exec("INSERT INTO shopping_list_items (name, ingredient_id, product_id, quantity, unit, done, source_recipe_id, notes, created_at, updated_at) VALUES ('Flour', 1, 1, 2.5, 'kg', 1, 1, 'Whole wheat', '2026-09-25T13:00:00Z', '2026-09-25T14:00:00Z')")
	db.exec("INSERT INTO users (name, created_at, updated_at) VALUES ('Alice', '2026-01-01', '2026-01-01'), ('Bob', '2026-01-01', '2026-01-01')")
	const originalItems = db.query("SELECT * FROM shopping_list_items ORDER BY id").all()
	db.exec(migrations[shoppingMigrationIndex]!.sql)
	db.close()
	const upgraded = new Database(path)
	expect(upgraded.query("SELECT id, name FROM shoppinglists").all()).toEqual([{ id: 1, name: "Shopping" }])
	const migratedItems = upgraded.query("SELECT * FROM shopping_list_items ORDER BY id").all() as Array<Record<string, unknown> & { shopping_list_id: number; removed_at: string | null }>
	expect(migratedItems.map(({ shopping_list_id, removed_at, ...item }) => item)).toEqual(originalItems)
	expect(migratedItems.map(({ shopping_list_id, removed_at }) => ({ shopping_list_id, removed_at }))).toEqual([{ shopping_list_id: 1, removed_at: null }, { shopping_list_id: 1, removed_at: null }])
	expect(upgraded.query("SELECT shopping_list_id, user_id, role FROM shopping_list_members ORDER BY user_id").all()).toEqual([{ shopping_list_id: 1, user_id: 1, role: "editor" }, { shopping_list_id: 1, user_id: 2, role: "editor" }])
	expect(upgraded.query("PRAGMA foreign_key_check").all()).toEqual([])
	upgraded.exec("INSERT INTO shopping_list_items (name, quantity, unit, done, created_at, updated_at) VALUES ('Eggs', 1, 'pcs', 0, '2026-09-25', '2026-09-25')")
	expect(upgraded.query("SELECT id, shopping_list_id FROM shopping_list_items WHERE name = 'Eggs'").get()).toEqual({ id: 3, shopping_list_id: 1 })
	upgraded.close()
})

test("deployment command upgrades a database that already applied item removal without losing data", async () => {
	const path = databasePath()
	const db = new Database(path)
	const shoppingMigrationIndex = migrations.findIndex(migration => migration.name === "20260925000000_add_shopping_item_removal")
	db.exec(`CREATE TABLE _prisma_migrations (id TEXT PRIMARY KEY NOT NULL, checksum TEXT NOT NULL, finished_at DATETIME, migration_name TEXT NOT NULL, logs TEXT, rolled_back_at DATETIME, started_at DATETIME NOT NULL DEFAULT current_timestamp, applied_steps_count INTEGER UNSIGNED NOT NULL DEFAULT 0)`)
	const ledger = db.query("INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, applied_steps_count) VALUES (?, ?, '2026-09-25', ?, 1)")
	for (const migration of migrations.slice(0, shoppingMigrationIndex)) {
		db.exec(migration.sql)
		ledger.run(migration.name, createHash("sha256").update(migration.sql).digest("hex"), migration.name)
	}
	const legacySql = 'ALTER TABLE "shopping_list_items" ADD COLUMN "removed_at" TEXT;\n'
	db.exec(legacySql)
	ledger.run("20260925000000_add_shopping_item_removal", createHash("sha256").update(legacySql).digest("hex"), "20260925000000_add_shopping_item_removal")
	db.exec("INSERT INTO users (name, created_at, updated_at) VALUES ('Alice', '2026-01-01', '2026-01-01'), ('Bob', '2026-01-01', '2026-01-01')")
	db.exec("INSERT INTO shopping_list_items (name, quantity, unit, done, removed_at, created_at, updated_at) VALUES ('Milk', 2, 'pcs', 0, '2026-09-25T12:00:00Z', '2026-09-25T11:00:00Z', '2026-09-25T12:00:00Z')")
	db.close()
	const child = Bun.spawn([process.execPath, "run", "prisma:migrate:deploy"], { cwd: resolve(import.meta.dir, ".."), env: { ...process.env, DB_PATH: path }, stdout: "pipe", stderr: "pipe" })
	const [code, output, error] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
	if (code) throw new Error(`${output}\n${error}`)
	migrateDatabase(path)
	const upgraded = new Database(path)
	expect(upgraded.query("SELECT shopping_list_id, name, removed_at FROM shopping_list_items").all()).toEqual([{ shopping_list_id: 1, name: "Milk", removed_at: "2026-09-25T12:00:00Z" }])
	expect(upgraded.query("SELECT checksum FROM _prisma_migrations WHERE migration_name = ?").get("20260925000000_add_shopping_item_removal")).toEqual({ checksum: createHash("sha256").update(migrations[shoppingMigrationIndex]!.sql).digest("hex") })
	expect(upgraded.query("SELECT COUNT(*) AS count FROM _prisma_migrations").get()).toEqual({ count: migrations.length })
	expect(upgraded.query("SELECT shopping_list_id, user_id, role FROM shopping_list_members ORDER BY user_id").all()).toEqual([{ shopping_list_id: 1, user_id: 1, role: "editor" }, { shopping_list_id: 1, user_id: 2, role: "editor" }])
	upgraded.exec("INSERT INTO shoppinglists (name, created_at, updated_at) VALUES ('Hardware', '2026-01-01', '2026-01-01')")
	upgraded.exec("INSERT INTO shopping_list_members (shopping_list_id, user_id, role, created_at) VALUES (2, 1, 'viewer', '2026-01-01')")
	expect(upgraded.query("SELECT role FROM shopping_list_members WHERE shopping_list_id = 2 AND user_id = 1").get()).toEqual({ role: "viewer" })
	expect(() => upgraded.exec("INSERT INTO shopping_list_members (shopping_list_id, user_id, role, created_at) VALUES (1, 1, 'viewer', '2026-01-01')")).toThrow()
	expect(() => upgraded.exec("INSERT INTO shopping_list_members (shopping_list_id, user_id, role, created_at) VALUES (1, 2, 'owner', '2026-01-01')")).toThrow()
	expect(upgraded.query("PRAGMA foreign_key_check").all()).toEqual([])
	upgraded.close()
}, 30000)

test("binary migrations refuse unknown schemas and changed or failed migration records", () => {
	const path = databasePath()
	const db = new Database(path)
	db.exec("CREATE TABLE existing_data (value TEXT)")
	expect(() => migrateDatabase(path)).toThrow("no Prisma migration history")
	db.exec("DROP TABLE existing_data")
	migrateDatabase(path)
	db.exec("UPDATE _prisma_migrations SET checksum = 'modified'")
	expect(() => migrateDatabase(path)).toThrow("Failed or modified migration")
	db.close()
})
