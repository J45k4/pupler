import { Database } from "bun:sqlite"
import { mkdirSync, existsSync } from "node:fs"
import { dirname } from "node:path"
import { resolveDatabasePath } from "../src/config"
import { migrateDatabase } from "../src/migrations"

const path = resolveDatabasePath()
const args = Bun.argv.slice(2)
if (args.length && (args.length !== 2 || !["--backup", "--backup-only"].includes(args[0]!))) throw new Error("Usage: pupler-migrate [--backup PATH | --backup-only PATH]")
if (args[0] === "--backup-only" && !existsSync(path)) throw new Error(`Database not found: ${path}`)
if (args[1] && existsSync(path)) {
	mkdirSync(dirname(args[1]), { recursive: true })
	const db = new Database(path, { readonly: true })
	try { db.query("VACUUM INTO ?").run(args[1]) }
	finally { db.close() }
	const backup = new Database(args[1], { readonly: true })
	try {
		const result = backup.query("PRAGMA integrity_check").all() as { integrity_check: string }[]
		if (result.length !== 1 || result[0]?.integrity_check !== "ok") throw new Error("Backup database integrity check failed")
	} finally { backup.close() }
	console.log(`Database backup: ${args[1]}`)
}
if (args[0] !== "--backup-only") migrateDatabase(path)
