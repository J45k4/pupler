import type { TimeEntry } from "./lib"
import type { TimeReport, TimeReportProjectTotal } from "./pages/time-report-data"
import type { OfflineEntity } from "./offline-data"

export type TimeChange = { before: TimeEntry | null; after: TimeEntry | null }
export type TimeResult = { local_id: number | null; result: OfflineEntity }

export const confirmTimeEntries = (entries: TimeEntry[], results: TimeResult[]) => {
	let next = entries
	for (const { local_id, result } of results) next = next.flatMap(entry => {
		if (entry.id !== local_id && entry.id !== result.id) return [entry]
		return result.deleted ? [] : [{ ...entry, id: result.id, updated_at: result.updated_at }]
	})
	return next
}

export const applyTimeChange = (report: TimeReport, change: TimeChange): TimeReport => {
	const projects = new Map(report.project_totals.map(value => [value.project_id, { ...value }]))
	for (const [entry, direction] of [[change.before, -1], [change.after, 1]] as const) {
		if (!entry) continue
		const start = Math.max(Date.parse(entry.started_at), report.period.from === null ? -Infinity : Date.parse(report.period.from))
		const end = Math.min(Date.parse(entry.ended_at ?? report.period.to), Date.parse(report.period.to))
		const seconds = Math.max(0, Math.floor((end - start) / 1000))
		if (!seconds) continue
		const id = entry.project ? entry.project_id : null
		const previous = projects.get(id)
		const next: TimeReportProjectTotal = {
			project_id: id, project_name: entry.project?.name ?? "No project", project_color: entry.project?.color ?? "#9ca3af",
			client_id: entry.project?.client_id ?? null, client_name: entry.project?.client?.name ?? null, client_color: entry.project?.client?.color ?? null,
			total_seconds: (previous?.total_seconds ?? 0) + direction * seconds, entry_count: (previous?.entry_count ?? 0) + direction,
		}
		if (next.total_seconds <= 0 || next.entry_count <= 0) projects.delete(id)
		else projects.set(id, next)
	}
	const project_totals = [...projects.values()].sort((a, b) => b.total_seconds - a.total_seconds || a.project_name.localeCompare(b.project_name))
	const clients = new Map<string, TimeReport["client_totals"][number]>()
	for (const project of project_totals) {
		const key = project.project_id === null ? "unknown" : String(project.client_id ?? "none")
		const previous = clients.get(key)
		clients.set(key, {
			client_id: project.client_id, client_name: project.project_id === null ? "No project" : project.client_name ?? "No client",
			client_color: project.client_color ?? (project.project_id === null ? "#9ca3af" : "#6b7280"),
			total_seconds: (previous?.total_seconds ?? 0) + project.total_seconds,
			entry_count: (previous?.entry_count ?? 0) + project.entry_count,
			project_count: (previous?.project_count ?? 0) + (project.project_id === null ? 0 : 1),
		})
	}
	return { ...report, total_seconds: project_totals.reduce((sum, project) => sum + project.total_seconds, 0), project_totals,
		client_totals: [...clients.values()].sort((a, b) => b.total_seconds - a.total_seconds || a.client_name.localeCompare(b.client_name)) }
}

export const applyEntryChange = (entries: TimeEntry[], change: TimeChange, from: string, to: string) => {
	const next = entries.filter(entry => entry.id !== change.before?.id && entry.id !== change.after?.id)
	const entry = change.after
	if (entry && Date.parse(entry.started_at) <= Date.parse(to) && (entry.ended_at === null || Date.parse(entry.ended_at) >= Date.parse(from))) next.push(entry)
	return next.sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at) || b.id - a.id)
}
