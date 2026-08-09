import { escapeHtml, renderPage, setStatus } from "../app"

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

const JOB_STATUS = {
	Pending: 1,
	Running: 2,
	Completed: 3,
	Failed: 4,
}

let currentJobs: Job[] = []

const apiJson = async <T>(path: string, options: RequestInit = {}) => {
	const response = await fetch(path, {
		...options,
		headers: {
			...(options.body ? { "Content-Type": "application/json" } : {}),
			...(options.headers ?? {}),
		},
	})
	const body = (await response.json()) as T | { error?: string }
	if (!response.ok) {
		throw new Error(
			typeof body === "object" && body !== null && "error" in body
				? (body.error ?? "Request failed")
				: "Request failed",
		)
	}
	return body as T
}

const formatDateTime = (value: string | null | undefined) =>
	value
		? new Intl.DateTimeFormat(undefined, {
				dateStyle: "medium",
				timeStyle: "short",
			}).format(new Date(value))
		: "Not set"

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

const parseJson = <T>(value: string | null, fallback: T): T => {
	if (!value) return fallback
	try {
		return JSON.parse(value) as T
	} catch {
		return fallback
	}
}

const renderJobRows = (jobs: Job[]) => {
	const root = document.getElementById("jobs-list")
	if (!root) return
	if (!jobs.length) {
		root.innerHTML = '<div class="empty">No jobs yet.</div>'
		return
	}

	root.innerHTML = jobs
		.map((job) => {
			const result = parseJson<{
				created?: { time_entries?: number }
				updated?: { time_entries?: number }
				skipped?: {
					running_entries?: number
					invalid_entries?: number
					filtered_entries?: number
				}
			}>(job.result_json, {})
			const summary = job.error_message
				? job.error_message
				: `${result.created?.time_entries ?? 0} created, ${result.updated?.time_entries ?? 0} updated, ${(result.skipped?.running_entries ?? 0) + (result.skipped?.invalid_entries ?? 0) + (result.skipped?.filtered_entries ?? 0)} skipped`
			return `
				<div class="integration-row">
					<div>
						<strong>Job ${job.id}</strong>
						<div class="section-copy">${escapeHtml(summary)}</div>
						<div class="section-copy">Schedule ${job.schedule_id ?? "manual"} · Integration ${job.integration_id ?? "none"}</div>
					</div>
					<div class="integration-row__meta">
						<span class="tag">${jobStatusLabel(job.status)}</span>
						<span>${job.processed_rows}/${job.total_rows}</span>
						<span>Started ${formatDateTime(job.started_at)}</span>
						<span>Finished ${formatDateTime(job.finished_at)}</span>
						<span>Created ${formatDateTime(job.created_at)}</span>
					</div>
				</div>
			`
		})
		.join("")
}

const upsertJob = (job: Job) => {
	const existingIndex = currentJobs.findIndex((existing) => existing.id === job.id)
	if (existingIndex === -1) currentJobs.push(job)
	else currentJobs[existingIndex] = job
	currentJobs.sort((left, right) => right.id - left.id)
	renderJobRows(currentJobs)
}

const connectJobEvents = () => {
	const events = new EventSource("/api/jobs/events")
	events.addEventListener("ready", () => {
		setStatus("jobs-status", "Live updates connected.")
	})
	events.addEventListener("job", (event) => {
		if (!(event instanceof MessageEvent)) return
		try {
			upsertJob(JSON.parse(event.data) as Job)
			setStatus("jobs-status", "Job progress updated.")
		} catch {
			setStatus("jobs-status", "Received an invalid job update.", true)
		}
	})
	events.onerror = () => {
		setStatus("jobs-status", "Live updates disconnected. Reconnecting...", true)
	}
	return events
}

const loadJobsPage = async () => {
	setStatus("jobs-status", "Loading jobs...")
	try {
		currentJobs = await apiJson<Job[]>("/api/jobs")
		renderJobRows(currentJobs)
		setStatus("jobs-status", "Jobs loaded.")
	} catch (error) {
		setStatus(
			"jobs-status",
			error instanceof Error ? error.message : "Failed to load jobs.",
			true,
		)
	}
}

export const renderJobsPage = () => {
	currentJobs = []
	renderPage(`
		<section class="page-heading page-heading--compact">
			<div>
				<h1 class="page-title">Jobs</h1>
			</div>
			<button id="jobs-refresh-button" class="secondary" type="button">Refresh</button>
		</section>

		<section class="workspace workspace--single">
			<div class="card panel">
				<div class="section-header">
					<h2>Job History</h2>
					<div id="jobs-status" class="status" role="status"></div>
				</div>
				<div id="jobs-list" class="integration-list"></div>
			</div>
		</section>
	`)

	document
		.getElementById("jobs-refresh-button")
		?.addEventListener("click", () => void loadJobsPage())
	let disposed = false
	let events: EventSource | null = null
	void loadJobsPage().then(() => {
		if (!disposed) events = connectJobEvents()
	})
	return () => {
		disposed = true
		events?.close()
	}
}
