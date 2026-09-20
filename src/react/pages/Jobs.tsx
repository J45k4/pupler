import { useEffect, useState } from "react"
import { apiFetch } from "../api"
import { Empty, Status } from "../lib"

type Job = {
	id: number
	schedule_id: number | null
	integration_id: number | null
	type: number
	status: number
	total_rows: number
	processed_rows: number
	result_json: string | null
	error_message: string | null
	started_at: string | null
	finished_at: string | null
	created_at: string
}

const JOB_STATUS = { Pending: 1, Running: 2, Completed: 3, Failed: 4 }

const jobStatusLabel = (status: number) =>
	status === JOB_STATUS.Pending
		? "Pending"
		: status === JOB_STATUS.Running
			? "Running"
			: status === JOB_STATUS.Completed
				? "Completed"
				: status === JOB_STATUS.Failed
					? "Failed"
					: `Status ${status}`

const formatDateTime = (value: string | null | undefined) =>
	value
		? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
		: "Not set"

const parseJson = <T,>(value: string | null, fallback: T): T => {
	if (!value) return fallback
	try {
		return JSON.parse(value) as T
	} catch {
		return fallback
	}
}

const jobSummary = (job: Job) => {
	if (job.error_message) return job.error_message
	const result = parseJson<{
		created?: { time_entries?: number }
		updated?: { time_entries?: number }
		skipped?: { running_entries?: number; invalid_entries?: number; filtered_entries?: number }
	}>(job.result_json, {})
	const skipped =
		(result.skipped?.running_entries ?? 0) +
		(result.skipped?.invalid_entries ?? 0) +
		(result.skipped?.filtered_entries ?? 0)
	return `${result.created?.time_entries ?? 0} created, ${result.updated?.time_entries ?? 0} updated, ${skipped} skipped`
}

export const JobsPage = () => {
	const [jobs, setJobs] = useState<Job[]>([])
	const [status, setStatus] = useState("Loading jobs...")
	const [statusError, setStatusError] = useState(false)

	useEffect(() => {
		let disposed = false
		let events: EventSource | null = null

		const upsert = (job: Job) =>
			setJobs((prev) => {
				const index = prev.findIndex((existing) => existing.id === job.id)
				const next = index === -1 ? [...prev, job] : prev.map((existing) => (existing.id === job.id ? job : existing))
				next.sort((l, r) => r.id - l.id)
				return next
			})

		const load = async () => {
			try {
				const rows = await apiFetch<Job[]>("/api/jobs")
				if (disposed) return
				setJobs([...rows].sort((l, r) => r.id - l.id))
				setStatus("Jobs loaded.")
			} catch (err) {
				if (disposed) return
				setStatus(err instanceof Error ? err.message : "Failed to load jobs.")
				setStatusError(true)
			}
		}

		const connect = () => {
			events = new EventSource("/api/jobs/events")
			events.addEventListener("ready", () => {
				if (!disposed) setStatus("Live updates connected.")
			})
			events.addEventListener("job", (event) => {
				if (!(event instanceof MessageEvent) || disposed) return
				try {
					upsert(JSON.parse(event.data) as Job)
					setStatus("Job progress updated.")
				} catch {
					setStatus("Received an invalid job update.")
					setStatusError(true)
				}
			})
			events.onerror = () => {
				if (!disposed) {
					setStatus("Live updates disconnected. Reconnecting...")
					setStatusError(true)
				}
			}
		}

		void load().then(() => {
			if (!disposed) connect()
		})
		return () => {
			disposed = true
			events?.close()
		}
	}, [])

	const refresh = async () => {
		setStatus("Loading jobs...")
		setStatusError(false)
		try {
			const rows = await apiFetch<Job[]>("/api/jobs")
			setJobs([...rows].sort((l, r) => r.id - l.id))
			setStatus("Jobs loaded.")
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to load jobs.")
			setStatusError(true)
		}
	}

	return (
		<>
			<section className="page-heading page-heading--compact">
				<div>
					<h1 className="page-title">Jobs</h1>
				</div>
				<button id="jobs-refresh-button" className="secondary" type="button" onClick={() => void refresh()}>
					Refresh
				</button>
			</section>
			<section className="workspace workspace--single">
				<div className="card panel">
					<div className="section-header">
						<h2>Job History</h2>
						<Status message={status} error={statusError} />
					</div>
					<div id="jobs-list" className="integration-list">
						{jobs.length === 0 ? <Empty message="No jobs yet." /> : null}
						{jobs.map((job) => (
							<div key={job.id} className="integration-row">
								<div>
									<strong>Job {job.id}</strong>
									<div className="section-copy">{jobSummary(job)}</div>
									<div className="section-copy">
										Schedule {job.schedule_id ?? "manual"} · Integration {job.integration_id ?? "none"}
									</div>
								</div>
								<div className="integration-row__meta">
									<span className="tag">{jobStatusLabel(job.status)}</span>
									<span>
										{job.processed_rows}/{job.total_rows}
									</span>
									<span>Started {formatDateTime(job.started_at)}</span>
									<span>Finished {formatDateTime(job.finished_at)}</span>
									<span>Created {formatDateTime(job.created_at)}</span>
								</div>
							</div>
						))}
					</div>
				</div>
			</section>
		</>
	)
}
