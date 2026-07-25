import { escapeHtml, renderPage, setStatus } from "../app";

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
	archived_at: string | null;
};

type ClientsPageState = {
	clients: Client[];
	projects: Project[];
};

let clientsPageState: ClientsPageState = {
	clients: [],
	projects: [],
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

const projectSummary = (client: Client, projects: Project[]) => {
	const linkedProjects = projects.filter((project) => project.client_id === client.id);
	const activeCount = linkedProjects.filter((project) => project.archived_at === null).length;
	const totalCount = linkedProjects.length;
	if (totalCount === 0) return "No projects";
	if (activeCount === totalCount) {
		return `${totalCount} project${totalCount === 1 ? "" : "s"}`;
	}
	return `${activeCount} active / ${totalCount} total projects`;
};

const renderClientRows = () => {
	const results = document.getElementById("client-results");
	if (!results) return;
	const showArchived = document.getElementById("clients-show-archived");
	const includeArchived = showArchived instanceof HTMLInputElement && showArchived.checked;
	const clients = clientsPageState.clients.filter(
		(client) => includeArchived || client.archived_at === null,
	);

	if (!clients.length) {
		results.innerHTML = '<div class="empty">No clients yet.</div>';
		return;
	}

	results.innerHTML = clients
		.map((client) => {
			const isArchived = client.archived_at !== null;
			return `
				<div class="client-row${isArchived ? " client-row--archived" : ""}">
					<div class="client-row__summary">
						<div class="time-entry-row__title">
							<span class="time-color" style="--time-color: ${escapeHtml(client.color)}"></span>
							<a class="client-row__link" href="/clients/${client.id}" data-link>${escapeHtml(client.name)}</a>
							<span class="${isArchived ? "tag tag--neutral" : "tag"}">${isArchived ? "Archived" : "Active"}</span>
						</div>
						<div class="section-copy">${escapeHtml(projectSummary(client, clientsPageState.projects))}</div>
					</div>
					<form class="client-row__form" data-client-id="${client.id}">
						<label>
							Name
							<input name="name" value="${escapeHtml(client.name)}" required />
						</label>
						<label>
							Color
							<input name="color" type="color" value="${escapeHtml(client.color)}" required />
						</label>
						<div class="client-row__actions">
							<button class="secondary" type="submit">Save</button>
							<button
								class="secondary"
								type="button"
								data-client-archive-id="${client.id}"
								data-client-archived="${isArchived ? "true" : "false"}"
							>
								${isArchived ? "Restore" : "Archive"}
							</button>
						</div>
					</form>
				</div>
			`;
		})
		.join("");
};

const loadClients = async () => {
	setStatus("clients-status", "Loading clients...");
	try {
		const [clients, projects] = await Promise.all([
			apiJson<Client[]>("/api/clients?sort=name&order=asc"),
			apiJson<Project[]>("/api/projects?sort=name&order=asc"),
		]);
		clientsPageState = { clients, projects };
		renderClientRows();
		setStatus("clients-status", `Loaded ${clients.length} client${clients.length === 1 ? "" : "s"}.`);
	} catch (error) {
		clientsPageState = { clients: [], projects: [] };
		renderClientRows();
		setStatus(
			"clients-status",
			error instanceof Error ? error.message : "Failed to load clients.",
			true,
		);
	}
};

const attachClientEvents = () => {
	document
		.getElementById("client-create-form")
		?.addEventListener("submit", async (event) => {
			event.preventDefault();
			const form = event.currentTarget;
			if (!(form instanceof HTMLFormElement)) return;
			const formData = new FormData(form);
			const name = String(formData.get("name") ?? "").trim();
			const color = String(formData.get("color") ?? "").trim();
			if (!name) {
				setStatus("client-create-status", "Client name is required.", true);
				return;
			}

			try {
				setStatus("client-create-status", "Creating client...");
				await apiJson<Client>("/api/clients", {
					method: "POST",
					body: JSON.stringify({
						name,
						color,
						archived_at: null,
					}),
				});
				form.reset();
				const colorInput = form.querySelector<HTMLInputElement>("input[name='color']");
				if (colorInput) colorInput.value = "#2d7c6f";
				setStatus("client-create-status", "Client created.");
				await loadClients();
			} catch (error) {
				setStatus(
					"client-create-status",
					error instanceof Error ? error.message : "Failed to create client.",
					true,
				);
			}
		});

	document
		.getElementById("clients-show-archived")
		?.addEventListener("change", renderClientRows);

	document
		.getElementById("client-results")
		?.addEventListener("submit", async (event) => {
			event.preventDefault();
			const form = event.target;
			if (!(form instanceof HTMLFormElement)) return;
			const clientId = Number(form.dataset.clientId);
			const formData = new FormData(form);
			const name = String(formData.get("name") ?? "").trim();
			const color = String(formData.get("color") ?? "").trim();
			if (!Number.isInteger(clientId) || !name) {
				setStatus("clients-status", "Client name is required.", true);
				return;
			}

			try {
				await apiJson<Client>(`/api/clients/${clientId}`, {
					method: "PATCH",
					body: JSON.stringify({ name, color }),
				});
				setStatus("clients-status", "Client saved.");
				await loadClients();
			} catch (error) {
				setStatus(
					"clients-status",
					error instanceof Error ? error.message : "Failed to save client.",
					true,
				);
			}
		});

	document
		.getElementById("client-results")
		?.addEventListener("click", async (event) => {
			const target = event.target;
			if (!(target instanceof HTMLElement)) return;
			const button = target.closest<HTMLButtonElement>("[data-client-archive-id]");
			if (!button) return;
			const clientId = Number(button.dataset.clientArchiveId);
			const isArchived = button.dataset.clientArchived === "true";
			if (!Number.isInteger(clientId)) return;

			try {
				await apiJson<Client>(`/api/clients/${clientId}`, {
					method: "PATCH",
					body: JSON.stringify({
						archived_at: isArchived ? null : new Date().toISOString(),
					}),
				});
				setStatus("clients-status", isArchived ? "Client restored." : "Client archived.");
				await loadClients();
			} catch (error) {
				setStatus(
					"clients-status",
					error instanceof Error ? error.message : "Failed to update client.",
					true,
				);
			}
		});
};

export const renderClientsPage = () => {
	renderPage(`
		<section class="workspace clients-workspace">
			<div class="card panel">
				<div class="section-header">
					<h2>New Client</h2>
				</div>
				<form id="client-create-form">
					<label>
						Name
						<input name="name" placeholder="Client name" autocomplete="off" required />
					</label>
					<label>
						Color
						<input name="color" type="color" value="#2d7c6f" required />
					</label>
					<div class="actions">
						<button class="primary" type="submit">Create Client</button>
					</div>
					<div id="client-create-status" class="status" role="status"></div>
				</form>
			</div>

			<div class="card panel">
				<div class="section-header">
					<h2>Clients</h2>
					<label class="inline-toggle">
						<input id="clients-show-archived" type="checkbox" />
						Show archived
					</label>
				</div>
				<div id="clients-status" class="status" role="status"></div>
				<div id="client-results" class="client-list"></div>
			</div>
		</section>
	`);

	attachClientEvents();
	void loadClients();
};
