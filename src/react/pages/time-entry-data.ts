import { timeEntryDurationSeconds, type Project, type TimeEntry } from "../lib"

export const rankTimeProjects = (projects: Project[], entries: TimeEntry[]) => {
	const usage = new Map<number, { count: number; seconds: number; latest: string }>()
	for (const entry of entries) {
		if (entry.project_id === null) continue
		const value = usage.get(entry.project_id) ?? { count: 0, seconds: 0, latest: "" }
		value.count++
		value.seconds += timeEntryDurationSeconds(entry)
		if (entry.started_at > value.latest) value.latest = entry.started_at
		usage.set(entry.project_id, value)
	}
	return projects.filter(project => project.archived_at === null).sort((a, b) => {
		const first = usage.get(a.id)
		const second = usage.get(b.id)
		return (second?.count ?? 0) - (first?.count ?? 0) || (second?.seconds ?? 0) - (first?.seconds ?? 0) || (second?.latest ?? "").localeCompare(first?.latest ?? "") || a.name.localeCompare(b.name)
	})
}
