import { db } from "../db"
import {
	HttpError,
	json,
	parseIntegerQuery,
	parseTimestampQuery,
	type Database,
} from "./core"

const QUERY_FIELDS = new Set(["from", "to", "range", "user_id"])

type TimeReportPeriod = {
	from: string | null
	to: string
	range: "custom" | "all"
	user_id: number | null | undefined
}

type TimeReportProjectTotal = {
	project_id: number | null
	project_name: string
	project_color: string
	client_id: number | null
	client_name: string | null
	client_color: string | null
	total_seconds: number
	entry_count: number
}

type TimeReportClientTotal = {
	client_id: number | null
	client_name: string
	client_color: string
	total_seconds: number
	entry_count: number
	project_count: number
}

type MutableTimeReportClientTotal = TimeReportClientTotal & {
	project_ids: Set<number>
}

const NO_PROJECT_TIME_COLOR = "#9ca3af"

const parseTimeReportQuery = (url: URL): TimeReportPeriod => {
	for (const key of url.searchParams.keys()) {
		if (!QUERY_FIELDS.has(key)) {
			throw new HttpError(400, `Unknown query parameter \`${key}\``)
		}
	}

	const toParam = url.searchParams.get("to")
	const to = toParam
		? parseTimestampQuery("to", toParam)
		: new Date().toISOString()
	const rangeParam = url.searchParams.get("range")
	const fromParam = url.searchParams.get("from")
	const userIdParam = url.searchParams.get("user_id")
	const user_id =
		userIdParam === null
			? undefined
			: userIdParam === "null"
				? null
				: parseIntegerQuery("user_id", userIdParam)

	if (rangeParam !== null && rangeParam !== "all") {
		throw new HttpError(400, "Query parameter `range` must be `all`")
	}
	if (rangeParam === "all") {
		if (fromParam !== null) {
			throw new HttpError(400, "Use `range=all` without `from`")
		}
		return { from: null, to, range: "all", user_id }
	}

	const from = fromParam ? parseTimestampQuery("from", fromParam) : null
	if (from !== null && Date.parse(from) > Date.parse(to)) {
		throw new HttpError(400, "Query parameter `from` must be before `to`")
	}

	return { from, to, range: "custom", user_id }
}

const entryDurationSeconds = (
	entry: { started_at: string; ended_at: string | null },
	period: TimeReportPeriod,
) => {
	const startMs = Math.max(
		Date.parse(entry.started_at),
		period.from === null
			? Number.NEGATIVE_INFINITY
			: Date.parse(period.from),
	)
	const endMs = Math.min(
		Date.parse(entry.ended_at ?? period.to),
		Date.parse(period.to),
	)
	return Math.max(0, Math.floor((endMs - startMs) / 1000))
}

export const timeReportRoute = async (req: Request) => {
	if (req.method !== "GET") {
		throw new HttpError(405, "Method not allowed for this route")
	}

	const url = new URL(req.url)
	const period = parseTimeReportQuery(url)
	const entries = await db.client.timeEntry.findMany({
		where: {
			...(period.user_id === undefined
				? {}
				: { user_id: period.user_id }),
			started_at: { lte: period.to },
			...(period.from === null
				? {}
				: {
						OR: [
							{ ended_at: null },
							{ ended_at: { gte: period.from } },
						],
					}),
		},
		include: {
			user: {
				select: {
					id: true,
					name: true,
					email: true,
				},
			},
			project: {
				select: {
					id: true,
					name: true,
					color: true,
					archived_at: true,
					client_id: true,
					client: {
						select: {
							id: true,
							name: true,
							color: true,
							archived_at: true,
						},
					},
				},
			},
		},
		orderBy: [{ started_at: "desc" }, { id: "desc" }],
	})

	const projectTotals = new Map<string, TimeReportProjectTotal>()
	const clientTotals = new Map<string, MutableTimeReportClientTotal>()
	let totalSeconds = 0

	for (const entry of entries) {
		const seconds = entryDurationSeconds(entry, period)
		if (seconds <= 0) continue
		totalSeconds += seconds
		if (entry.project_id === null || entry.project === null) {
			const existingProject = projectTotals.get("unknown")
			if (existingProject) {
				existingProject.total_seconds += seconds
				existingProject.entry_count += 1
			} else {
				projectTotals.set("unknown", {
					project_id: null,
					project_name: "No project",
					project_color: NO_PROJECT_TIME_COLOR,
					client_id: null,
					client_name: null,
					client_color: null,
					total_seconds: seconds,
					entry_count: 1,
				})
			}

			const existingClient = clientTotals.get("unknown")
			if (existingClient) {
				existingClient.total_seconds += seconds
				existingClient.entry_count += 1
			} else {
				clientTotals.set("unknown", {
					client_id: null,
					client_name: "No project",
					client_color: NO_PROJECT_TIME_COLOR,
					total_seconds: seconds,
					entry_count: 1,
					project_count: 0,
					project_ids: new Set(),
				})
			}
			continue
		}

		const projectKey = String(entry.project_id)
		const existingProject = projectTotals.get(projectKey)
		if (existingProject) {
			existingProject.total_seconds += seconds
			existingProject.entry_count += 1
		} else {
			projectTotals.set(projectKey, {
				project_id: entry.project_id,
				project_name: entry.project.name,
				project_color: entry.project.color,
				client_id: entry.project.client_id,
				client_name: entry.project.client?.name ?? null,
				client_color: entry.project.client?.color ?? null,
				total_seconds: seconds,
				entry_count: 1,
			})
		}

		const clientKey =
			entry.project.client_id === null
				? "none"
				: String(entry.project.client_id)
		const existingClient = clientTotals.get(clientKey)
		if (existingClient) {
			existingClient.total_seconds += seconds
			existingClient.entry_count += 1
			existingClient.project_ids.add(entry.project_id)
		} else {
			clientTotals.set(clientKey, {
				client_id: entry.project.client_id,
				client_name: entry.project.client?.name ?? "No client",
				client_color: entry.project.client?.color ?? "#6b7280",
				total_seconds: seconds,
				entry_count: 1,
				project_count: 1,
				project_ids: new Set([entry.project_id]),
			})
		}
	}

	const runningEntry =
		entries.find((entry) => entry.ended_at === null) ?? null
	const sortedProjectTotals = [...projectTotals.values()].sort(
		(left, right) =>
			right.total_seconds - left.total_seconds ||
			left.project_name.localeCompare(right.project_name),
	)
	const sortedClientTotals = [...clientTotals.values()]
		.map(({ project_ids, ...client }) => ({
			...client,
			project_count: project_ids.size,
		}))
		.sort(
			(left, right) =>
				right.total_seconds - left.total_seconds ||
				left.client_name.localeCompare(right.client_name),
		)
	const responsePeriod = {
		from: period.from,
		to: period.to,
		range: period.range,
		...(period.user_id === undefined ? {} : { user_id: period.user_id }),
	}

	return json(200, {
		period: responsePeriod,
		total_seconds: totalSeconds,
		running_entry: runningEntry,
		project_totals: sortedProjectTotals,
		client_totals: sortedClientTotals,
	})
}
