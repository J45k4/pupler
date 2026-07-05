import { escapeHtml, renderPage, setStatus } from "../app";
import { SearchSelect, type SearchSelectOption } from "../ui/search-select";

type Client = {
	id: number;
	name: string;
	color: string;
	archived_at: string | null;
	created_at: string;
	updated_at: string;
};

type Project = {
	id: number;
	client_id: number | null;
	name: string;
	color: string;
	archived_at: string | null;
	created_at: string;
	updated_at: string;
	client?: Client | null;
};

type ProjectsPageState = {
	clients: Client[];
	projects: Project[];
};

let projectsPageState: ProjectsPageState = {
	clients: [],
	projects: [],
};
let projectCreateClientSelect: SearchSelect | null = null;

const apiJson = async <T>(path: string, options: RequestInit = {}) => {
	const response = await fetch(path, {
		...options,
		headers: {
			...(options.body ? { "Content-Type": "application/json" } : {}),
			...(options.headers ?? {}),
		},
	});
	const body = (await response.json()) as T | { error?: string };
	if (!response.ok) {
		throw new Error(
			typeof body === "object" && body !== null && "error" in body
				? (body.error ?? "Request failed")
				: "Request failed",
		);
	}
	return body as T;
};

const normalizeName = (name: string) => name.trim().toLowerCase();

const findClientByName = (clients: Client[], name: string) => {
	const normalizedName = normalizeName(name);
	return clients.find((client) => normalizeName(client.name) === normalizedName);
};

const clientOptions = (
	clients: Client[],
	selectedId?: number | null,
): SearchSelectOption[] =>
	clients
		.filter((client) => client.archived_at === null || client.id === selectedId)
		.map((client) => ({
			value: String(client.id),
			label: client.name,
		}));

const selectedClientId = async (clientSelect: SearchSelect) => {
	const selectedId = Number(clientSelect.value);
	if (Number.isInteger(selectedId) && selectedId > 0) return selectedId;
	const clientName = clientSelect.text.trim();
	if (!clientName) return null;

	const existing = findClientByName(projectsPageState.clients, clientName);
	if (existing) return existing.id;

	const client = await apiJson<Client>("/api/clients", {
		method: "POST",
		body: JSON.stringify({
			name: clientName,
			archived_at: null,
		}),
	});
	projectsPageState.clients = [...projectsPageState.clients, client];
	return client.id;
};

const renderProjectRows = () => {
	const results = document.getElementById("project-results");
	if (!results) return;
	const showArchived = document.getElementById("projects-show-archived");
	const includeArchived = showArchived instanceof HTMLInputElement && showArchived.checked;
	const projects = projectsPageState.projects.filter(
		(project) => includeArchived || project.archived_at === null,
	);

	results.replaceChildren();
	if (!projects.length) {
		const empty = document.createElement("div");
		empty.className = "empty";
		empty.textContent = "No projects yet.";
		results.append(empty);
		return;
	}

	for (const project of projects) {
		const isArchived = project.archived_at !== null;
		const row = document.createElement("div");
		row.className = `project-row${isArchived ? " project-row--archived" : ""}`;

		const summary = document.createElement("div");
		summary.className = "project-row__summary";
		summary.innerHTML = `
			<div class="time-entry-row__title">
				<span class="time-color" style="--time-color: ${escapeHtml(project.color)}"></span>
				<strong>${escapeHtml(project.name)}</strong>
				<span class="${isArchived ? "tag tag--neutral" : "tag"}">${isArchived ? "Archived" : "Active"}</span>
			</div>
			<div class="section-copy">${project.client?.name ? `Client: ${escapeHtml(project.client.name)}` : "No client"}</div>
		`;

		const form = document.createElement("form");
		form.className = "project-row__form";
		form.dataset.projectId = String(project.id);

		const nameLabel = document.createElement("label");
		nameLabel.textContent = "Name";
		const nameInput = document.createElement("input");
		nameInput.name = "name";
		nameInput.value = project.name;
		nameInput.required = true;
		nameLabel.append(nameInput);

		const colorLabel = document.createElement("label");
		colorLabel.textContent = "Color";
		const colorInput = document.createElement("input");
		colorInput.name = "color";
		colorInput.type = "color";
		colorInput.value = project.color;
		colorInput.required = true;
		colorLabel.append(colorInput);

		const clientLabel = document.createElement("label");
		clientLabel.textContent = "Client";
		const clientSelect = new SearchSelect({
			placeholder: "No client",
			allowCreate: true,
			createLabelPrefix: "Create client",
		});
		clientSelect
			.setOptions(clientOptions(projectsPageState.clients, project.client_id))
			.setValue(project.client_id === null ? null : String(project.client_id));
		clientLabel.append(clientSelect.root);

		const actions = document.createElement("div");
		actions.className = "project-row__actions";
		const save = document.createElement("button");
		save.className = "secondary";
		save.type = "submit";
		save.textContent = "Save";
		const clear = document.createElement("button");
		clear.className = "secondary";
		clear.type = "button";
		clear.textContent = "Clear Client";
		const archive = document.createElement("button");
		archive.className = "secondary";
		archive.type = "button";
		archive.textContent = isArchived ? "Restore" : "Archive";
		actions.append(save, clear, archive);

		form.append(nameLabel, colorLabel, clientLabel, actions);
		form.addEventListener("submit", async (event) => {
			event.preventDefault();
			const name = nameInput.value.trim();
			if (!name) {
				setStatus("projects-status", "Project name is required.", true);
				return;
			}
			try {
				const clientId = await selectedClientId(clientSelect);
				await apiJson<Project>(`/api/projects/${project.id}`, {
					method: "PATCH",
					body: JSON.stringify({
						name,
						color: colorInput.value,
						client_id: clientId,
					}),
				});
				setStatus("projects-status", "Project saved.");
				await loadProjects();
			} catch (error) {
				setStatus(
					"projects-status",
					error instanceof Error ? error.message : "Failed to save project.",
					true,
				);
			}
		});
		clear.addEventListener("click", async () => {
			try {
				await apiJson<Project>(`/api/projects/${project.id}`, {
					method: "PATCH",
					body: JSON.stringify({ client_id: null }),
				});
				setStatus("projects-status", "Project client cleared.");
				await loadProjects();
			} catch (error) {
				setStatus(
					"projects-status",
					error instanceof Error ? error.message : "Failed to clear project client.",
					true,
				);
			}
		});
		archive.addEventListener("click", async () => {
			try {
				await apiJson<Project>(`/api/projects/${project.id}`, {
					method: "PATCH",
					body: JSON.stringify({
						archived_at: isArchived ? null : new Date().toISOString(),
					}),
				});
				setStatus("projects-status", isArchived ? "Project restored." : "Project archived.");
				await loadProjects();
			} catch (error) {
				setStatus(
					"projects-status",
					error instanceof Error ? error.message : "Failed to update project.",
					true,
				);
			}
		});

		row.append(summary, form);
		results.append(row);
	}
};

const loadProjects = async () => {
	setStatus("projects-status", "Loading projects...");
	try {
		const [clients, projects] = await Promise.all([
			apiJson<Client[]>("/api/clients?sort=name&order=asc"),
			apiJson<Project[]>("/api/projects?sort=name&order=asc"),
		]);
		projectsPageState = { clients, projects };
		projectCreateClientSelect?.setOptions(clientOptions(clients));
		renderProjectRows();
		setStatus("projects-status", `Loaded ${projects.length} project${projects.length === 1 ? "" : "s"}.`);
	} catch (error) {
		projectsPageState = { clients: [], projects: [] };
		projectCreateClientSelect?.setOptions([]);
		renderProjectRows();
		setStatus(
			"projects-status",
			error instanceof Error ? error.message : "Failed to load projects.",
			true,
		);
	}
};

const attachProjectEvents = () => {
	const createClientSelect = new SearchSelect({
		placeholder: "No client",
		allowCreate: true,
		createLabelPrefix: "Create client",
	});
	projectCreateClientSelect = createClientSelect;
	document.getElementById("project-create-client")?.replaceWith(createClientSelect.root);

	document
		.getElementById("project-create-form")
		?.addEventListener("submit", async (event) => {
			event.preventDefault();
			const form = event.currentTarget;
			if (!(form instanceof HTMLFormElement)) return;
			const formData = new FormData(form);
			const name = String(formData.get("name") ?? "").trim();
			const color = String(formData.get("color") ?? "").trim();
			if (!name) {
				setStatus("project-create-status", "Project name is required.", true);
				return;
			}

			try {
				const clientId = await selectedClientId(createClientSelect);
				await apiJson<Project>("/api/projects", {
					method: "POST",
					body: JSON.stringify({
						name,
						color,
						client_id: clientId,
						archived_at: null,
					}),
				});
				form.reset();
				const colorInput = form.querySelector<HTMLInputElement>("input[name='color']");
				if (colorInput) colorInput.value = "#2d7c6f";
				createClientSelect.clear();
				setStatus("project-create-status", "Project created.");
				await loadProjects();
			} catch (error) {
				setStatus(
					"project-create-status",
					error instanceof Error ? error.message : "Failed to create project.",
					true,
				);
			}
		});

	document
		.getElementById("projects-show-archived")
		?.addEventListener("change", renderProjectRows);

	void loadProjects();
};

export const renderProjectsPage = () => {
	renderPage(`
		<section class="page-heading page-heading--compact">
			<div>
				<h1 class="page-title">Projects</h1>
			</div>
		</section>

		<section class="workspace projects-workspace">
			<div class="card panel">
				<div class="section-header">
					<h2>New Project</h2>
				</div>
				<form id="project-create-form">
					<label>
						Name
						<input name="name" placeholder="Project name" autocomplete="off" required />
					</label>
					<label>
						Color
						<input name="color" type="color" value="#2d7c6f" required />
					</label>
					<label>
						Client
						<span id="project-create-client"></span>
					</label>
					<div class="actions">
						<button class="primary" type="submit">Create Project</button>
					</div>
					<div id="project-create-status" class="status" role="status"></div>
				</form>
			</div>

			<div class="card panel">
				<div class="section-header">
					<h2>Projects</h2>
					<label class="inline-toggle">
						<input id="projects-show-archived" type="checkbox" />
						Show archived
					</label>
				</div>
				<div id="projects-status" class="status" role="status"></div>
				<div id="project-results" class="project-list"></div>
			</div>
		</section>
	`);

	attachProjectEvents();
};
