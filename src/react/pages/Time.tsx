import { rankTimeProjects } from "./time-entry-data"
import { EntryCreateModal, EntryEditModal, StopTimerModal, DescriptionInput, ensureTimeProject } from "./TimeEntryForms"
import { memo, useCallback, useMemo, useState } from "react"
import { apiFetch } from "../api"
import { Combobox } from "../Combobox"
import {
	Empty,
	Status,
	formatDuration,
	formatReceiptDateTime,
	timeEntryDurationSeconds,
	TickingDuration,
	useApi,
	type Client,
	type Project,
	type TimeEntry,
} from "../lib"

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

const PastEntries = memo(({ entries, projects, onEdit, onStartAgain }: {
	entries: TimeEntry[] | null
	projects: Project[] | null
	onEdit: (entry: TimeEntry) => void
	onStartAgain: (entry: TimeEntry) => void
}) => {
	const [page, setPage] = useState(0)
	const history = useMemo(() => (entries ?? []).filter(entry => entry.ended_at !== null), [entries])
	const projectById = useMemo(() => new Map((projects ?? []).map(project => [project.id, project])), [projects])
	const pageSize = 50
	const lastPage = Math.max(0, Math.ceil(history.length / pageSize) - 1)
	const currentPage = Math.min(page, lastPage)
	const offset = currentPage * pageSize
	if (!history.length) return <Empty message="No past entries." />
	return <>
		<div className="time-entry-list">
			{history.slice(offset, offset + pageSize).map(entry => (
				<EntryRow key={entry.id} entry={entry} project={entry.project ?? projectById.get(entry.project_id!)} onEdit={onEdit} onStartAgain={onStartAgain} />
			))}
		</div>
		{history.length > pageSize ? <nav className="actions" aria-label="Time entry pages">
			<button className="secondary" type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button>
			<span aria-live="polite">{offset + 1}–{Math.min(offset + pageSize, history.length)} of {history.length} entries</span>
			<button className="secondary" type="button" disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>Next</button>
		</nav> : null}
	</>
})

export const TimePage = ({ link }: { link: (p: string) => string }) => {
	const [status, setStatus] = useState("")
	const [statusError, setStatusError] = useState(false)
	const [clientText, setClientText] = useState("")
	const [projectText, setProjectText] = useState("")
	const [description, setDescription] = useState("")
	const [createOpen, setCreateOpen] = useState(false)
	const [stopOpen, setStopOpen] = useState(false)
	const [editing, setEditing] = useState<TimeEntry | null>(null)
	const [editOpen, setEditOpen] = useState(false)

	const { data: clients, reload: reloadClients } = useApi<Client[]>("/api/clients?sort=name&order=asc")
	const { data: projects, reload: reloadProjects } = useApi<Project[]>("/api/projects?sort=name&order=asc")
	const { data: entries, loading, error, reload: reloadEntries } = useApi<TimeEntry[]>("/api/time-entries?sort=started_at&order=desc")

	const reload = useCallback(() => {
		reloadEntries()
		reloadProjects()
		reloadClients()
	}, [reloadEntries, reloadProjects, reloadClients])
	const editEntry = useCallback((entry: TimeEntry) => {
		setEditing(entry)
		setEditOpen(true)
	}, [])
	const changed = (msg: string) => {
		setStatus(msg)
		setStatusError(false)
		reload()
	}

	const running = useMemo(() => (entries ?? []).find((e) => e.ended_at === null) ?? null, [entries])
	const rankedProjects = useMemo(() => rankTimeProjects(projects ?? [], entries ?? []), [projects, entries])
	const selectedClient = (clients ?? []).find(client => client.name.trim().toLowerCase() === clientText.trim().toLowerCase())
	const selectedProject = (projects ?? []).find(project => project.archived_at === null && (!clientText.trim() || project.client_id === selectedClient?.id) && project.name.trim().toLowerCase() === projectText.trim().toLowerCase())

	const quickActions = useMemo(() => {
		const activeProjects = new Set((projects ?? []).filter(project => project.archived_at === null).map(project => project.id))
		const map = new Map<string, { project_id: number; description: string; entry_count: number; latest_started_at: string; total_seconds: number; project?: Project }>()
		for (const entry of entries ?? []) {
			if (entry.project_id === null || !activeProjects.has(entry.project_id)) continue
			const key = `${entry.project_id}\n${entry.description?.trim() ?? ""}`
			const existing = map.get(key)
			if (existing) {
				existing.entry_count += 1
				existing.total_seconds += timeEntryDurationSeconds(entry)
				if (entry.started_at > existing.latest_started_at) existing.latest_started_at = entry.started_at
			} else {
				map.set(key, {
					project_id: entry.project_id,
					description: entry.description?.trim() ?? "",
					entry_count: 1,
					latest_started_at: entry.started_at,
					total_seconds: timeEntryDurationSeconds(entry),
					project: entry.project ?? undefined,
				})
			}
		}
		return [...map.values()].sort((a, b) => b.entry_count - a.entry_count || b.latest_started_at.localeCompare(a.latest_started_at)).slice(0, 8)
	}, [entries, projects])

	const start = async (event: React.FormEvent) => {
		event.preventDefault()
		try {
			if (clientText.trim() && !projectText.trim()) {
				throw new Error("Project is required when client is selected.")
			}
			let projectId: number | undefined
			if (projectText.trim()) {
				const project = await ensureTimeProject(projects ?? [], clients ?? [], projectText, clientText)
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

	const startForProject = useCallback(async (projectId: number, desc: string | null) => {
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
	}, [reload])

	const stop = async () => {
		if (!running) return
		try {
			if (running.project_id === null) {
				setStopOpen(true)
				return
			}
			await apiFetch(`/api/time-entries/${running.id}/stop`, { method: "POST", body: "{}" })
			changed("Timer stopped.")
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to stop timer.")
			setStatusError(true)
		}
	}

	const startAgain = useCallback(async (entry: TimeEntry) => {
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
	}, [reload, startForProject])

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
										onChange={value => { setClientText(value); setProjectText("") }}
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
												clientText.trim()
													? rankedProjects.filter((p) => p.client_id === client?.id)
													: rankedProjects
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
									<DescriptionInput entries={entries ?? []} projectId={selectedProject?.id ?? null} value={description} onChange={setDescription} />
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
						{!loading && !error ? <PastEntries entries={entries} projects={projects} onEdit={editEntry} onStartAgain={startAgain} /> : null}
					</section>
				</div>
			</div>
			{running ? <StopTimerModal key={String(stopOpen)} entry={running} projects={projects ?? []} clients={clients ?? []} open={stopOpen} onClose={() => setStopOpen(false)} onSaved={() => changed("Timer stopped.")} /> : null}
			<EntryCreateModal
				projects={projects ?? []}
				clients={clients ?? []}
				entries={entries ?? []}
				open={createOpen}
				onClose={() => setCreateOpen(false)}
				onSaved={() => changed("Entry created.")}
			/>
			<EntryEditModal entry={editing} clients={clients ?? []} entries={entries ?? []} projects={projects ?? []} open={editOpen} onClose={() => setEditOpen(false)} onSaved={() => changed("Entry saved.")} onDeleted={() => changed("Entry deleted.")} />
		</>
	)
}

export { TimeOverviewPage, TimeWeeklyPage, TimeMonthlyPage } from "./TimeReports"
