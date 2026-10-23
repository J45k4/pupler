import { useEffect, useRef } from "react"
import { useApi, type TimeEntry } from "../lib"
import type { ProjectUsage } from "./time-entry-data"

export type TimePageData = {
	entries: TimeEntry[]
	total: number
	offset: number
	limit: number
	running: TimeEntry | null
	previous_ended_at: string | null
	quick_actions: Array<ProjectUsage & { description: string }>
	project_usage: ProjectUsage[]
}

export const useTimePage = (offset: number) => {
	const latest = useRef<TimePageData | null>(null)
	const { data, error, loading, reload } = useApi<TimePageData>(`/api/time-entries?view=timer&offset=${offset}`)
	if (data) latest.current = data
	useEffect(() => {
		const refresh = () => { if (document.visibilityState === "visible") reload() }
		window.addEventListener("online", refresh)
		document.addEventListener("visibilitychange", refresh)
		return () => {
			window.removeEventListener("online", refresh)
			document.removeEventListener("visibilitychange", refresh)
		}
	}, [reload])
	return { data, summary: latest.current, error, loading, reload }
}
