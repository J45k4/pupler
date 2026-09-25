import { rankTimeProjects } from "./time-entry-data"
import { useId, useMemo, useState } from "react"
import { apiFetch } from "../api"
import { Combobox } from "../Combobox"
import { Modal, Status, toDateTimeLocalValue, formatReceiptDateTime, type Client, type Project, type TimeEntry } from "../lib"
import type { TimeEntryRangeInput } from "./time-report-data"

export const ensureTimeProject = async (projects: Project[], clients: Client[], name: string, clientName = "") => {
	const trimmed = name.trim()
	if (!trimmed) throw new Error("Project is required.")
	let client = clientName.trim() ? clients.find(value => value.name.trim().toLowerCase() === clientName.trim().toLowerCase()) : null
	if (clientName.trim() && !client) client = await apiFetch<Client>("/api/clients", { method: "POST", body: JSON.stringify({ name: clientName.trim(), archived_at: null }) })
	const existing = projects.find(project => project.archived_at === null && (!client || project.client_id === client.id) && project.name.trim().toLowerCase() === trimmed.toLowerCase())
	return existing ?? await apiFetch<Project>("/api/projects", { method: "POST", body: JSON.stringify({ name: trimmed, client_id: client?.id ?? null, archived_at: null }) })
}

export const DescriptionInput = ({ entries, projectId, value, onChange }: { entries: TimeEntry[]; projectId: number | null; value: string; onChange: (value: string) => void }) => {
	const id = useId()
	const suggestions = useMemo(() => {
		const groups = new Map<string, { text: string; count: number; latest: string }>()
		for (const entry of entries) {
			if (projectId === null || entry.project_id !== projectId || !entry.description?.trim()) continue
			const text = entry.description.trim()
			const key = text.toLocaleLowerCase()
			const group = groups.get(key)
			if (group) {
				group.count++
				if (entry.started_at > group.latest) group.latest = entry.started_at
			} else groups.set(key, { text, count: 1, latest: entry.started_at })
		}
		return [...groups.values()].sort((a, b) => b.latest.localeCompare(a.latest) || b.count - a.count || a.text.localeCompare(b.text))
	}, [entries, projectId])
	return <><input list={id} placeholder="What did you work on?" value={value} onChange={event => onChange(event.target.value)} /><datalist id={id}>{suggestions.filter(option => option.text.toLocaleLowerCase().includes(value.trim().toLocaleLowerCase())).slice(0, 12).map(option => <option key={option.text.toLocaleLowerCase()} value={option.text} label={`${option.count} previous entr${option.count === 1 ? "y" : "ies"}`} />)}</datalist></>
}

const Adjustments = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => <div className="time-adjustments">{[30, 60].map(minutes => <button key={minutes} type="button" className="secondary time-adjustments__button" aria-label={`Move ${label.toLowerCase()} ${minutes} minutes into the past`} onClick={() => {
	const date = value ? new Date(value) : new Date()
	if (Number.isNaN(date.getTime())) return
	date.setMinutes(date.getMinutes() - minutes)
	onChange(toDateTimeLocalValue(date))
}}>-{minutes} min</button>)}</div>

type CommonProps = { projects: Project[]; clients?: Client[]; entries?: TimeEntry[]; open: boolean; onClose: () => void; onSaved: () => void }

export const EntryCreateModal = ({ projects, clients = [], entries = [], range, open, onClose, onSaved }: CommonProps & { range?: TimeEntryRangeInput }) => <EntryForm key={open ? `create:${range?.startedAt ?? "default"}:${range?.endedAt ?? ""}` : "closed"} projects={projects} clients={clients} entries={entries} range={range} open={open} onClose={onClose} onSaved={onSaved} />
export const EntryEditModal = ({ entry, onDeleted, ...props }: CommonProps & { entry: TimeEntry | null; onDeleted: () => void }) => entry ? <EntryForm key={`${entry.id}:${props.open}`} entry={entry} {...props} onDeleted={onDeleted} /> : null

const EntryForm = ({ projects, clients = [], entries = [], range, entry, open, onClose, onSaved, onDeleted }: CommonProps & { range?: TimeEntryRangeInput; entry?: TimeEntry; onDeleted?: () => void }) => {
	const running = entry?.ended_at === null
	const selectedProject = entry ? projects.find(project => project.id === entry.project_id) ?? entry.project : null
	const [clientName, setClientName] = useState(running ? selectedProject?.client?.name ?? clients.find(client => client.id === selectedProject?.client_id)?.name ?? "" : "")
	const [projectName, setProjectName] = useState(selectedProject?.name ?? "")
	const [projectId, setProjectId] = useState(entry?.project_id === null || !entry ? "" : String(entry.project_id))
	const [description, setDescription] = useState(entry?.description ?? "")
	const [start, setStart] = useState(entry ? toDateTimeLocalValue(new Date(entry.started_at)) : range?.startedAt ?? toDateTimeLocalValue(new Date(Date.now() - 3600000)))
	const [end, setEnd] = useState(entry ? entry.ended_at ? toDateTimeLocalValue(new Date(entry.ended_at)) : "" : range?.endedAt ?? toDateTimeLocalValue())
	const [message, setMessage] = useState("")
	const [pending, setPending] = useState(false)
	const client = clients.find(client => client.name.trim().toLowerCase() === clientName.trim().toLowerCase())
	const rankedProjects = useMemo(() => rankTimeProjects(projects, entries), [projects, entries])
	const available = rankedProjects.filter(project => (!clientName.trim() || (client && project.client_id === client.id)))
	const project = entry && !running ? projects.find(project => project.id === Number(projectId)) : available.find(project => project.name.trim().toLowerCase() === projectName.trim().toLowerCase())
	const previousEnd = entries.filter(value => value.id !== entry?.id && value.ended_at !== null).map(value => value.ended_at!).sort().at(-1)
	const title = !entry ? "Add Time Entry" : running ? "Edit Timer" : "Edit Entry"
	const perform = async (action: () => Promise<void>) => {
		setPending(true)
		setMessage("")
		try { await action() } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save entry.") } finally { setPending(false) }
	}
	const save = async () => {
		const startDate = new Date(start)
		const endDate = end.trim() ? new Date(end) : null
		if (Number.isNaN(startDate.getTime()) || (endDate && Number.isNaN(endDate.getTime()))) throw new Error("Entry times are invalid.")
		if (endDate && endDate < startDate) throw new Error("End must be after start.")
		let id: number | null
		if (entry && !running) {
			if (!projectId) throw new Error("Project is required.")
			id = Number(projectId)
		} else if (running && !projectName.trim()) {
			if (clientName.trim()) throw new Error("Project is required when client is selected.")
			id = null
		} else id = (await ensureTimeProject(projects, clients, projectName, clientName)).id
		await apiFetch(entry ? `/api/time-entries/${entry.id}` : "/api/time-entries", { method: entry ? "PATCH" : "POST", body: JSON.stringify({ project_id: id, description: description.trim() || null, started_at: startDate.toISOString(), ended_at: running ? null : endDate?.toISOString() ?? null }) })
		onClose()
		onSaved()
	}
	return <Modal id={entry ? "time-entry-edit-modal" : "time-entry-create-modal"} title={title} open={open} onClose={onClose} className={range ? "time-entry-create-modal--range-preview" : ""}>
		<form className={entry ? "time-entry-edit-form" : undefined} onSubmit={event => { event.preventDefault(); void perform(save) }}>
			{!entry || running ? <label>Client (optional)<Combobox placeholder="Type or choose a client" options={clients.filter(value => value.archived_at === null || value.id === client?.id).map(value => ({ value: String(value.id), label: value.name }))} value={clientName} onChange={value => { setClientName(value); setProjectName("") }} allowCreate createLabelPrefix="Create client" /></label> : null}
			<label>{running ? "Project (optional)" : "Project"}{entry && !running ? <select aria-label="Entry project" value={projectId} onChange={event => setProjectId(event.target.value)}><option value="">No project</option>{projects.filter(value => value.archived_at === null || value.id === entry.project_id).map(value => <option key={value.id} value={value.id}>{value.name}{value.client ? ` - ${value.client.name}` : ""}</option>)}</select> : <Combobox placeholder="Type or choose a project" options={available.map(value => ({ value: String(value.id), label: value.name }))} value={projectName} onChange={setProjectName} allowCreate createLabelPrefix="Create project" />}</label>
			<label>Description<DescriptionInput entries={entries} projectId={project?.id ?? null} value={description} onChange={setDescription} /></label>
			<div className="row"><label>Start<input type="datetime-local" required value={start} onChange={event => setStart(event.target.value)} />{entry ? <Adjustments label="Start" value={start} onChange={setStart} /> : null}</label>{!running ? <label>End<input type="datetime-local" value={end} onChange={event => setEnd(event.target.value)} />{entry ? <Adjustments label="End" value={end} onChange={setEnd} /> : null}</label> : null}</div>
			{running && previousEnd ? <div><button type="button" className="secondary" disabled={pending} onClick={() => void perform(async () => { await apiFetch(`/api/time-entries/${entry!.id}`, { method: "PATCH", body: JSON.stringify({ started_at: previousEnd }) }); onClose(); onSaved() })}>Set start to previous end</button><div className="section-copy">Previous end: {formatReceiptDateTime(previousEnd)}</div></div> : null}
			<div className="actions"><button type="submit" className="primary" disabled={pending}>{pending ? "Saving…" : !entry ? "Add Entry" : running ? "Update Timer" : "Save"}</button><button type="button" className="secondary" onClick={onClose}>Cancel</button>{entry ? <button type="button" className="secondary" disabled={pending} onClick={() => void perform(async () => { await apiFetch(`/api/time-entries/${entry.id}`, { method: "DELETE" }); onClose(); onDeleted?.() })}>Delete</button> : null}</div>
		</form><Status message={message} error={!!message} />
	</Modal>
}

export const StopTimerModal = ({ entry, projects, clients, open, onClose, onSaved }: CommonProps & { entry: TimeEntry; clients: Client[] }) => {
	const [clientName, setClientName] = useState("")
	const [projectName, setProjectName] = useState("")
	const [message, setMessage] = useState("")
	const [pending, setPending] = useState(false)
	const client = clients.find(value => value.name.trim().toLowerCase() === clientName.trim().toLowerCase())
	return <Modal id="time-stop-modal" title="Stop Timer" open={open} onClose={onClose}><p>Choose a project before stopping this timer.</p><form onSubmit={event => {
		event.preventDefault()
		setPending(true)
		void (async () => {
			try {
				const project = await ensureTimeProject(projects, clients, projectName, clientName)
				await apiFetch(`/api/time-entries/${entry.id}`, { method: "PATCH", body: JSON.stringify({ project_id: project.id }) })
				await apiFetch(`/api/time-entries/${entry.id}/stop`, { method: "POST", body: "{}" })
				onClose()
				onSaved()
			} catch (error) { setMessage(error instanceof Error ? error.message : "Failed to stop timer.") } finally { setPending(false) }
		})()
	}}><label>Client (optional)<Combobox value={clientName} onChange={value => { setClientName(value); setProjectName("") }} options={clients.filter(value => value.archived_at === null).map(value => ({ value: String(value.id), label: value.name }))} allowCreate createLabelPrefix="Create client" /></label><label>Project<Combobox value={projectName} onChange={setProjectName} options={projects.filter(value => value.archived_at === null && (!clientName.trim() || client?.id === value.client_id)).map(value => ({ value: String(value.id), label: value.name }))} allowCreate createLabelPrefix="Create project" /></label><div className="actions"><button type="submit" disabled={pending}>Stop Timer</button><button type="button" className="secondary" onClick={onClose}>Cancel</button></div></form><Status message={message} error={!!message} /></Modal>
}
