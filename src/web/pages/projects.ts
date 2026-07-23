import { renderPage, setStatus } from "../app";
import { attachModalControls, renderModal } from "../ui/modal";
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
let activeProjectActionsMenu: HTMLElement | null = null;
let activeProjectActionsTrigger: HTMLButtonElement | null = null;
let projectActionsMenuEventsAttached = false;

const closeProjectActionsMenu = () => {
	activeProjectActionsMenu?.remove();
	activeProjectActionsTrigger?.setAttribute("aria-expanded", "false");
	activeProjectActionsMenu = null;
	activeProjectActionsTrigger = null;
};

const positionProjectActionsMenu = (
	menu: HTMLElement,
	trigger: HTMLButtonElement,
) => {
	const triggerBounds = trigger.getBoundingClientRect();
	const viewportMargin = 12;
	let top = triggerBounds.bottom + 6;
	let left = triggerBounds.right - menu.offsetWidth;

	if (top + menu.offsetHeight > window.innerHeight - viewportMargin) {
		top = triggerBounds.top - menu.offsetHeight - 6;
	}
	menu.style.top = `${Math.max(viewportMargin, top)}px`;
	menu.style.left = `${Math.max(viewportMargin, left)}px`;
};

const attachProjectActionsMenuEvents = () => {
	if (projectActionsMenuEventsAttached) return;
	projectActionsMenuEventsAttached = true;
	document.addEventListener("click", (event) => {
		const target = event.target;
		if (!(target instanceof Node)) return;
		if (
			activeProjectActionsMenu?.contains(target) ||
			activeProjectActionsTrigger?.contains(target)
		) {
			return;
		}
		closeProjectActionsMenu();
	});
	window.addEventListener("resize", closeProjectActionsMenu);
	window.addEventListener("scroll", closeProjectActionsMenu, true);
};

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
	closeProjectActionsMenu();
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

	const table = document.createElement("table");
	table.className = "project-table";
	table.innerHTML = `
		<thead>
			<tr>
				<th scope="col">Project</th>
				<th scope="col">Color</th>
				<th scope="col">Client</th>
				<th scope="col">Status</th>
				<th scope="col">Actions</th>
			</tr>
		</thead>
	`;
	const body = document.createElement("tbody");

	for (const project of projects) {
		const isArchived = project.archived_at !== null;
		const row = document.createElement("tr");
		row.className = isArchived ? "project-table__row--archived" : "";

		const nameCell = document.createElement("td");
		nameCell.className = "project-table__name";
		const nameInput = document.createElement("input");
		nameInput.name = "name";
		nameInput.value = project.name;
		nameInput.setAttribute("aria-label", `Project name for ${project.name}`);
		nameInput.required = true;
		nameCell.append(nameInput);

		const colorCell = document.createElement("td");
		const colorInput = document.createElement("input");
		colorInput.name = "color";
		colorInput.type = "color";
		colorInput.value = project.color;
		colorInput.setAttribute("aria-label", `Color for ${project.name}`);
		colorInput.required = true;
		colorCell.append(colorInput);

		const clientCell = document.createElement("td");
		const clientSelect = new SearchSelect({
			placeholder: "No client",
			allowCreate: true,
			createLabelPrefix: "Create client",
		});
		clientSelect
			.setOptions(clientOptions(projectsPageState.clients, project.client_id))
			.setValue(project.client_id === null ? null : String(project.client_id));
		clientCell.append(clientSelect.root);

		const statusCell = document.createElement("td");
		statusCell.innerHTML = `<span class="${isArchived ? "tag tag--neutral" : "tag"}">${isArchived ? "Archived" : "Active"}</span>`;

		const actionsCell = document.createElement("td");
		const actionsTrigger = document.createElement("button");
		actionsTrigger.className = "secondary project-table__actions-trigger";
		actionsTrigger.type = "button";
		actionsTrigger.textContent = "Actions";
		actionsTrigger.setAttribute("aria-haspopup", "menu");
		actionsTrigger.setAttribute("aria-expanded", "false");
		actionsTrigger.setAttribute("aria-label", `Actions for ${project.name}`);
		const actionsMenu = document.createElement("div");
		actionsMenu.className = "project-actions-menu";
		actionsMenu.setAttribute("role", "menu");
		const save = document.createElement("button");
		save.className = "secondary";
		save.type = "button";
		save.textContent = "Save";
		const clear = document.createElement("button");
		clear.className = "secondary";
		clear.type = "button";
		clear.textContent = "Clear Client";
		const archive = document.createElement("button");
		archive.className = "secondary";
		archive.type = "button";
		archive.textContent = isArchived ? "Restore" : "Archive";
		actionsMenu.append(save, clear, archive);
		actionsCell.append(actionsTrigger);
		actionsTrigger.addEventListener("click", (event) => {
			event.stopPropagation();
			const isOpen = activeProjectActionsMenu === actionsMenu;
			closeProjectActionsMenu();
			if (isOpen) return;

			document.body.append(actionsMenu);
			activeProjectActionsMenu = actionsMenu;
			activeProjectActionsTrigger = actionsTrigger;
			actionsTrigger.setAttribute("aria-expanded", "true");
			positionProjectActionsMenu(actionsMenu, actionsTrigger);
		});
		actionsMenu.addEventListener("click", (event) => event.stopPropagation());

		save.addEventListener("click", async () => {
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

		row.append(nameCell, colorCell, clientCell, statusCell, actionsCell);
		body.append(row);
	}

	table.append(body);
	const tableWrap = document.createElement("div");
	tableWrap.className = "project-table-wrap";
	tableWrap.append(table);
	results.append(tableWrap);
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
	attachProjectActionsMenuEvents();
	const projectCreateModal = attachModalControls({
		modalId: "project-create-modal",
		openButtonId: "open-project-create-modal",
		closeSelector: "[data-project-create-modal-close]",
		focusSelector: "input[name='name']",
		onOpen: () => setStatus("project-create-status", ""),
	});
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
				projectCreateModal.close();
				setStatus("projects-status", "Project created.");
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
		<section class="workspace workspace--single projects-workspace">
			<div class="card panel">
				<div class="section-header">
					<h2>Projects</h2>
					<div class="project-header-actions">
						<label class="inline-toggle">
							<input id="projects-show-archived" type="checkbox" />
							Show archived
						</label>
						<button class="primary" id="open-project-create-modal" type="button">New project</button>
					</div>
				</div>
				<div id="projects-status" class="status" role="status"></div>
				<div id="project-results" class="project-list"></div>
			</div>
		</section>

		${renderModal({
			id: "project-create-modal",
			title: "New Project",
			closeDataAttribute: "data-project-create-modal-close",
			className: "project-create-modal",
			children: `
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
				</form>
				<div id="project-create-status" class="status" role="status"></div>
			`,
		})}
	`);

	attachProjectEvents();
};
