import { afterEach, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
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

test("binary migrations reuse Prisma deploy history and remain compatible with Prisma", async () => {
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
