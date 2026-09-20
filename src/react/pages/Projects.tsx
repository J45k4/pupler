import { useMemo, useState } from "react"
import { apiFetch } from "../api"
import { Empty, Status, useApi, type Client, type Project } from "../lib"

export const ProjectsPage = ({ link }: { link: (p: string) => string }) => {
	const [showArchived, setShowArchived] = useState(false)
	const [status, setStatus] = useState("Loading projects...")
	const [statusError, setStatusError] = useState(false)
	const [name, setName] = useState("")
	const [color, setColor] = useState("#2d7c6f")
	const [clientId, setClientId] = useState("")
	const [mergeTarget, setMergeTarget] = useState("")
	const [mergeSource, setMergeSource] = useState("")

	const { data: clients } = useApi<Client[]>("/api/clients?sort=name&order=asc")
	const { data: projectsData, loading, error, reload: reloadProjects } = useApi<Project[]>("/api/projects?sort=name&order=asc")

	const projects = useMemo(
		() => (projectsData ?? []).filter((p) => showArchived || p.archived_at === null),
		[projectsData, showArchived],
	)

	const save = async (project: Project, values: { name: string; color: string; client_id: number | null }) => {
		try {
			await apiFetch(`/api/projects/${project.id}`, { method: "PATCH", body: JSON.stringify(values) })
			setStatus("Project saved.")
			setStatusError(false)
			reloadProjects()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to save project.")
			setStatusError(true)
		}
	}

	const toggleArchive = async (project: Project) => {
		const archived = project.archived_at !== null
		try {
			await apiFetch(`/api/projects/${project.id}`, {
				method: "PATCH",
				body: JSON.stringify({ archived_at: archived ? null : new Date().toISOString() }),
			})
			setStatus(archived ? "Project restored." : "Project archived.")
			setStatusError(false)
			reloadProjects()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to update project.")
			setStatusError(true)
		}
	}

	const create = async (event: React.FormEvent) => {
		event.preventDefault()
		if (!name.trim()) {
			setStatus("Project name is required.")
			setStatusError(true)
			return
		}
		try {
			await apiFetch("/api/projects", {
				method: "POST",
				body: JSON.stringify({
					name: name.trim(),
					color,
					client_id: clientId ? Number(clientId) : null,
					archived_at: null,
				}),
			})
			setName("")
			setColor("#2d7c6f")
			setClientId("")
			setStatus("Project created.")
			setStatusError(false)
			reloadProjects()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to create project.")
			setStatusError(true)
		}
	}

	const merge = async (event: React.FormEvent) => {
		event.preventDefault()
		if (!mergeTarget || !mergeSource || mergeTarget === mergeSource) {
			setStatus("Pick two different projects to merge.")
			setStatusError(true)
			return
		}
		if (!window.confirm("Merge source project into target? Source entries move to target and source is archived.")) return
		try {
			await apiFetch(`/api/projects/${mergeTarget}/merge`, {
				method: "POST",
				body: JSON.stringify({ source_id: Number(mergeSource), archive_source: true, delete_source: false }),
			})
			setStatus("Projects merged.")
			setStatusError(false)
			reloadProjects()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to merge projects.")
			setStatusError(true)
		}
	}

	return (
		<section className="workspace workspace--single">
			<div className="card panel">
				<div className="section-header">
					<h2>Projects</h2>
					<label className="checkbox-toggle" htmlFor="projects-show-archived">
						<input id="projects-show-archived" type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
						<span>Show archived</span>
					</label>
				</div>
				<form id="project-create-form" onSubmit={create}>
					<div className="row">
						<label>
							Name
							<input name="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Website" />
						</label>
						<label>
							Color
							<input name="color" type="color" required value={color} onChange={(e) => setColor(e.target.value)} />
						</label>
					</div>
					<label>
						Client
						<select value={clientId} onChange={(e) => setClientId(e.target.value)}>
							<option value="">No client</option>
							{(clients ?? []).map((c) => (
								<option key={c.id} value={String(c.id)}>
									{c.name}
								</option>
							))}
						</select>
					</label>
					<div className="actions">
						<button className="primary" type="submit">
							Create Project
						</button>
					</div>
				</form>
				<Status message={loading ? "Loading projects..." : (error ?? status) || `Loaded ${projects.length} projects.`} error={!!error || statusError} />
				<div id="project-results">
					{!loading && !error && projects.length === 0 ? <Empty message="No projects yet." /> : null}
					{projects.map((project) => (
						<ProjectRow key={project.id} project={project} clients={clients ?? []} link={link} onSave={save} onArchive={toggleArchive} />
					))}
				</div>
			</div>
			<div className="card panel">
				<h2>Merge Projects</h2>
				<form onSubmit={merge}>
					<div className="row">
						<label>
							Target (kept)
							<select value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)}>
								<option value="">Pick target</option>
								{(projectsData ?? []).map((p) => (
									<option key={p.id} value={String(p.id)}>
										{p.name}
									</option>
								))}
							</select>
						</label>
						<label>
							Source (archived)
							<select value={mergeSource} onChange={(e) => setMergeSource(e.target.value)}>
								<option value="">Pick source</option>
								{(projectsData ?? []).map((p) => (
									<option key={p.id} value={String(p.id)}>
										{p.name}
									</option>
								))}
							</select>
						</label>
					</div>
					<div className="actions">
						<button className="secondary" type="submit">
							Merge
						</button>
					</div>
				</form>
			</div>
		</section>
	)
}

const ProjectRow = ({
	project,
	clients,
	link: _link,
	onSave,
	onArchive,
}: {
	project: Project
	clients: Client[]
	link: (p: string) => string
	onSave: (project: Project, values: { name: string; color: string; client_id: number | null }) => void
	onArchive: (project: Project) => void
}) => {
	const archived = project.archived_at !== null
	const [name, setName] = useState(project.name)
	const [color, setColor] = useState(project.color)
	const [clientId, setClientId] = useState(project.client_id === null ? "" : String(project.client_id))
	void _link
	return (
		<div className={`client-row${archived ? " client-row--archived" : ""}`}>
			<div className="client-row__summary">
				<div className="time-entry-row__title">
					<span className="time-color" style={{ ["--time-color" as string]: project.color }} />
					<strong>{project.name}</strong>
					<span className={archived ? "tag tag--neutral" : "tag"}>{archived ? "Archived" : "Active"}</span>
				</div>
				<div className="section-copy">{project.client?.name ?? "No client"}</div>
			</div>
			<form
				className="client-row__form"
				onSubmit={(e) => {
					e.preventDefault()
					onSave(project, { name: name.trim(), color, client_id: clientId ? Number(clientId) : null })
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
				<label>
					Client
					<select value={clientId} onChange={(e) => setClientId(e.target.value)}>
						<option value="">No client</option>
						{clients.map((c) => (
							<option key={c.id} value={String(c.id)}>
								{c.name}
							</option>
						))}
					</select>
				</label>
				<div className="client-row__actions">
					<button className="secondary" type="submit">
						Save
					</button>
					<button className="secondary" type="button" onClick={() => onArchive(project)}>
						{archived ? "Restore" : "Archive"}
					</button>
				</div>
			</form>
		</div>
	)
}
