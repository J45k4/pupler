import type { TimeUser } from "./time-ownership"
import { scopeTimeOwner } from "./time-ownership"
import { HttpError, parseIntegerQuery, type Database } from "./core"

export const TIME_PAGE_SIZE = 50

const scope = (user: TimeUser, url: URL, allowed: string[]) => {
	for (const key of url.searchParams.keys()) {
		if (!["view", "user_id", ...allowed].includes(key)) throw new HttpError(400, `Unknown query parameter \`${key}\``)
	}
	const requested = url.searchParams.get("user_id")
	const owner = scopeTimeOwner(user, requested === null ? undefined : requested === "null" ? null : parseIntegerQuery("user_id", requested)) as number | null | undefined
	return { all: owner === undefined ? 1 : 0, owner: owner ?? null, where: owner === undefined ? {} : { user_id: owner } }
}

type UsageRow = { project_id: number; entry_count: number | bigint; total_seconds: number | bigint; latest_started_at: string }
const duration = "CAST(MAX(0, ROUND((julianday(COALESCE(e.ended_at, ?)) - julianday(e.started_at)) * 86400000)) / 1000 AS INTEGER)"

export const fetchTimePage = async (db: Database, user: TimeUser, url: URL, include: object) => {
	const owner = scope(user, url, ["offset"])
	const rawOffset = url.searchParams.get("offset") ?? "0"
	const offset = /^\d+$/.test(rawOffset) ? Number(rawOffset) : NaN
	if (!Number.isSafeInteger(offset) || offset < 0) throw new HttpError(400, "Offset must be a non-negative safe integer")
	const where = { ...owner.where, ended_at: { not: null } }
	const total = await db.client.timeEntry.count({ where })
	const pageOffset = Math.min(offset, Math.max(0, Math.floor((total - 1) / TIME_PAGE_SIZE) * TIME_PAGE_SIZE))
	const now = new Date().toISOString()
	const [entries, running, previous, quickRows, usageRows] = await Promise.all([
		db.client.timeEntry.findMany({ where, orderBy: [{ started_at: "desc" }, { id: "desc" }], take: TIME_PAGE_SIZE, skip: pageOffset, include }),
		db.client.timeEntry.findFirst({ where: { ...owner.where, ended_at: null }, orderBy: [{ started_at: "desc" }, { id: "desc" }], include }),
		db.client.timeEntry.findFirst({ where, orderBy: [{ ended_at: "desc" }, { id: "desc" }], select: { ended_at: true } }),
		db.client.$queryRawUnsafe<Array<UsageRow & { description: string }>>(`
			SELECT e.project_id, TRIM(COALESCE(e.description, '')) AS description, COUNT(*) AS entry_count,
				SUM(${duration}) AS total_seconds, MAX(e.started_at) AS latest_started_at
			FROM time_entries e JOIN projects p ON p.id = e.project_id
			WHERE p.archived_at IS NULL AND (? = 1 OR e.user_id IS ?)
			GROUP BY e.project_id, TRIM(COALESCE(e.description, ''))
			ORDER BY entry_count DESC, latest_started_at DESC, e.project_id, description LIMIT 8
		`, now, owner.all, owner.owner),
		db.client.$queryRawUnsafe<UsageRow[]>(`
			SELECT e.project_id, COUNT(*) AS entry_count, SUM(${duration}) AS total_seconds, MAX(e.started_at) AS latest_started_at
			FROM time_entries e JOIN projects p ON p.id = e.project_id
			WHERE p.archived_at IS NULL AND (? = 1 OR e.user_id IS ?)
			GROUP BY e.project_id
		`, now, owner.all, owner.owner),
	])
	const normalize = <T extends UsageRow>(row: T) => ({ ...row, project_id: Number(row.project_id), entry_count: Number(row.entry_count), total_seconds: Number(row.total_seconds) })
	return { entries, total, offset: pageOffset, limit: TIME_PAGE_SIZE, running, previous_ended_at: previous?.ended_at ?? null, quick_actions: quickRows.map(normalize), project_usage: usageRows.map(normalize) }
}

export const fetchTimeDescriptions = async (db: Database, user: TimeUser, url: URL) => {
	const owner = scope(user, url, ["project_id", "q"])
	const project = parseIntegerQuery("project_id", url.searchParams.get("project_id") ?? "")
	if (project <= 0) throw new HttpError(400, "Project must be a positive integer")
	const query = (url.searchParams.get("q") ?? "").trim().toLowerCase()
	const rows = await db.client.$queryRawUnsafe<Array<{ text: string; count: number | bigint; latest: string }>>(`
		SELECT TRIM(e.description) AS text, COUNT(*) AS count, MAX(e.started_at) AS latest
		FROM time_entries e
		WHERE e.project_id = ? AND (? = 1 OR e.user_id IS ?) AND TRIM(COALESCE(e.description, '')) <> ''
			AND INSTR(LOWER(TRIM(e.description)), ?) > 0
		GROUP BY LOWER(TRIM(e.description))
		ORDER BY latest DESC, count DESC, text LIMIT 12
	`, project, owner.all, owner.owner, query)
	return rows.map(row => ({ ...row, count: Number(row.count) }))
}
