import { useEffect, useMemo, useState } from "react"
import { apiFetch } from "../api"
import { Combobox } from "../Combobox"
import {
	Empty,
	Modal,
	Status,
	formatDuration,
	formatReceiptDateTime,
	timeEntryDurationSeconds,
	TickingDuration,
	toDateTimeLocalValue,
	useApi,
	type Client,
	type Project,
	type TimeEntry,
} from "../lib"

type ProjectTotal = {
	project_id: number | null
	project_name: string
	project_color: string
	client_id: number | null
	client_name: string | null
	client_color: string | null
	total_seconds: number
	entry_count: number
}

type ClientTotal = {
	client_id: number | null
	client_name: string
	client_color: string
	total_seconds: number
	entry_count: number
	project_count: number
}

type TimeReport = {
	period: { from: string | null; to: string; range: "custom" | "all" }
	total_seconds: number
	project_totals: ProjectTotal[]
	client_totals: ClientTotal[]
}

const reportQuery = (from: string, to: string) =>
	`/api/time-report?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`

const startOfDay = (date = new Date()) => {
	const d = new Date(date)
	d.setHours(0, 0, 0, 0)
	return d
}

const dayBounds = (date: Date) => {
	const from = startOfDay(date)
	const to = new Date(from)
	to.setDate(to.getDate() + 1)
	return { from: from.toISOString(), to: to.toISOString() }
}

const weekBounds = (date: Date) => {
	const d = startOfDay(date)
	const day = (d.getDay() + 6) % 7
	const from = new Date(d)
	from.setDate(from.getDate() - day)
	const to = new Date(from)
	to.setDate(to.getDate() + 7)
	return { from: from.toISOString(), to: to.toISOString() }
}

const monthBounds = (date: Date) => {
	const from = new Date(date.getFullYear(), date.getMonth(), 1)
	const to = new Date(date.getFullYear(), date.getMonth() + 1, 1)
	return { from: from.toISOString(), to: to.toISOString() }
}

const TimeColor = ({ color }: { color: string }) => (
	<span className="time-color" style={{ ["--time-color" as string]: color }} />
)

const EntryRow = ({
	entry,
	project,
	onEdit,
	onStartAgain,
}: {
	entry: TimeEntry
	project?: Project
	onEdit: (entry: TimeEntry) => void
	onStartAgain: (entry: TimeEntry) => void
}) => (
	<div className={`time-entry-row${entry.ended_at ? "" : " time-entry-row--running"}`}>
		<div className="time-entry-row__summary">
			<div className="time-entry-row__main">
				<div className="time-entry-row__header">
					<div className="time-entry-row__title">
						<TimeColor color={project?.color ?? "#2d7c6f"} />
						<strong>{project?.name ?? "No project"}</strong>
						<span className={entry.ended_at ? "tag tag--neutral" : "tag"}>
							{entry.ended_at ? formatDuration(timeEntryDurationSeconds(entry)) : "Running"}
						</span>
						{project?.client ? <span className="tag tag--neutral">{project.client.name}</span> : null}
					</div>
					<button className="secondary time-entry-row__edit" type="button" onClick={() => onEdit(entry)}>
						Edit
					</button>
				</div>
				<div className="time-entry-row__description">{entry.description?.trim() || "No description"}</div>
				<div className="section-copy">
					{formatReceiptDateTime(entry.started_at)}
					{entry.ended_at ? ` - ${formatReceiptDateTime(entry.ended_at)}` : ""}
				</div>
			</div>
			<div className="time-entry-row__actions">
				<button className="secondary" type="button" onClick={() => onStartAgain(entry)}>
					Start Again
				</button>
			</div>
		</div>
	</div>
)

const EntryEditModal = ({
	entry,
	projects,
	open,
	onClose,
	onSaved,
	onDeleted,
}: {
	entry: TimeEntry | null
	projects: Project[]
	open: boolean
	onClose: () => void
	onSaved: () => void
	onDeleted: () => void
}) => {
	const [projectText, setProjectText] = useState("")
	const [description, setDescription] = useState("")
	const [startedAt, setStartedAt] = useState("")
	const [endedAt, setEndedAt] = useState("")
	const [status, setStatus] = useState("")

	useEffect(() => {
		if (entry && open) {
			setProjectText(entry.project?.name ?? "")
			setDescription(entry.description ?? "")
			setStartedAt(toDateTimeLocalValue(new Date(entry.started_at)))
			setEndedAt(entry.ended_at ? toDateTimeLocalValue(new Date(entry.ended_at)) : "")
			setStatus("")
		}
	}, [entry?.id, open])

	if (!entry) return null

	const remove = async () => {
		if (!window.confirm("Delete this time entry?")) return
		try {
			await apiFetch(`/api/time-entries/${entry.id}`, { method: "DELETE" })
			onClose()
			onDeleted()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to delete entry.")
		}
	}

	const save = async (event: React.FormEvent) => {
		event.preventDefault()
		const trimmed = projectText.trim()
		const project = trimmed
			? projects.find((p) => p.name.trim().toLowerCase() === trimmed.toLowerCase())
			: null
		if (trimmed && !project) {
			setStatus("Pick an existing project from the list, or clear it for no project.")
			return
		}
		try {
			await apiFetch(`/api/time-entries/${entry.id}`, {
				method: "PATCH",
				body: JSON.stringify({
					project_id: project ? project.id : null,
					description: description.trim() || null,
					started_at: new Date(startedAt).toISOString(),
					ended_at: endedAt.trim() ? new Date(endedAt).toISOString() : null,
				}),
			})
			onClose()
			onSaved()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to save entry.")
		}
	}

	return (
		<Modal id="time-entry-edit-modal" title="Edit Entry" open={open} onClose={onClose}>
			<form onSubmit={save}>
				<label>
					Project
					<Combobox
						placeholder="No project"
						options={projects
							.filter((p) => p.archived_at === null || p.id === entry.project_id)
							.map((p) => ({ value: String(p.id), label: p.name }))}
						value={projectText}
						onChange={setProjectText}
					/>
				</label>
				<label>
					Description
					<input value={description} onChange={(e) => setDescription(e.target.value)} />
				</label>
				<label>
					Started At
					<input type="datetime-local" required value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
				</label>
				<label>
					Ended At
					<input type="datetime-local" value={endedAt} onChange={(e) => setEndedAt(e.target.value)} />
				</label>
				<div className="actions">
					<button className="primary" type="submit">
						Save Entry
					</button>
					<button className="secondary" type="button" onClick={() => void remove()}>
						Delete
					</button>
				</div>
			</form>
			<Status message={status} error={!!status} />
		</Modal>
	)
}

export const TimePage = ({ link }: { link: (p: string) => string }) => {
	const [status, setStatus] = useState("")
	const [statusError, setStatusError] = useState(false)
	const [clientText, setClientText] = useState("")
	const [projectText, setProjectText] = useState("")
	const [description, setDescription] = useState("")
	const [createOpen, setCreateOpen] = useState(false)
	const [editing, setEditing] = useState<TimeEntry | null>(null)
	const [editOpen, setEditOpen] = useState(false)

	const { data: clients } = useApi<Client[]>("/api/clients?sort=name&order=asc")
	const { data: projects, reload: reloadProjects } = useApi<Project[]>("/api/projects?sort=name&order=asc")
	const { data: entries, loading, error, reload: reloadEntries } = useApi<TimeEntry[]>("/api/time-entries?sort=started_at&order=desc")

	const reload = () => {
		reloadEntries()
		reloadProjects()
	}
	const changed = (msg: string) => {
		setStatus(msg)
		setStatusError(false)
		reload()
	}

	const running = useMemo(() => (entries ?? []).find((e) => e.ended_at === null) ?? null, [entries])

	const quickActions = useMemo(() => {
		const map = new Map<string, { project_id: number; description: string; entry_count: number; latest_started_at: string; total_seconds: number; project?: Project }>()
		for (const entry of entries ?? []) {
			if (entry.project_id === null) continue
			const key = `${entry.project_id}\n${entry.description ?? ""}`
			const existing = map.get(key)
			if (existing) {
				existing.entry_count += 1
				existing.total_seconds += timeEntryDurationSeconds(entry)
				if (entry.started_at > existing.latest_started_at) existing.latest_started_at = entry.started_at
			} else {
				map.set(key, {
					project_id: entry.project_id,
					description: entry.description ?? "",
					entry_count: 1,
					latest_started_at: entry.started_at,
					total_seconds: timeEntryDurationSeconds(entry),
					project: entry.project ?? undefined,
				})
			}
		}
		return [...map.values()].sort((a, b) => b.latest_started_at.localeCompare(a.latest_started_at)).slice(0, 8)
	}, [entries])

	const start = async (event: React.FormEvent) => {
		event.preventDefault()
		try {
			if (clientText.trim() && !projectText.trim()) {
				throw new Error("Project is required when client is selected.")
			}
			let projectId: number | undefined
			if (projectText.trim()) {
				const project = await ensureProject(projectText, clientText)
				projectId = project.id
			}
			await apiFetch("/api/time-entries/start", {
				method: "POST",
				body: JSON.stringify({ ...(projectId ? { project_id: projectId } : {}), description: description.trim() || null }),
			})
			setClientText("")
			setProjectText("")
			setDescription("")
			setStatus("Timer started.")
			setStatusError(false)
			reload()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to start timer.")
			setStatusError(true)
		}
	}

	const ensureClient = async (name: string): Promise<Client> => {
		const trimmed = name.trim()
		if (!trimmed) throw new Error("Client is required.")
		const existing = (clients ?? []).find((c) => c.name.trim().toLowerCase() === trimmed.toLowerCase())
		if (existing) return existing
		const created = await apiFetch<Client>("/api/clients", {
			method: "POST",
			body: JSON.stringify({ name: trimmed, color: "#2d7c6f", archived_at: null }),
		})
		reloadProjects()
		return created
	}

	const ensureProject = async (projectName: string, clientName = ""): Promise<Project> => {
		const trimmed = projectName.trim()
		if (!trimmed) throw new Error("Project is required.")
		const client = clientName.trim() ? await ensureClient(clientName) : null
		const pool = client ? (projects ?? []).filter((p) => p.client_id === client.id) : (projects ?? [])
		const existing = pool.find((p) => p.name.trim().toLowerCase() === trimmed.toLowerCase())
		if (existing) return existing
		const created = await apiFetch<Project>("/api/projects", {
			method: "POST",
			body: JSON.stringify({ name: trimmed, color: "#2d7c6f", client_id: client?.id ?? null, archived_at: null }),
		})
		reloadProjects()
		return created
	}

	const startForProject = async (projectId: number, desc: string | null) => {
		try {
			await apiFetch("/api/time-entries/start", {
				method: "POST",
				body: JSON.stringify({ project_id: projectId, description: desc }),
			})
			setStatus("Timer started.")
			setStatusError(false)
			reload()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to start timer.")
			setStatusError(true)
		}
	}

	const stop = async () => {
		if (!running) return
		try {
			if (running.project_id === null) {
				setStatus("Project is required before stopping timer")
				setStatusError(true)
				return
			}
			await apiFetch(`/api/time-entries/${running.id}/stop`, { method: "POST", body: "{}" })
			changed("Timer stopped.")
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to stop timer.")
			setStatusError(true)
		}
	}

	const startAgain = async (entry: TimeEntry) => {
		try {
			if (entry.project_id === null) {
				await apiFetch("/api/time-entries/start", {
					method: "POST",
					body: JSON.stringify({ description: entry.description || null }),
				})
			} else {
				await startForProject(entry.project_id, entry.description || null)
				return
			}
			setStatus("Timer started.")
			setStatusError(false)
			reload()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to start timer.")
			setStatusError(true)
		}
	}

	const discard = async () => {
		if (!running) return
		if (!window.confirm("Discard this running timer? This cannot be undone.")) return
		try {
			await apiFetch(`/api/time-entries/${running.id}`, { method: "DELETE" })
			changed("Timer discarded.")
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to discard timer.")
			setStatusError(true)
		}
	}

	return (
		<>
			<div className="workspace time-workspace">
				<div className="time-sidebar">
					<section className={`time-block${running ? " time-block--timer-running" : ""}`}>
						<div className="section-header">
							<h2>{running ? "Current Timer" : "Start Timer"}</h2>
							{running ? <span className="tag">Running</span> : <span className="tag tag--neutral">Stopped</span>}
						</div>
						{running ? (
							<div className="time-running">
								<div className="time-running__project">
									<TimeColor color={running.project?.color ?? "#2d7c6f"} />
									<strong>{running.project?.name ?? "No project"}</strong>
								</div>
								<div className="time-running__duration">
									<TickingDuration startedAt={running.started_at} />
								</div>
								{running.description ? <p className="section-copy">{running.description}</p> : null}
								<div className="time-running__actions">
									<button
										className="secondary"
										type="button"
										onClick={() => {
											setEditing(running)
											setEditOpen(true)
										}}
									>
										Edit
									</button>
									<button className="primary" type="button" onClick={() => void stop()}>
										Stop
									</button>
									<button className="secondary time-running__discard" type="button" onClick={() => void discard()}>
										Discard
									</button>
								</div>
							</div>
						) : (
							<form className="time-start-form" onSubmit={start}>
								<label>
									Client (optional)
									<Combobox
										placeholder="Type or choose a client"
										options={(clients ?? [])
											.filter((c) => c.archived_at === null)
											.map((c) => ({ value: String(c.id), label: c.name }))}
										value={clientText}
										onChange={setClientText}
										allowCreate
										createLabelPrefix="Create client"
									/>
								</label>
								<label>
									Project (optional)
									<Combobox
										placeholder="Type or choose a project"
										options={(() => {
											const trimmed = clientText.trim().toLowerCase()
											const client = trimmed
												? (clients ?? []).find((c) => c.name.trim().toLowerCase() === trimmed)
												: null
											const pool =
												clientText.trim() && client
													? (projects ?? []).filter((p) => p.client_id === client.id)
													: (projects ?? [])
											return pool
												.filter((p) => p.archived_at === null)
												.map((p) => ({ value: String(p.id), label: p.name }))
										})()}
										value={projectText}
										onChange={setProjectText}
										allowCreate
										createLabelPrefix="Create project"
									/>
								</label>
								<label>
									Description
									<Combobox
										placeholder="What are you working on?"
										options={(() => {
											const trimmed = projectText.trim().toLowerCase()
											const project = trimmed
												? (projects ?? []).find((p) => p.name.trim().toLowerCase() === trimmed)
												: null
											const pool =
												projectText.trim() && project
													? (entries ?? []).filter((e) => e.project_id === project.id)
													: (entries ?? [])
											return [...new Set(pool.map((e) => e.description).filter((d): d is string => !!d))]
												.slice(0, 50)
												.map((d) => ({ value: d, label: d }))
										})()}
										value={description}
										onChange={setDescription}
									/>
								</label>
								<div className="actions">
									<button className="primary" type="submit">
										Start Timer
									</button>
								</div>
							</form>
						)}
					</section>
					<section className="time-block">
						<div className="section-header">
							<h2>Quick Actions</h2>
						</div>
						<div
							className="time-quick-actions"
							onKeyDown={(event) => {
								if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
								const buttons = Array.from(
									event.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
								)
								if (!buttons.length) return
								event.preventDefault()
								const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
								const next =
									event.key === "ArrowDown"
										? buttons[(current + 1 + buttons.length) % buttons.length]
										: buttons[(current - 1 + buttons.length) % buttons.length]
								next?.focus()
							}}
						>
							{quickActions.length === 0 ? <Empty message="No repeated timers yet." /> : null}
							{quickActions.map((action) => (
								<div key={`${action.project_id}-${action.description}`} className="time-action-row">
									<div className="time-action-row__main">
										<div className="time-entry-row__title">
											<TimeColor color={action.project?.color ?? "#2d7c6f"} />
											<strong>{action.project?.name ?? "Project"}</strong>
										</div>
										<div className="time-entry-row__description">{action.description || "No description"}</div>
										<div className="section-copy">
											{`${action.entry_count} entr${action.entry_count === 1 ? "y" : "ies"} - ${formatDuration(action.total_seconds)}`}
										</div>
									</div>
									<button
										className="secondary time-quick-action"
										type="button"
										onClick={() => void startForProject(action.project_id, action.description || null)}
									>
										Start
									</button>
								</div>
							))}
						</div>
					</section>
				</div>
				<div className="time-main">
					<section className="time-block">
						<div className="section-header">
							<h2>Past Entries</h2>
							<div className="actions">
								<button className="primary" type="button" onClick={() => setCreateOpen(true)}>
									Add Entry
								</button>
							</div>
						</div>
						<Status message={loading ? "Loading…" : error ?? status} error={!!error || statusError} />
						{!loading && !error ? (
							(entries ?? []).filter((e) => e.ended_at !== null).length === 0 ? (
								<Empty message="No past entries." />
							) : (
								<div className="time-entry-list">
									{(entries ?? [])
										.filter((e) => e.ended_at !== null)
										.map((entry) => (
											<EntryRow
												key={entry.id}
												entry={entry}
												project={entry.project ?? (projects ?? []).find((p) => p.id === entry.project_id)}
												onEdit={(e) => {
													setEditing(e)
													setEditOpen(true)
												}}
												onStartAgain={(e) => void startAgain(e)}
											/>
										))}
								</div>
							)
						) : null}
					</section>
				</div>
			</div>
			<EntryCreateModal
				projects={projects ?? []}
				clients={clients ?? []}
				open={createOpen}
				onClose={() => setCreateOpen(false)}
				onSaved={() => changed("Entry created.")}
			/>
			<EntryEditModal entry={editing} projects={projects ?? []} open={editOpen} onClose={() => setEditOpen(false)} onSaved={() => changed("Entry saved.")} onDeleted={() => changed("Entry deleted.")} />
		</>
	)
}

const EntryCreateModal = ({
	projects,
	clients,
	open,
	onClose,
	onSaved,
}: {
	projects: Project[]
	clients: Client[]
	open: boolean
	onClose: () => void
	onSaved: () => void
}) => {
	const [projectText, setProjectText] = useState("")
	const [description, setDescription] = useState("")
	const [startedAt, setStartedAt] = useState(toDateTimeLocalValue())
	const [endedAt, setEndedAt] = useState("")
	const [status, setStatus] = useState("")

	const save = async (event: React.FormEvent) => {
		event.preventDefault()
		const trimmed = projectText.trim()
		const project = trimmed
			? projects.find((p) => p.name.trim().toLowerCase() === trimmed.toLowerCase())
			: null
		if (trimmed && !project) {
			setStatus("Pick an existing project from the list, or clear it for no project.")
			return
		}
		try {
			await apiFetch("/api/time-entries", {
				method: "POST",
				body: JSON.stringify({
					project_id: project ? project.id : null,
					description: description.trim() || null,
					started_at: new Date(startedAt).toISOString(),
					ended_at: endedAt.trim() ? new Date(endedAt).toISOString() : null,
				}),
			})
			setDescription("")
			setEndedAt("")
			onClose()
			onSaved()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to create entry.")
		}
	}

	return (
		<Modal id="time-entry-create-modal" title="Add Entry" open={open} onClose={onClose}>
			<form onSubmit={save}>
				<label>
					Project
					<Combobox
						placeholder="No project"
						options={projects
							.filter((p) => p.archived_at === null)
							.map((p) => ({ value: String(p.id), label: p.name }))}
						value={projectText}
						onChange={setProjectText}
					/>
				</label>
				<label>
					Description
					<input value={description} onChange={(e) => setDescription(e.target.value)} />
				</label>
				<label>
					Started At
					<input type="datetime-local" required value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
				</label>
				<label>
					Ended At
					<input type="datetime-local" value={endedAt} onChange={(e) => setEndedAt(e.target.value)} />
				</label>
				<div className="actions">
					<button className="primary" type="submit">
						Create Entry
					</button>
				</div>
			</form>
			<Status message={status} error={!!status} />
		</Modal>
	)
}

const ReportTables = ({ report, link }: { report: TimeReport; link: (p: string) => string }) => (
	<>
		<div className="dashboard-spending-summary">
			<div className="dashboard-spending-summary__metric">
				<span>Total</span>
				<strong>{formatDuration(report.total_seconds)}</strong>
			</div>
		</div>
		<h3>Projects</h3>
		{report.project_totals.length === 0 ? (
			<Empty message="No project totals." />
		) : (
			<table className="shoppinglist-table">
				<thead>
					<tr>
						<th>Project</th>
						<th>Entries</th>
						<th>Total</th>
					</tr>
				</thead>
				<tbody>
					{report.project_totals.map((total) => (
						<tr key={total.project_id ?? "none"}>
							<td>
								<TimeColor color={total.project_color} /> {total.project_name}
								{total.client_name ? <span className="section-copy"> · {total.client_name}</span> : null}
							</td>
							<td>{total.entry_count}</td>
							<td>{formatDuration(total.total_seconds)}</td>
						</tr>
					))}
				</tbody>
			</table>
		)}
		<h3>Clients</h3>
		{report.client_totals.length === 0 ? (
			<Empty message="No client totals." />
		) : (
			<table className="shoppinglist-table">
				<thead>
					<tr>
						<th>Client</th>
						<th>Entries</th>
						<th>Total</th>
					</tr>
				</thead>
				<tbody>
					{report.client_totals.map((total) => (
						<tr key={total.client_id ?? "none"}>
							<td>
								<TimeColor color={total.client_color} /> {total.client_name}
							</td>
							<td>{total.entry_count}</td>
							<td>{formatDuration(total.total_seconds)}</td>
						</tr>
					))}
				</tbody>
			</table>
		)}
	</>
)

const useSpan = (spans: Array<{ value: string; label: string }>, def: string) => {
	const [span, setSpan] = useState(() => new URLSearchParams(window.location.search).get("span") ?? def)
	return { span, setSpan: (v: string) => {
		setSpan(v)
		const url = new URL(window.location.href)
		url.searchParams.set("span", v)
		window.history.replaceState({}, "", `${url.pathname}${url.search}`)
	}, spans }
}

export const TimeOverviewPage = ({ link }: { link: (p: string) => string }) => {
	const spans = [
		{ value: "today", label: "Today" },
		{ value: "this-week", label: "This Week" },
		{ value: "last-7", label: "Last 7 Days" },
		{ value: "last-30", label: "Last 30 Days" },
		{ value: "all", label: "All Time" },
	]
	const { span, setSpan } = useSpan(spans, "today")

	const period = useMemo(() => {
		const now = new Date()
		if (span === "today") return dayBounds(now)
		if (span === "this-week") return weekBounds(now)
		if (span === "last-7") {
			const to = new Date(now)
			const from = new Date(now)
			from.setDate(from.getDate() - 7)
			return { from: from.toISOString(), to: to.toISOString() }
		}
		if (span === "last-30") {
			const to = new Date(now)
			const from = new Date(now)
			from.setDate(from.getDate() - 30)
			return { from: from.toISOString(), to: to.toISOString() }
		}
		return { from: "", to: new Date().toISOString() }
	}, [span])

	const path = span === "all" ? "/api/time-report?range=all" : reportQuery(period.from, period.to)
	const { data: report, loading, error } = useApi<TimeReport>(path)

	return (
		<section className="time-block">
			<div className="spending-breakdown-controls time-overview-controls">
				<label>
					Span
					<select value={span} onChange={(e) => setSpan(e.target.value)}>
						{spans.map((s) => (
							<option key={s.value} value={s.value}>
								{s.label}
							</option>
						))}
					</select>
				</label>
			</div>
			<Status message={loading ? "Loading time overview..." : error ?? ""} error={!!error} />
			{!loading && !error && report ? (
				<div className="time-overview-results">
					<ReportTables report={report} link={link} />
				</div>
			) : null}
		</section>
	)
}

export const TimeWeeklyPage = ({ link }: { link: (p: string) => string }) => {
	const [weekStart, setWeekStart] = useState(() => {
		const d = new Date()
		const day = (d.getDay() + 6) % 7
		d.setDate(d.getDate() - day)
		return d.toISOString().slice(0, 10)
	})
	const period = useMemo(() => weekBounds(new Date(`${weekStart}T12:00:00`)), [weekStart])
	const { data: report, loading, error } = useApi<TimeReport>(reportQuery(period.from, period.to))

	const days = useMemo(() => {
		const from = new Date(period.from)
		return Array.from({ length: 7 }, (_, i) => {
			const d = new Date(from)
			d.setDate(d.getDate() + i)
			return d
		})
	}, [period])

	return (
		<section className="time-block">
			<div className="spending-breakdown-controls">
				<label>
					Week
					<input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
				</label>
			</div>
			<Status message={loading ? "Loading weekly time..." : error ?? ""} error={!!error} />
			{!loading && !error && report ? (
				<>
					<div className="section-copy">
						{days[0]?.toLocaleDateString()} → {days[6]?.toLocaleDateString()} · Total {formatDuration(report.total_seconds)}
					</div>
					<ReportTables report={report} link={link} />
				</>
			) : null}
		</section>
	)
}

export const TimeMonthlyPage = ({ link }: { link: (p: string) => string }) => {
	const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
	const period = useMemo(() => monthBounds(new Date(`${month}-15T12:00:00`)), [month])
	const { data: report, loading, error } = useApi<TimeReport>(reportQuery(period.from, period.to))

	return (
		<section className="time-block">
			<div className="spending-breakdown-controls">
				<label>
					Month
					<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
				</label>
			</div>
			<Status message={loading ? "Loading monthly time..." : error ?? ""} error={!!error} />
			{!loading && !error && report ? (
				<>
					<div className="section-copy">Total {formatDuration(report.total_seconds)}</div>
					<ReportTables report={report} link={link} />
				</>
			) : null}
		</section>
	)
}
