import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { mkdir, rename, rm, writeFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { createInterface } from "node:readline"

type Config = { baseUrl: string, apiKey: string, userId?: number | null }
type Entry = { id: number, user_id: number | null, project_id: number | null, started_at: string, ended_at: string | null, description: string | null, project?: { name: string } | null }
type Project = { id: number, name: string, archived_at: string | null, client?: { name: string, archived_at: string | null } | null }

class AuthenticationError extends Error {}

export class Tracker {
	constructor(private config: Config) {}

	private async request(path: string, body?: unknown): Promise<any> {
		const response = await fetch(new URL(path, this.config.baseUrl), {
			method: body === undefined ? "GET" : "POST",
			headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.config.apiKey}` },
			body: body === undefined ? undefined : JSON.stringify(body),
			signal: AbortSignal.timeout(8000),
			redirect: "error",
		})
		if (!response.ok) {
			const result = await response.json().catch(() => ({})) as { error?: string }
			if (response.status === 401) throw new AuthenticationError("API key rejected. Enter a valid key from Pupler Settings.")
			throw new Error(result.error || `Pupler returned HTTP ${response.status}`)
		}
		return response.json()
	}

	private async userId(): Promise<number | null> {
		const session = await this.request("/api/auth/session")
		return this.config.userId === undefined ? session.user.id : this.config.userId
	}

	async current(): Promise<Entry | null> {
		const userId = await this.userId()
		const entries: Entry[] = await this.request(`/api/time-entries?running=true&user_id=${userId}`)
		if (!Array.isArray(entries)) throw new Error("Invalid timer response")
		return entries.find(entry => entry.ended_at === null && entry.user_id === userId) ?? null
	}

	async projects(): Promise<Project[]> {
		const projects = await this.request("/api/projects?archived_at=null") as Project[]
		if (!Array.isArray(projects)) throw new Error("Invalid project response")
		return projects.filter(project => project.archived_at === null && !project.client?.archived_at)
	}

	async createProject(name: string): Promise<Project> {
		if (typeof name !== "string" || !name.trim()) throw new Error("Enter a project name.")
		return this.request("/api/projects", { name: name.trim() })
	}

	async start(projectId: number, description = ""): Promise<Entry> {
		if (!Number.isSafeInteger(projectId) || projectId <= 0) throw new Error("Choose a project before starting.")
		if (typeof description !== "string") throw new Error("Description must be text.")
		if (!(await this.projects()).some(project => project.id === projectId)) throw new Error("Project is unavailable. Choose an active project.")
		if (await this.current()) throw new Error("A timer is already running. Stop it before starting another.")
		return this.request("/api/time-entries/start", { user_id: await this.userId(), project_id: projectId, description: description.trim() || null })
	}

	async stop(id: number) {
		const entry = await this.current()
		if (!entry || entry.id !== id) throw new Error("Timer changed. Review the current timer before stopping.")
		if (entry.project_id === null) throw new Error("Choose a project in Pupler before stopping this timer.")
		await this.request(`/api/time-entries/${id}/stop`, {})
	}
}

export class TrackerController {
	constructor(private path: string) {}

	async handle(command: { action: string, id?: number, baseUrl?: string, apiKey?: string, projectId?: number, projectName?: string, description?: string, includeProjects?: boolean }) {
		let config = await Bun.file(this.path).json().catch(() => null) as Config | null
		let needsConfig = !config?.baseUrl || !config?.apiKey
		try {
			if (command.action === "configure") {
				needsConfig = true
				const baseUrl = new URL(command.baseUrl?.trim() || "http://localhost:5995")
				if (!["http:", "https:"].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password) throw new Error("Enter an HTTP or HTTPS server URL without credentials.")
				const apiKey = command.apiKey?.trim() || ""
				if (!/^pupler_[A-Za-z0-9_-]{43}$/.test(apiKey)) throw new Error("Paste a Pupler API key from Settings → API keys.")
				const next: Config = { baseUrl: baseUrl.origin, apiKey, ...(config?.userId !== undefined ? { userId: config.userId } : {}) }
				const entry = await new Tracker(next).current()
				await mkdir(dirname(this.path), { recursive: true, mode: 0o700 })
				const temporary = `${this.path}.${randomUUID()}.tmp`
				try {
					await writeFile(temporary, JSON.stringify(next, null, 4) + "\n", { mode: 0o600, flag: "wx" })
					await rename(temporary, this.path)
				} finally { await rm(temporary, { force: true }) }
				return { entry, error: "", needsConfig: false, baseUrl: next.baseUrl, saved: true }
			}
			if (needsConfig) return { entry: null, error: "", needsConfig: true, baseUrl: config?.baseUrl || "http://localhost:5995" }
			if (config!.userId !== undefined && config!.userId !== null && (!Number.isSafeInteger(config!.userId) || config!.userId <= 0)) throw new Error("userId must be a positive integer or null.")
			const tracker = new Tracker(config!)
			if (command.action === "create-project") {
				const createdProject = await tracker.createProject(command.projectName!)
				return { createdProject, error: "", needsConfig: false, baseUrl: config!.baseUrl }
			}
			if (command.action === "start") {
				const entry = await tracker.start(command.projectId!, command.description)
				return { entry, error: "", needsConfig: false, baseUrl: config!.baseUrl, started: true }
			}
			if (command.action === "stop" && Number.isSafeInteger(command.id)) await tracker.stop(command.id!)
			else if (command.action !== "status") throw new Error("Invalid tracker command")
			const [entry, projects] = await Promise.all([tracker.current(), command.includeProjects ? tracker.projects() : undefined])
			return { entry, projects, error: "", needsConfig: false, baseUrl: config!.baseUrl }
		} catch (error) {
			return { entry: null, error: error instanceof Error ? error.message : "Tracker request failed", needsConfig: needsConfig || error instanceof AuthenticationError, baseUrl: config?.baseUrl || "http://localhost:5995" }
		}
	}
}

if (import.meta.main) {
	const path = process.env.PUPLER_OMARCHY_CONFIG || join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "pupler", "omarchy.json")
	const controller = new TrackerController(path)
	for await (const line of createInterface({ input: process.stdin })) {
		try {
			console.log(JSON.stringify(await controller.handle(JSON.parse(line))))
		} catch {
			console.log(JSON.stringify({ entry: null, error: "Invalid tracker command" }))
		}
	}
}
