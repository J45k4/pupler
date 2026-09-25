import { useTimePage } from "./use-time-page"
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

const PastEntries = memo(({ entries, projects, offset, total, onPage, onEdit, onStartAgain }: {
	entries: TimeEntry[]
	projects: Project[] | null
	offset: number
	total: number
	onPage: (offset: number) => void
	onEdit: (entry: TimeEntry) => void
	onStartAgain: (entry: TimeEntry) => void
}) => {
	const projectById = useMemo(() => new Map((projects ?? []).map(project => [project.id, project])), [projects])
	if (!entries.length) return <Empty message="No past entries." />
	return <>
		<div className="time-entry-list">
			{entries.map(entry => <EntryRow key={entry.id} entry={entry} project={entry.project ?? projectById.get(entry.project_id!)} onEdit={onEdit} onStartAgain={onStartAgain} />)}
		</div>
		{total > 50 ? <nav className="actions" aria-label="Time entry pages">
			<button className="secondary" type="button" disabled={offset === 0} onClick={() => onPage(Math.max(0, offset - 50))}>Previous</button>
			<span aria-live="polite">{offset + 1}–{offset + entries.length} of {total} entries</span>
			<button className="secondary" type="button" disabled={offset + entries.length >= total} onClick={() => onPage(offset + 50)}>Next</button>
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
	const [offset, setOffset] = useState(0)

	const { data: clients, reload: reloadClients } = useApi<Client[]>("/api/clients?sort=name&order=asc")
	const { data: projects, reload: reloadProjects } = useApi<Project[]>("/api/projects?sort=name&order=asc")
	const { data: page, summary, loading, error, reload: reloadEntries } = useTimePage(offset)
	const entries = page?.entries ?? null

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

	const running = summary?.running ?? null
	const rankedProjects = useMemo(() => rankTimeProjects(projects ?? [], [], summary?.project_usage), [projects, summary?.project_usage])
	const selectedClient = (clients ?? []).find(client => client.name.trim().toLowerCase() === clientText.trim().toLowerCase())
	const selectedProject = (projects ?? []).find(project => project.archived_at === null && (!clientText.trim() || project.client_id === selectedClient?.id) && project.name.trim().toLowerCase() === projectText.trim().toLowerCase())

	const quickActions = useMemo(() => (summary?.quick_actions ?? []).map(action => ({ ...action, project: (projects ?? []).find(project => project.id === action.project_id) })), [summary?.quick_actions, projects])

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

	if (!summary) return <Status message={error ?? "Loading time tracking…"} error={!!error} />

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
									<DescriptionInput projectId={selectedProject?.id ?? null} value={description} onChange={setDescription} />
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
						{!loading && !error ? <PastEntries entries={page?.entries ?? []} offset={page?.offset ?? offset} total={page?.total ?? 0} onPage={setOffset} projects={projects} onEdit={editEntry} onStartAgain={startAgain} /> : null}
					</section>
				</div>
			</div>
			{running ? <StopTimerModal key={String(stopOpen)} entry={running} projects={projects ?? []} clients={clients ?? []} open={stopOpen} onClose={() => setStopOpen(false)} onSaved={() => changed("Timer stopped.")} /> : null}
			<EntryCreateModal
				projects={projects ?? []}
				clients={clients ?? []}
				entries={entries ?? []}
				projectUsage={summary?.project_usage}
				open={createOpen}
				onClose={() => setCreateOpen(false)}
				onSaved={() => changed("Entry created.")}
			/>
			<EntryEditModal projectUsage={summary?.project_usage} previousEndedAt={summary?.previous_ended_at} entry={editing} clients={clients ?? []} entries={entries ?? []} projects={projects ?? []} open={editOpen} onClose={() => setEditOpen(false)} onSaved={() => changed("Entry saved.")} onDeleted={() => changed("Entry deleted.")} />
		</>
	)
}

export { TimeOverviewPage, TimeWeeklyPage, TimeMonthlyPage } from "./TimeReports"
