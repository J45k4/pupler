import { useCallback, useEffect, useRef, useState } from "react"
import { apiFetch } from "../api"
import type { TimeEntry } from "../lib"
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
	const [revision, setRevision] = useState(0)
	const key = `${offset}:${revision}`
	const [result, setResult] = useState<{ key: string; data: TimePageData | null; error: string | null }>({ key: "", data: null, error: null })
	const reload = useCallback(() => setRevision(value => value + 1), [])
	useEffect(() => {
		const controller = new AbortController()
		void apiFetch<TimePageData>(`/api/time-entries?view=timer&offset=${offset}`, { signal: controller.signal }).then(data => {
			if (!controller.signal.aborted) {
				latest.current = data
				setResult({ key, data, error: null })
			}
		}).catch(error => {
			if (!controller.signal.aborted) setResult({ key, data: null, error: error instanceof Error ? error.message : "Could not load time entries." })
		})
		return () => controller.abort()
	}, [offset, key])
	const data = result.key === key ? result.data : null
	const error = result.key === key ? result.error : null
	return { data, summary: latest.current, error, loading: !data && !error, reload }
}
