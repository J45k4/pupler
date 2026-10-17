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

test("shopping list visibility migration preserves members and defaults existing lists to visible", () => {
	const path = databasePath()
	const db = new Database(path)
	const visibilityIndex = migrations.findIndex(migration => migration.name === "20261005000000_add_shopping_list_visibility")
	for (const migration of migrations.slice(0, visibilityIndex)) db.exec(migration.sql)
	db.exec("INSERT INTO users (id, name, created_at, updated_at) VALUES (1, 'Member', '2026-01-01', '2026-01-01')")
	db.exec("INSERT INTO shopping_list_members (shopping_list_id, user_id, role, created_at) VALUES (1, 1, 'viewer', '2026-01-01')")
	const previous = db.query("SELECT * FROM shopping_list_members").all() as Array<Record<string, unknown>>
	db.exec(migrations[visibilityIndex]!.sql)
	const members = db.query("SELECT shopping_list_id, user_id, role, created_at, hidden FROM shopping_list_members").all() as Array<Record<string, unknown> & { hidden: number }>
	expect(members.map(({ hidden, ...member }) => member)).toEqual(previous)
	expect(members.map(member => member.hidden)).toEqual([0])
	db.exec("UPDATE shopping_list_members SET hidden = 1 WHERE user_id = 1")
	expect(db.query("SELECT hidden FROM shopping_list_members WHERE user_id = 1").get()).toEqual({ hidden: 1 })
	db.close()
})

test("combined todo migration preserves todos and shopping lists and creates integer roles", () => {
	const path = databasePath()
	const db = new Database(path)
	const index = migrations.findIndex(migration => migration.name === "20261017000000_add_todo_lists")
	for (const migration of migrations.slice(0, index)) db.exec(migration.sql)
	db.exec("INSERT INTO users (id, name, created_at, updated_at) VALUES (1, 'Alice', '2026-01-01', '2026-01-01'), (2, 'Bob', '2026-01-01', '2026-01-01')")
	db.exec("INSERT INTO todos (id, title, notes, status, due_at, completed_at, created_at, updated_at) VALUES (4, 'Open task', 'Some notes', 1, '2026-10-20', NULL, '2026-01-01', '2026-02-01'), (8, 'Done task', NULL, 2, NULL, '2026-03-01', '2026-01-01', '2026-03-01'), (12, 'Archived task', 'History', 3, NULL, NULL, '2026-01-01', '2026-04-01')")
	db.exec("INSERT INTO shopping_list_members (shopping_list_id, user_id, role, hidden, created_at) VALUES (1, 1, 'viewer', 1, '2026-10-04')")
	const shopping = db.query("SELECT * FROM shopping_list_members").all()
	const original = db.query("SELECT * FROM todos ORDER BY id").all() as Array<Record<string, unknown>>
	db.exec(migrations[index]!.sql)
	const migrated = db.query("SELECT id, title, notes, status, due_at, completed_at, created_at, updated_at, todo_list_id FROM todos ORDER BY id").all() as Array<Record<string, unknown> & { todo_list_id: number }>
	expect(migrated.map(({ todo_list_id, ...todo }) => todo)).toEqual(original)
	expect(migrated.map(todo => todo.todo_list_id)).toEqual([1, 1, 1])
	expect(db.query("SELECT id, name FROM todo_lists").all()).toEqual([{ id: 1, name: "General" }])
	expect(db.query("SELECT todo_list_id, user_id, role, hidden FROM todo_list_members ORDER BY user_id").all()).toEqual([{ todo_list_id: 1, user_id: 1, role: 2, hidden: 0 }, { todo_list_id: 1, user_id: 2, role: 2, hidden: 0 }])
	expect(db.query("SELECT * FROM shopping_list_members").all()).toEqual(shopping)
	expect(db.query("SELECT typeof(role) AS type FROM todo_list_members").all()).toEqual([{ type: "integer" }, { type: "integer" }])
	for (const role of [0, 3, 1.5, "viewer", "editor", null]) expect(() => db.query("UPDATE todo_list_members SET role = ? WHERE todo_list_id = 1 AND user_id = 1").run(role)).toThrow()
	expect(() => db.exec("INSERT INTO todo_list_members (todo_list_id, user_id, role, created_at) VALUES (1, 1, 1, '2026-10-17')")).toThrow()
	db.exec("UPDATE todo_list_members SET role = 1, hidden = 1 WHERE todo_list_id = 1 AND user_id = 2")
	expect(db.query("SELECT role, hidden FROM todo_list_members WHERE todo_list_id = 1 AND user_id = 2").get()).toEqual({ role: 1, hidden: 1 })
	db.exec("PRAGMA foreign_keys = ON")
	expect(() => db.exec("INSERT INTO todos (todo_list_id, title, created_at, updated_at) VALUES (999, 'Orphan', '2026-01-01', '2026-01-01')")).toThrow()
	expect(() => db.exec("UPDATE todo_list_members SET role = 'owner' WHERE user_id = 1")).toThrow()
	db.exec("INSERT INTO users (id, name, created_at, updated_at) VALUES (3, 'New user', '2026-10-17', '2026-10-17')")
	expect(db.query("SELECT * FROM todo_list_members WHERE user_id = 3").all()).toEqual([])
	db.exec("INSERT INTO todos (title, created_at, updated_at) VALUES ('New task', '2026-10-17', '2026-10-17')")
	expect(db.query("SELECT id, todo_list_id FROM todos WHERE title = 'New task'").get()).toEqual({ id: 13, todo_list_id: 1 })
	expect(db.query("PRAGMA foreign_key_check").all()).toEqual([])
	db.exec("DELETE FROM users WHERE id = 2")
	expect(db.query("SELECT count(*) AS count FROM todo_list_members WHERE user_id = 2").get()).toEqual({ count: 0 })
	db.close()
})
