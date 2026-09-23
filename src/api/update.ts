import { realpath, readFile, stat, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join, resolve } from "node:path"

import { resolvePuplerVersion } from "../config"
import { HttpError } from "./core"

type UpdateStatus = {
	phase: string
	progress: number
	tag: string
	message: string
}

const REPOSITORY = process.env.PUPLER_RELEASE_REPOSITORY ?? "J45k4/pupler"
const INSTALL_DIR = resolve(process.env.PUPLER_INSTALL_DIR ?? join(homedir(), ".pupler"))
const STATUS_PATH = join(INSTALL_DIR, "update-status.json")
const PROGRESS_PATH = join(INSTALL_DIR, "update-download.progress")
const RUNNER_PATH = join(INSTALL_DIR, "current/service/web-update.sh")
const UPDATE_PHASES = new Set(["starting", "downloading", "verifying", "backing_up", "migrating", "restarting"])

let latestCache: { tag: string; expiresAt: number } | null = null
let starting = false

export const compareReleaseVersions = (left: string, right: string) => {
	const parse = (version: string) => {
		const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-local\.(\d+))?$/.exec(version)
		return match ? [...match.slice(1, 4).map(Number), match[4] ? -1 : 0] : null
	}
	const a = parse(left)
	const b = parse(right)
	if (!a || !b) return null
	for (let index = 0; index < 4; index += 1) {
		if (a[index]! !== b[index]!) return Math.sign(a[index]! - b[index]!)
	}
	return 0
}

const releaseInstallation = async () => {
	try {
		return (await realpath(join(INSTALL_DIR, "current/pupler-server"))) === (await realpath(process.execPath)) &&
			(await realpath(RUNNER_PATH)).startsWith(`${await realpath(INSTALL_DIR)}/`)
	} catch {
		return false
	}
}

const latestRelease = async () => {
	if (latestCache && latestCache.expiresAt > Date.now()) return latestCache.tag
	if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(REPOSITORY)) throw new Error("Invalid release repository")
	const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/releases/latest`, {
		headers: { Accept: "application/vnd.github+json", "User-Agent": "Pupler" },
		signal: AbortSignal.timeout(8000),
	})
	if (!response.ok) throw new Error(`Release check failed (${response.status})`)
	const body = await response.json() as { tag_name?: unknown }
	if (typeof body.tag_name !== "string" || !/^v\d+\.\d+\.\d+$/.test(body.tag_name)) throw new Error("Invalid release tag")
	latestCache = { tag: body.tag_name, expiresAt: Date.now() + 5 * 60_000 }
	return body.tag_name
}

const readStatus = async (): Promise<UpdateStatus | null> => {
	try {
		const status = JSON.parse(await readFile(STATUS_PATH, "utf8")) as UpdateStatus
		if (UPDATE_PHASES.has(status.phase) && Date.now() - (await stat(STATUS_PATH)).mtimeMs > 30 * 60_000) {
			return { ...status, phase: "failed", message: "Updater stopped responding; check update.log" }
		}
		if (status.phase === "downloading") {
			const progress = await readFile(PROGRESS_PATH, "utf8").catch(() => "")
			const percentages = [...progress.matchAll(/(\d+(?:\.\d+)?)%/g)]
			if (percentages.length) status.progress = Math.max(status.progress, Math.min(55, Math.round(Number(percentages.at(-1)![1]) * 0.55)))
		}
		return status
	} catch {
		return null
	}
}

export const updateStatusRoute = async (req: Request) => {
	if (req.method !== "GET" && req.method !== "POST") throw new HttpError(405, "Method not allowed for this route")
	if (req.headers.has("authorization")) throw new HttpError(403, "Sign in with your password to update Pupler")
	const version = resolvePuplerVersion()
	const supported = await releaseInstallation()
	const status = supported ? await readStatus() : null
	if (req.method === "GET") {
		let latest: string | null = null
		let checkError: string | null = null
		if (supported) {
			try { latest = await latestRelease() } catch { checkError = "Could not check for updates" }
		}
		return Response.json({ version, supported, latest, available: latest ? compareReleaseVersions(latest, version) === 1 : false, status, check_error: checkError })
	}
	if (!supported) throw new HttpError(409, "In-app updates require a release-based user service")
	if (starting) throw new HttpError(409, "An update is already starting")
	if (status && UPDATE_PHASES.has(status.phase)) throw new HttpError(409, "An update is already running")
	starting = true
	try {
		let latest: string
		try { latest = await latestRelease() } catch { throw new HttpError(502, "Could not check for updates") }
		if (compareReleaseVersions(latest, version) !== 1) throw new HttpError(409, "Pupler is already up to date")
		await writeFile(STATUS_PATH, JSON.stringify({ phase: "starting", progress: 0, tag: latest, message: "Starting update" }), { mode: 0o600 })
		await writeFile(PROGRESS_PATH, "", { mode: 0o600 })
		const unit = `pupler-web-update-${Date.now()}`
		const command = ["systemd-run", "--user", "--collect", `--unit=${unit}`, `--setenv=PUPLER_INSTALL_DIR=${INSTALL_DIR}`, `--setenv=PUPLER_RELEASE_VERSION=${latest}`, `--setenv=PUPLER_UPDATE_STATUS_PATH=${STATUS_PATH}`, "/usr/bin/bash", RUNNER_PATH]
		const child = Bun.spawn(command, { stdout: "ignore", stderr: "pipe" })
		const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()])
		if (exitCode !== 0) {
			await writeFile(STATUS_PATH, JSON.stringify({ phase: "failed", progress: 0, tag: latest, message: "Could not start updater" }), { mode: 0o600 })
			throw new HttpError(500, `Could not start updater: ${stderr.trim().slice(0, 200)}`)
		}
		return Response.json({ started: true, tag: latest }, { status: 202 })
	} finally {
		starting = false
	}
}
