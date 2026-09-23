import { expect, test } from "bun:test"
import { mkdtemp, mkdir, writeFile, readFile, cp, rm, readlink, readdir, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

// Exercise the actual installer/updater with local release downloads and systemd stubs.
test("release service preserves data and settings and refuses a corrupt update before stopping", async () => {
	const directory = await mkdtemp(join(tmpdir(), "pupler-service-"))
	const root = resolve(import.meta.dir, "..")
	const bin = join(directory, "bin")
	const assets = join(directory, "assets")
	const payload = join(directory, "payload")
	const install = join(directory, "installed")
	const data = join(directory, "existing-data")
	const calls = join(directory, "calls")
	const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, XDG_CONFIG_HOME: join(directory, "config"), PUPLER_INSTALL_DIR: install, PUPLER_DATA_DIR: data, PUPLER_PORT: "54321", PUPLER_RELEASE_VERSION: "v1.0.0", FIXTURE_ASSETS: assets, FIXTURE_CALLS: calls, FIXTURE_BACKUP_FAIL: "0", FIXTURE_STATE: "active" }
	const run = async (args: string[], overrides: Record<string, string> = {}) => {
		const child = Bun.spawn(args, { cwd: root, env: { ...env, ...overrides }, stdout: "pipe", stderr: "pipe" })
		const [code, out, err] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
		return { code, output: out + err }
	}
	const executable = async (name: string, source: string) => writeFile(join(bin, name), `#!/usr/bin/env bash\nset -eu\n${source}\n`, { mode: 0o755 })
	try {
		for (const dir of [bin, assets, payload, data]) await mkdir(dir)
		await writeFile(join(data, "pupler.db"), "existing database")
		await writeFile(join(data, "uploaded-file"), "preserve upload")
		await mkdir(join(data, "files"))
		await writeFile(join(data, "files/receipt.txt"), "uploaded receipt")
		await cp(join(root, "service"), join(payload, "service"), { recursive: true })
		await rm(join(payload, "service/pupler-bun.service"))
		for (const name of ["pupler-server", "pupler-cli", "pupler-create-user"]) await writeFile(join(payload, name), "#!/bin/sh\nexit 0\n", { mode: 0o755 })
		await writeFile(join(payload, "pupler-migrate"), '#!/bin/sh\nset -eu\nif [ "$1" = --backup-only ] && [ "$FIXTURE_BACKUP_FAIL" = 1 ]; then exit 1; fi\nmkdir -p "$(dirname "$2")"\ncp "$DATA_PATH/pupler.db" "$2"\n', { mode: 0o755 })
		await executable("id", 'echo 1000')
		await executable("uname", 'if [[ $1 == -s ]]; then echo Linux; else echo x86_64; fi')
		await executable("systemctl", 'echo "$*" >> "$FIXTURE_CALLS"\ncase "$2" in\ncat) cat "$XDG_CONFIG_HOME/systemd/user/pupler.service" ;;\nshow) echo "$FIXTURE_STATE" ;;\nesac')
		await executable("loginctl", 'echo yes')
		await executable("curl", `output=""; url=""
while [[ $# -gt 0 ]]; do
 case "$1" in
  --output) output="$2"; shift 2 ;;
  https:*) url="$1"; shift ;;
  *) shift ;;
 esac
done
if [[ -n "$output" ]]; then cp "$FIXTURE_ASSETS/$(basename "$url")" "$output"; fi`)
		const packageVersion = async (version: string) => {
			await writeFile(join(payload, "VERSION"), version + "\n")
			const result = await run(["bash", "-c", 'tar -czf "$FIXTURE_ASSETS/pupler-linux-x64.tar.gz" -C "$1" . && cd "$FIXTURE_ASSETS" && sha256sum pupler-linux-x64.tar.gz > pupler-linux-x64.tar.gz.sha256', "fixture", payload])
			expect(result.code).toBe(0)
		}
		await packageVersion("v1.0.0")
		const installed = await run(["bash", "service/install.sh"])
		expect(installed.output).toContain("v1.0.0 is running")
		expect(installed.code).toBe(0)
		const originalConfig = await readFile(join(install, ".env"), "utf8")
		const unit = await readFile(join(env.XDG_CONFIG_HOME, "systemd/user/pupler.service"), "utf8")
		expect(unit).toContain(`Environment=DATA_PATH=${data}`)
		expect(unit).toContain(`ExecStart=${install}/current/pupler-server`)
		await packageVersion("v1.1.0")
		const previous = await readlink(join(install, "current"))
		await writeFile(join(assets, "pupler-linux-x64.tar.gz.sha256"), `${"0".repeat(64)}  pupler-linux-x64.tar.gz\n`)
		await writeFile(calls, "")
		const corrupt = await run(["bash", join(install, "update.sh")], { PUPLER_RELEASE_VERSION: "v1.1.0" })
		expect(corrupt.code).not.toBe(0)
		expect(corrupt.output).toContain("checksum mismatch")
		expect(await readlink(join(install, "current"))).toBe(previous)
		expect(await readFile(calls, "utf8")).not.toContain("stop")
		await packageVersion("v1.1.0")
		const updated = await run(["bash", join(install, "update.sh")], { PUPLER_RELEASE_VERSION: "v1.1.0" })
		expect(updated.output).toContain("v1.1.0 is running")
		expect(updated.code).toBe(0)
		expect(await readFile(join(install, ".env"), "utf8")).toBe(originalConfig)
		expect(await readFile(join(data, "pupler.db"), "utf8")).toBe("existing database")
		expect(await readFile(join(data, "uploaded-file"), "utf8")).toBe("preserve upload")
		expect(await readFile(join(install, "current/VERSION"), "utf8")).toBe("v1.1.0\n")
		await writeFile(calls, "")
		const backup = await run(["bash", join(install, "backup.sh")])
		expect(backup.code).toBe(0)
		expect(backup.output).toContain("Full backup created:")
		const archive = backup.output.trim().split("Full backup created: ")[1]!
		expect((await stat(archive)).mode & 0o777).toBe(0o600)
		const restored = join(directory, "restored")
		await mkdir(restored)
		expect((await run(["tar", "-xzf", archive, "-C", restored])).code).toBe(0)
		expect(await readFile(join(restored, "data/pupler.db"), "utf8")).toBe("existing database")
		expect(await readFile(join(restored, "data/files/receipt.txt"), "utf8")).toBe("uploaded receipt")
		expect(await readFile(join(restored, "settings/install.env"), "utf8")).toBe(originalConfig)
		expect(await readFile(join(restored, "settings/pupler.service"), "utf8")).toBe(unit)
		expect(await readFile(join(restored, "VERSION"), "utf8")).toBe("v1.1.0\n")
		expect(await readFile(calls, "utf8")).toContain("--user stop pupler\n")
		expect(await readFile(calls, "utf8")).toContain("--user start pupler\n")
		await writeFile(calls, "")
		const failed = await run(["bash", join(install, "backup.sh")], { FIXTURE_BACKUP_FAIL: "1" })
		expect(failed.code).not.toBe(0)
		expect(await readFile(calls, "utf8")).toContain("--user start pupler\n")
		expect((await readdir(join(data, "backups"))).filter(name => name.endsWith(".tar.gz"))).toHaveLength(1)
		await writeFile(calls, "")
		const inactive = await run(["bash", join(install, "backup.sh")], { FIXTURE_STATE: "inactive" })
		expect(inactive.code).toBe(0)
		expect(await readFile(calls, "utf8")).not.toContain("--user start")
		expect(await readFile(calls, "utf8")).not.toContain("--user stop")
		await packageVersion("v1.2.0")
		const statusPath = join(install, "update-status.json")
		const webUpdate = await run(["bash", join(install, "current/service/web-update.sh")], {
			PUPLER_RELEASE_VERSION: "v1.2.0",
			PUPLER_UPDATE_STATUS_PATH: statusPath,
		})
		expect(webUpdate.code).toBe(0)
		expect(await readFile(join(install, "current/VERSION"), "utf8")).toBe("v1.2.0\n")
		expect(JSON.parse(await readFile(statusPath, "utf8"))).toMatchObject({ phase: "complete", progress: 100, tag: "v1.2.0" })
		await packageVersion("v1.3.0")
		await writeFile(join(assets, "pupler-linux-x64.tar.gz.sha256"), `${"0".repeat(64)}  pupler-linux-x64.tar.gz\n`)
		const failedWebUpdate = await run(["bash", join(install, "current/service/web-update.sh")], {
			PUPLER_RELEASE_VERSION: "v1.3.0",
			PUPLER_UPDATE_STATUS_PATH: statusPath,
		})
		expect(failedWebUpdate.code).not.toBe(0)
		expect(await readFile(join(install, "current/VERSION"), "utf8")).toBe("v1.2.0\n")
		expect(JSON.parse(await readFile(statusPath, "utf8"))).toMatchObject({ phase: "failed", tag: "v1.3.0" })

	} finally { await rm(directory, { recursive: true, force: true }) }
})
