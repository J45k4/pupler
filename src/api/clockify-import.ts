import { HttpError, utcNow, type Database, type JsonObject } from "./core"
import { decryptJson } from "./encryption"
import { publishJobUpdate } from "./job-events"
import { ExternalIntegrationStatus } from "./job-types"

type ClockifyConfig = {
	workspace_id: string
	api_base_url?: string
	reports_base_url?: string
}

type ClockifyCredentials = {
	api_key: string
}

type ImportParams = {
	lookback_days?: number | null
	dry_run?: boolean
	target_client_id?: number | null
	user_ids?: string[]
	client_ids?: string[]
	project_ids?: string[]
	from?: string
	to?: string
}

type ImportCursor = {
	last_successful_to?: string
}

type ImportResolutionCache = {
	clientsByName: Map<string, number | null>
	usersByIdentity: Map<string, number | null>
	projectsByExternalId: Map<string, number | null>
}

type ClockifyEntry = {
	id: string
	projectId: string | null
	projectName: string | null
	clientId: string | null
	clientName: string | null
	userId: string | null
	userName: string | null
	userEmail: string | null
	description: string | null
	startedAt: string
	endedAt: string | null
}

type ImportResult = {
	created: {
		clients: number
		projects: number
		users: number
		time_entries: number
		project_links: number
		time_entry_links: number
	}
	updated: {
		projects: number
		time_entries: number
		project_links: number
		time_entry_links: number
	}
	skipped: {
		running_entries: number
		invalid_entries: number
		filtered_entries: number
	}
	errors: Array<{ clockify_time_entry_id?: string; message: string }>
	from: string
	to: string
	dry_run: boolean
}

const FULL_HISTORY_START = "1970-01-01T00:00:00.000Z"
const MAX_REPORT_RANGE_MS = 30 * 24 * 60 * 60 * 1000

const objectIdTimestamp = (value: string) => {
	if (!/^[0-9a-f]{24}$/i.test(value)) return null
	const seconds = Number.parseInt(value.slice(0, 8), 16)
	if (!Number.isFinite(seconds)) return null
	return new Date(seconds * 1000).toISOString()
}

const fullHistoryStart = (config: ClockifyConfig) =>
	process.env.PUPLER_CLOCKIFY_FULL_HISTORY_START ??
	objectIdTimestamp(config.workspace_id) ??
	FULL_HISTORY_START

const emptyResult = (
	from: string,
	to: string,
	dryRun: boolean,
): ImportResult => ({
	created: {
		clients: 0,
		projects: 0,
		users: 0,
		time_entries: 0,
		project_links: 0,
		time_entry_links: 0,
	},
	updated: {
		projects: 0,
		time_entries: 0,
		project_links: 0,
		time_entry_links: 0,
	},
	skipped: {
		running_entries: 0,
		invalid_entries: 0,
		filtered_entries: 0,
	},
	errors: [],
	from,
	to,
	dry_run: dryRun,
})

const asObject = (value: unknown) =>
	value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {}

const asString = (value: unknown) =>
	typeof value === "string" && value.trim() ? value.trim() : null

const nestedString = (
	source: Record<string, unknown>,
	key: string,
	nestedKey = "id",
) => {
	const nested = asObject(source[key])
	return asString(nested[nestedKey])
}

const normalizeDescription = (value: string | null) => {
	if (value === null) return null
	const trimmed = value.trim()
	return trimmed ? trimmed : null
}

const parseClockifyEntry = (raw: unknown): ClockifyEntry | null => {
	const row = asObject(raw)
	const interval = asObject(row.timeInterval)
	const project = asObject(row.project)
	const client = asObject(row.client)
	const user = asObject(row.user)

	const id =
		asString(row.id) ?? asString(row._id) ?? asString(row.timeEntryId)
	const startedAt =
		asString(interval.start) ??
		asString(row.timeIntervalStart) ??
		asString(row.start) ??
		asString(row.startedAt)
	if (!id || !startedAt) return null

	return {
		id,
		projectId:
			asString(row.projectId) ??
			asString(row.project_id) ??
			asString(project.id) ??
			nestedString(row, "project"),
		projectName:
			asString(row.projectName) ??
			asString(row.project_name) ??
			asString(project.name),
		clientId:
			asString(row.clientId) ??
			asString(row.client_id) ??
			asString(client.id) ??
			asString(project.clientId),
		clientName:
			asString(row.clientName) ??
			asString(row.client_name) ??
			asString(client.name) ??
			asString(project.clientName),
		userId:
			asString(row.userId) ??
			asString(row.user_id) ??
			asString(user.id) ??
			nestedString(row, "user"),
		userName:
			asString(row.userName) ??
			asString(row.user_name) ??
			asString(row.user) ??
			asString(user.name),
		userEmail:
			asString(row.userEmail) ??
			asString(row.user_email) ??
			asString(row.email) ??
			asString(user.email),
		description: normalizeDescription(asString(row.description)),
		startedAt,
		endedAt:
			asString(interval.end) ??
			asString(row.timeIntervalEnd) ??
			asString(row.end) ??
			asString(row.endedAt),
	}
}

const parseEntries = (body: unknown) => {
	const root = asObject(body)
	const entries =
		root.timeentries ??
		root.timeEntries ??
		root.data ??
		root.items ??
		(Array.isArray(body) ? body : undefined)
	if (!Array.isArray(entries)) return []
	return entries
		.map(parseClockifyEntry)
		.filter((entry): entry is ClockifyEntry => entry !== null)
}

const fetchClockifyEntriesForRange = async (
	config: ClockifyConfig,
	credentials: ClockifyCredentials,
	from: string,
	to: string,
) => {
	const baseUrl =
		config.reports_base_url ?? "https://reports.api.clockify.me/v1"
	const entries: ClockifyEntry[] = []
	const pageSize = 1000

	for (let page = 1; page < 1000; page += 1) {
		const response = await fetch(
			`${baseUrl.replace(/\/$/, "")}/workspaces/${encodeURIComponent(config.workspace_id)}/reports/detailed`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Api-Key": credentials.api_key,
				},
				body: JSON.stringify({
					dateRangeStart: from,
					dateRangeEnd: to,
					detailedFilter: {
						page,
						pageSize,
					},
				}),
			},
		)
		if (!response.ok) {
			const body = await response.text()
			throw new HttpError(
				502,
				`Clockify request failed with status ${response.status}: ${body.slice(0, 500)}`,
			)
		}

		const pageEntries = parseEntries(await response.json())
		entries.push(...pageEntries)
		if (pageEntries.length < pageSize) break
	}

	return entries
}

const fetchClockifyEntries = async (
	config: ClockifyConfig,
	credentials: ClockifyCredentials,
	from: string,
	to: string,
) => {
	const fromMs = Date.parse(from)
	const toMs = Date.parse(to)
	if (Number.isNaN(fromMs) || Number.isNaN(toMs) || toMs <= fromMs) {
		return []
	}

	const entries: ClockifyEntry[] = []
	for (let startMs = fromMs; startMs < toMs; startMs += MAX_REPORT_RANGE_MS) {
		const endMs = Math.min(startMs + MAX_REPORT_RANGE_MS, toMs)
		entries.push(
			...(await fetchClockifyEntriesForRange(
				config,
				credentials,
				new Date(startMs).toISOString(),
				new Date(endMs).toISOString(),
			)),
		)
	}
	return entries
}

const defaultColor = (name: string) => {
	const colors = ["#ba5a31", "#2d7c6f", "#6f5aa8", "#b7791f", "#3f6f9f"]
	const total = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0)
	return colors[total % colors.length]!
}

const findByName = <T extends { name: string }>(rows: T[], name: string) => {
	const normalized = name.trim().toLowerCase()
	return (
		rows.find((row) => row.name.trim().toLowerCase() === normalized) ?? null
	)
}

const matchesImportFilters = (entry: ClockifyEntry, params: ImportParams) => {
	const userIds = params.user_ids ?? []
	const clientIds = params.client_ids ?? []
	const projectIds = params.project_ids ?? []
	const matchesUser = !userIds.length || (entry.userId !== null && userIds.includes(entry.userId))
	const matchesClient =
		!clientIds.length ||
		(entry.clientId !== null && clientIds.includes(entry.clientId))
	const matchesProject =
		!projectIds.length ||
		(entry.projectId !== null && projectIds.includes(entry.projectId))
	return matchesUser && matchesClient && matchesProject
}

const resolveClient = async (
	db: Database,
	name: string | null,
	dryRun: boolean,
	result: ImportResult,
	cache: ImportResolutionCache,
) => {
	if (!name) return null
	const cacheKey = name.trim().toLowerCase()
	if (cache.clientsByName.has(cacheKey)) {
		return cache.clientsByName.get(cacheKey) ?? null
	}
	const existing = findByName(await db.client.client.findMany(), name)
	if (existing) {
		cache.clientsByName.set(cacheKey, existing.id)
		return existing.id
	}
	if (dryRun) {
		result.created.clients += 1
		cache.clientsByName.set(cacheKey, null)
		return null
	}
	const now = utcNow()
	const created = await db.client.client.create({
		data: {
			name,
			color: defaultColor(name),
			archived_at: null,
			created_at: now,
			updated_at: now,
		},
	})
	result.created.clients += 1
	cache.clientsByName.set(cacheKey, created.id)
	return created.id
}

const resolveTargetClientId = async (
	db: Database,
	targetClientId: number | null | undefined,
) => {
	if (targetClientId === null || targetClientId === undefined) return null
	const client = await db.client.client.findUnique({
		where: { id: targetClientId },
	})
	if (!client) throw new HttpError(400, "Target client does not exist")
	return client.id
}

const resolveUser = async (
	db: Database,
	entry: ClockifyEntry,
	dryRun: boolean,
	result: ImportResult,
	cache: ImportResolutionCache,
) => {
	if (!entry.userEmail && !entry.userName) return null
	const cacheKey = entry.userEmail
		? `email:${entry.userEmail.trim().toLowerCase()}`
		: `name:${entry.userName?.trim().toLowerCase() ?? ""}`
	if (cache.usersByIdentity.has(cacheKey)) {
		return cache.usersByIdentity.get(cacheKey) ?? null
	}
	const users = await db.client.user.findMany()
	const existing = entry.userEmail
		? users.find(
				(user) =>
					user.email?.trim().toLowerCase() ===
					entry.userEmail?.toLowerCase(),
			)
		: findByName(users, entry.userName ?? "")
	if (existing) {
		cache.usersByIdentity.set(cacheKey, existing.id)
		return existing.id
	}
	if (dryRun) {
		result.created.users += 1
		cache.usersByIdentity.set(cacheKey, null)
		return null
	}
	const now = utcNow()
	const created = await db.client.user.create({
		data: {
			name: entry.userName ?? entry.userEmail ?? "Clockify User",
			username: null,
			email: entry.userEmail,
			password_hash: null,
			created_at: now,
			updated_at: now,
		},
	})
	result.created.users += 1
	cache.usersByIdentity.set(cacheKey, created.id)
	return created.id
}

const resolveProject = async (
	db: Database,
	integrationId: number,
	workspaceId: string,
	entry: ClockifyEntry,
	targetClientId: number | null,
	dryRun: boolean,
	result: ImportResult,
	cache: ImportResolutionCache,
) => {
	if (!entry.projectId || !entry.projectName) return null
	const cacheKey = `${workspaceId}:${entry.projectId}`
	if (cache.projectsByExternalId.has(cacheKey)) {
		return cache.projectsByExternalId.get(cacheKey) ?? null
	}

	const existingLink = await db.client.clockifyProjectLink.findUnique({
		where: {
			integration_id_clockify_workspace_id_clockify_project_id: {
				integration_id: integrationId,
				clockify_workspace_id: workspaceId,
				clockify_project_id: entry.projectId,
			},
		},
		include: { project: true },
	})
	const clientId =
		targetClientId ??
		(await resolveClient(db, entry.clientName, dryRun, result, cache))
	const now = utcNow()

	if (existingLink) {
		if (!dryRun) {
			await db.client.project.update({
				where: { id: existingLink.project_id },
				data: {
					name: entry.projectName,
					client_id: clientId,
					updated_at: now,
				},
			})
			await db.client.clockifyProjectLink.update({
				where: { id: existingLink.id },
				data: {
					clockify_client_id: entry.clientId,
					clockify_name: entry.projectName,
					clockify_client_name: entry.clientName,
					last_seen_at: now,
					updated_at: now,
				},
			})
		}
		result.updated.projects += 1
		result.updated.project_links += 1
		cache.projectsByExternalId.set(cacheKey, existingLink.project_id)
		return existingLink.project_id
	}

	if (dryRun) {
		result.created.projects += 1
		result.created.project_links += 1
		cache.projectsByExternalId.set(cacheKey, null)
		return null
	}

	const project = await db.client.project.create({
		data: {
			client_id: clientId,
			name: entry.projectName,
			color: defaultColor(entry.projectName),
			archived_at: null,
			created_at: now,
			updated_at: now,
		},
	})
	await db.client.clockifyProjectLink.create({
		data: {
			integration_id: integrationId,
			project_id: project.id,
			clockify_workspace_id: workspaceId,
			clockify_project_id: entry.projectId,
			clockify_client_id: entry.clientId,
			clockify_name: entry.projectName,
			clockify_client_name: entry.clientName,
			last_seen_at: now,
			created_at: now,
			updated_at: now,
		},
	})
	result.created.projects += 1
	result.created.project_links += 1
	cache.projectsByExternalId.set(cacheKey, project.id)
	return project.id
}

export const importClockifyJob = async (db: Database, jobId: number) => {
	const job = await db.client.job.findUnique({
		where: { id: jobId },
		include: { integration: true, schedule: true },
	})
	if (!job || !job.integration || !job.schedule) {
		throw new HttpError(404, "Clockify import job was not found")
	}
	if (job.integration.status !== ExternalIntegrationStatus.Active) {
		throw new HttpError(400, "External integration is not active")
	}

	const config = JSON.parse(job.integration.config_json) as ClockifyConfig
	const credentials = decryptJson(
		job.integration.credentials_encrypted_json,
	) as ClockifyCredentials & JsonObject
	const params = JSON.parse(job.params_json) as ImportParams
	const cursor = job.cursor_json
		? (JSON.parse(job.cursor_json) as ImportCursor)
		: {}
	const to = params.to ?? utcNow()
	const from =
		params.from ??
		(params.lookback_days === null
			? fullHistoryStart(config)
			: new Date(
					Date.parse(to) -
						(params.lookback_days ?? 14) * 24 * 60 * 60 * 1000,
				).toISOString())
	const dryRun = params.dry_run ?? false
	const targetClientId = await resolveTargetClientId(
		db,
		params.target_client_id,
	)
	const result = emptyResult(from, to, dryRun)
	const entries = await fetchClockifyEntries(config, credentials, from, to)
	const resolutionCache: ImportResolutionCache = {
		clientsByName: new Map(),
		usersByIdentity: new Map(),
		projectsByExternalId: new Map(),
	}

	const initializedJob = await db.client.job.update({
		where: { id: jobId },
		data: {
			total_rows: entries.length,
			updated_at: utcNow(),
		},
	})
	publishJobUpdate(db, initializedJob)

	let processed = 0
	for (const entry of entries) {
		processed += 1
		try {
			if (!matchesImportFilters(entry, params)) {
				result.skipped.filtered_entries += 1
				continue
			}
			if (!entry.endedAt) {
				result.skipped.running_entries += 1
				continue
			}
			if (
				Number.isNaN(Date.parse(entry.startedAt)) ||
				Number.isNaN(Date.parse(entry.endedAt)) ||
				Date.parse(entry.endedAt) <= Date.parse(entry.startedAt)
			) {
				result.skipped.invalid_entries += 1
				result.errors.push({
					clockify_time_entry_id: entry.id,
					message: "Invalid time entry range",
				})
				continue
			}

			const projectId = await resolveProject(
				db,
				job.integration.id,
				config.workspace_id,
				entry,
				targetClientId,
				dryRun,
				result,
				resolutionCache,
			)
			const userId = await resolveUser(
				db,
				entry,
				dryRun,
				result,
				resolutionCache,
			)
			const existingLink =
				await db.client.clockifyTimeEntryLink.findUnique({
					where: {
						integration_id_clockify_workspace_id_clockify_time_entry_id:
							{
								integration_id: job.integration.id,
								clockify_workspace_id: config.workspace_id,
								clockify_time_entry_id: entry.id,
							},
					},
				})
			const now = utcNow()
			if (existingLink) {
				if (!dryRun) {
					await db.client.timeEntry.update({
						where: { id: existingLink.time_entry_id },
						data: {
							user_id: userId,
							project_id: projectId,
							description: entry.description,
							started_at: entry.startedAt,
							ended_at: entry.endedAt,
							updated_at: now,
						},
					})
					await db.client.clockifyTimeEntryLink.update({
						where: { id: existingLink.id },
						data: {
							clockify_project_id: entry.projectId,
							clockify_user_id: entry.userId,
							last_seen_at: now,
							updated_at: now,
						},
					})
				}
				result.updated.time_entries += 1
				result.updated.time_entry_links += 1
				continue
			}

			if (dryRun) {
				result.created.time_entries += 1
				result.created.time_entry_links += 1
				continue
			}
			const timeEntry = await db.client.timeEntry.create({
				data: {
					user_id: userId,
					project_id: projectId,
					description: entry.description,
					started_at: entry.startedAt,
					ended_at: entry.endedAt,
					created_at: now,
					updated_at: now,
				},
			})
			await db.client.clockifyTimeEntryLink.create({
				data: {
					integration_id: job.integration.id,
					time_entry_id: timeEntry.id,
					clockify_workspace_id: config.workspace_id,
					clockify_time_entry_id: entry.id,
					clockify_project_id: entry.projectId,
					clockify_user_id: entry.userId,
					last_seen_at: now,
					created_at: now,
					updated_at: now,
				},
			})
			result.created.time_entries += 1
			result.created.time_entry_links += 1
		} catch (error) {
			result.errors.push({
				clockify_time_entry_id: entry.id,
				message:
					error instanceof Error ? error.message : "Import failed",
			})
		} finally {
			if (processed % 10 === 0 || processed === entries.length) {
				const progressJob = await db.client.job.update({
					where: { id: jobId },
					data: {
						processed_rows: processed,
						updated_at: utcNow(),
					},
				})
				publishJobUpdate(db, progressJob)
			}
		}
	}

	if (!dryRun) {
		cursor.last_successful_to = to
		await db.client.importSchedule.update({
			where: { id: job.schedule.id },
			data: {
				cursor_json: JSON.stringify(cursor),
				updated_at: utcNow(),
			},
		})
	}

	return {
		result,
		cursor,
	}
}
