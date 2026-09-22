import { cp, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { Database } from "bun:sqlite"
import { getFreePort } from "../test/support/test-server"

const temporary = await mkdtemp(join(tmpdir(), "pupler-release-"))
const env = { PATH: process.env.PATH, DATA_PATH: join(temporary, "data"), NODE_ENV: "production", PUPLER_DISABLE_JOB_WORKER: "true", BIND_ADDRESS: "127.0.0.1", PORT: String(await getFreePort()) }
let server: Bun.Subprocess<"ignore", "pipe", "pipe"> | undefined
const run = async (binary: string, args: string[] = [], overrides: Record<string, string> = {}) => {
	const child = Bun.spawn([join(temporary, binary), ...args], { cwd: temporary, env: { ...env, ...overrides }, stdin: "ignore", stdout: "pipe", stderr: "pipe" })
	const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
	if (code) throw new Error(`${binary} exited ${code}: ${stderr}`)
	return stdout
}
try {
	for (const binary of ["pupler-server", "pupler-cli", "pupler-migrate", "pupler-create-user"]) {
		await cp(resolve("dist/release", binary), join(temporary, binary))
	}
	const untouchedPath = join(temporary, "unmigrated.db")
	const untouched = new Database(untouchedPath, { create: true })
	untouched.exec("CREATE TABLE example (value TEXT); INSERT INTO example VALUES ('preserved')")
	untouched.close()
	const backupOnlyPath = join(temporary, "backup-only.db")
	await run("pupler-migrate", ["--backup-only", backupOnlyPath], { DB_PATH: untouchedPath })
	for (const path of [untouchedPath, backupOnlyPath]) {
		const checked = new Database(path, { readonly: true })
		if (checked.query("SELECT name FROM sqlite_master WHERE name = '_prisma_migrations'").get()) throw new Error("Backup unexpectedly migrated the database")
		if ((checked.query("SELECT value FROM example").get() as { value: string }).value !== "preserved") throw new Error("Backup lost data")
		checked.close()
	}
	await run("pupler-migrate")
	await run("pupler-migrate", ["--backup", join(temporary, "backup.db")])
	await run("pupler-create-user", ["--name", "Smoke", "--username", "smoke", "--password", "release-smoke-password"])
	await run("pupler-cli", ["--help"])
	const db = new Database(join(env.DATA_PATH, "pupler.db"), { readonly: true })
	if (!db.query("SELECT id FROM users WHERE username = 'smoke' AND is_admin = 1").get()) throw new Error("Admin missing")
	db.close()
	server = Bun.spawn([join(temporary, "pupler-server")], { cwd: temporary, env, stdin: "ignore", stdout: "pipe", stderr: "pipe" })
	const base = `http://127.0.0.1:${env.PORT}`
	let ready = false
	for (let attempt = 0; attempt < 100; attempt++) {
		if (await fetch(`${base}/health`).then(r => r.ok).catch(() => false)) { ready = true; break }
		if (server.exitCode !== null) throw new Error(await new Response(server.stderr).text())
		await Bun.sleep(100)
	}
	if (!ready) throw new Error("Standalone server did not start")
	for (const path of ["/", "/react", "/favicon.png"]) {
		const response = await fetch(`${base}${path}`)
		if (!response.ok) throw new Error(`Failed to serve ${path}: ${response.status}`)
		if (path.endsWith(".png")) {
			const bytes = new Uint8Array(await response.arrayBuffer())
			if (bytes[0] !== 137 || bytes[1] !== 80) throw new Error("Favicon is not a PNG")
			continue
		}
		const html = await response.text()
		const assets = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g)]
		if (!assets.length) throw new Error(`No bundled assets found in ${path}`)
		for (const [, asset] of assets) {
			const result = await fetch(new URL(asset!, base + path))
			if (!result.ok || !(await result.text()).length) throw new Error(`Missing asset: ${asset}`)
		}
	}
	const login = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "smoke", password: "release-smoke-password" }) })
	if (!login.ok) throw new Error(`Standalone database login failed: ${await login.text()}`)
	const version = await fetch(`${base}/version`, { headers: { Cookie: login.headers.get("set-cookie")!.split(";")[0]! } }).then(r => r.json()) as { version: string }
	const expected = (await Bun.file("dist/release/VERSION").text()).trim()
	if (version.version !== expected) throw new Error(`Wrong embedded version: ${version.version}`)
	console.log(`Standalone ${expected}: migration, backup, admin creation, login, HTML, JS/CSS and favicon passed`)
} finally {
	server?.kill()
	if (server) await server.exited
	await rm(temporary, { recursive: true, force: true })
}
