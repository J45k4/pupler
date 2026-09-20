import { useMemo, useState } from "react"
import { apiFetch } from "../api"
import { Empty, Status, useApi, type Client, type Project } from "../lib"

const projectSummary = (client: Client, projects: Project[]) => {
	const linked = projects.filter((p) => p.client_id === client.id)
	const active = linked.filter((p) => p.archived_at === null).length
	const total = linked.length
	if (total === 0) return "No projects"
	if (active === total) return `${total} project${total === 1 ? "" : "s"}`
	return `${active} active / ${total} total projects`
}

export const ClientsPage = ({ link }: { link: (p: string) => string }) => {
	const [showArchived, setShowArchived] = useState(false)
	const [status, setStatus] = useState("Loading clients...")
	const [statusError, setStatusError] = useState(false)
	const [name, setName] = useState("")
	const [color, setColor] = useState("#2d7c6f")

	const { data: clientsData, loading: cLoading, error: cError, reload: reloadClients } = useApi<Client[]>("/api/clients?sort=name&order=asc")
	const { data: projectsData, reload: reloadProjects } = useApi<Project[]>("/api/projects?sort=name&order=asc")

	const reload = () => {
		reloadClients()
		reloadProjects()
	}

	const clients = useMemo(
		() => (clientsData ?? []).filter((c) => showArchived || c.archived_at === null),
		[clientsData, showArchived],
	)
	const projects = projectsData ?? []
	const loading = cLoading
	const error = cError

	const save = async (client: Client, nextName: string, nextColor: string) => {
		try {
			await apiFetch(`/api/clients/${client.id}`, {
				method: "PATCH",
				body: JSON.stringify({ name: nextName, color: nextColor }),
			})
			setStatus("Client saved.")
			setStatusError(false)
			reload()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to save client.")
			setStatusError(true)
		}
	}

	const toggleArchive = async (client: Client) => {
		const archived = client.archived_at !== null
		try {
			await apiFetch(`/api/clients/${client.id}`, {
				method: "PATCH",
				body: JSON.stringify({ archived_at: archived ? null : new Date().toISOString() }),
			})
			setStatus(archived ? "Client restored." : "Client archived.")
			setStatusError(false)
			reload()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to update client.")
			setStatusError(true)
		}
	}

	const create = async (event: React.FormEvent) => {
		event.preventDefault()
		if (!name.trim()) {
			setStatus("Client name is required.")
			setStatusError(true)
			return
		}
		try {
			await apiFetch("/api/clients", {
				method: "POST",
				body: JSON.stringify({ name: name.trim(), color, archived_at: null }),
			})
			setName("")
			setColor("#2d7c6f")
			setStatus("Client created.")
			setStatusError(false)
			reload()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to create client.")
			setStatusError(true)
		}
	}

	return (
		<section className="workspace workspace--single">
			<div className="card panel">
				<div className="section-header">
					<h2>Clients</h2>
					<label className="checkbox-toggle" htmlFor="clients-show-archived">
						<input id="clients-show-archived" type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
						<span>Show archived</span>
					</label>
				</div>
				<form id="client-create-form" onSubmit={create}>
					<div className="row">
						<label>
							Name
							<input name="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme" />
						</label>
						<label>
							Color
							<input name="color" type="color" required value={color} onChange={(e) => setColor(e.target.value)} />
						</label>
					</div>
					<div className="actions">
						<button className="primary" type="submit">
							Create Client
						</button>
					</div>
				</form>
				<Status message={loading ? "Loading clients..." : (error ?? status) || `Loaded ${clients.length} client${clients.length === 1 ? "" : "s"}.`} error={!!error || statusError} />
				<div id="client-results">
					{!loading && !error && clients.length === 0 ? <Empty message="No clients yet." /> : null}
					{clients.map((client) => (
						<ClientRow key={client.id} client={client} projects={projects} link={link} onSave={save} onArchive={toggleArchive} />
					))}
				</div>
			</div>
		</section>
	)
}

const ClientRow = ({
	client,
	projects,
	link,
	onSave,
	onArchive,
}: {
	client: Client
	projects: Project[]
	link: (p: string) => string
	onSave: (client: Client, name: string, color: string) => void
	onArchive: (client: Client) => void
}) => {
	const archived = client.archived_at !== null
	const [name, setName] = useState(client.name)
	const [color, setColor] = useState(client.color)
	return (
		<div className={`client-row${archived ? " client-row--archived" : ""}`}>
			<div className="client-row__summary">
				<div className="time-entry-row__title">
					<span className="time-color" style={{ ["--time-color" as string]: client.color }} />
					<a className="client-row__link" href={link(`/clients/${client.id}`)} data-link="">
						{client.name}
					</a>
					<span className={archived ? "tag tag--neutral" : "tag"}>{archived ? "Archived" : "Active"}</span>
				</div>
				<div className="section-copy">{projectSummary(client, projects)}</div>
			</div>
			<form
				className="client-row__form"
				onSubmit={(e) => {
					e.preventDefault()
					onSave(client, name.trim(), color)
				}}
			>
				<label>
					Name
					<input name="name" required value={name} onChange={(e) => setName(e.target.value)} />
				</label>
				<label>
					Color
					<input name="color" type="color" required value={color} onChange={(e) => setColor(e.target.value)} />
				</label>
				<div className="client-row__actions">
					<button className="secondary" type="submit">
						Save
					</button>
					<button className="secondary" type="button" onClick={() => onArchive(client)}>
						{archived ? "Restore" : "Archive"}
					</button>
				</div>
			</form>
		</div>
	)
}

export const ClientDetailPage = ({ id, link }: { id: string; link: (p: string) => string }) => {
	const clientId = Number.parseInt(id, 10)
	const valid = Number.isInteger(clientId)
	const { data: client, loading: cLoading, error: cError, reload } = useApi<Client>(valid ? `/api/clients/${clientId}` : null)
	const { data: projects } = useApi<Project[]>(valid ? `/api/projects?client_id=${clientId}&sort=name&order=asc` : null)

	const [name, setName] = useState<string | null>(null)
	const [color, setColor] = useState<string | null>(null)
	const [status, setStatus] = useState("")
	const [statusError, setStatusError] = useState(false)

	if (!valid) return <div className="card panel page-panel"><p className="page-copy">Client id is invalid.</p></div>
	if (cLoading) return <p className="page-copy">Loading…</p>
	if (cError || !client) return <Status message={cError ?? "Failed to load client."} error />

	const archived = client.archived_at !== null
	const currentName = name ?? client.name
	const currentColor = color ?? client.color

	const save = async (event: React.FormEvent) => {
		event.preventDefault()
		if (!currentName.trim()) {
			setStatus("Client name is required.")
			setStatusError(true)
			return
		}
		try {
			await apiFetch(`/api/clients/${client.id}`, {
				method: "PATCH",
				body: JSON.stringify({ name: currentName.trim(), color: currentColor }),
			})
			setStatus("Client saved.")
			setStatusError(false)
			reload()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to save client.")
			setStatusError(true)
		}
	}

	const toggleArchive = async () => {
		try {
			await apiFetch(`/api/clients/${client.id}`, {
				method: "PATCH",
				body: JSON.stringify({ archived_at: archived ? null : new Date().toISOString() }),
			})
			setStatus(archived ? "Client restored." : "Client archived.")
			setStatusError(false)
			reload()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to update client.")
			setStatusError(true)
		}
	}

	return (
		<>
			<section className="page-heading page-heading--compact">
				<a className="secondary action-link" href={link("/clients")} data-link="">
					Back To Clients
				</a>
			</section>
			<section className="workspace">
				<div className="card panel">
					<h2>Client Details</h2>
					<form id="client-detail-form" onSubmit={save}>
						<label>
							Name
							<input id="client-detail-name" required value={currentName} onChange={(e) => setName(e.target.value)} />
						</label>
						<label>
							Color
							<input id="client-detail-color" type="color" value={currentColor} onChange={(e) => setColor(e.target.value)} />
						</label>
						<div className="actions">
							<button className="primary" type="submit">
								Save
							</button>
							<button id="client-detail-archive" className="secondary" type="button" onClick={() => void toggleArchive()}>
								{archived ? "Restore" : "Archive"}
							</button>
						</div>
					</form>
					<Status message={status} error={statusError} />
				</div>
				<div className="card panel">
					<h2>Projects</h2>
					{(projects ?? []).length === 0 ? (
						<Empty message="No projects for this client." />
					) : (
						<div>
							{(projects ?? []).map((project) => (
								<a
									key={project.id}
									className={`client-project-row${project.archived_at === null ? "" : " client-project-row--archived"}`}
									href={link("/projects")}
									data-link=""
								>
									<span className="time-color" style={{ ["--time-color" as string]: project.color }} />
									<strong>{project.name}</strong>
									{project.archived_at !== null ? <span className="tag tag--neutral">Archived</span> : null}
								</a>
							))}
						</div>
					)}
				</div>
			</section>
		</>
	)
}
