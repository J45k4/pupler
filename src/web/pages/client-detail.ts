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
	color: string;
	archived_at: string | null;
	created_at: string;
	updated_at: string;
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

const formatDateTime = (value: string) =>
	new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));

const renderClientDetail = (client: Client, projects: Project[]) => {
	const page = document.getElementById("client-detail-page");
	if (!page) return;

	const activeProjectCount = projects.filter(
		(project) => project.archived_at === null,
	).length;
	const archiveAction = client.archived_at === null ? "Archive" : "Restore";

	page.innerHTML = `
		<section class="page-heading page-heading--compact">
			<div>
				<span class="eyebrow">Client</span>
				<h1 class="page-title">
					<span class="time-color" style="--time-color: ${escapeHtml(client.color)}"></span>
					${escapeHtml(client.name)}
				</h1>
			</div>
			<a class="secondary action-link" href="/clients" data-link>Back To Clients</a>
		</section>

		<section class="workspace">
			<div class="card panel">
				<div class="section-header">
					<h2>Client Information</h2>
					<span class="tag${client.archived_at === null ? "" : " tag--neutral"}">
						${client.archived_at === null ? "Active" : "Archived"}
					</span>
				</div>
				<form id="client-detail-form">
					<label>
						Name
						<input id="client-detail-name" name="name" value="${escapeHtml(client.name)}" required />
					</label>
					<label>
						Color
						<input id="client-detail-color" name="color" type="color" value="${escapeHtml(client.color)}" required />
					</label>
					<div class="actions">
						<button class="primary" type="submit">Save Client</button>
						<button class="secondary" id="client-detail-archive" type="button">${archiveAction}</button>
					</div>
				</form>
				<div id="client-detail-status" class="status" role="status"></div>
				<dl class="receipt-metadata">
					<div>
						<dt>Created</dt>
						<dd>${formatDateTime(client.created_at)}</dd>
					</div>
					<div>
						<dt>Updated</dt>
						<dd>${formatDateTime(client.updated_at)}</dd>
					</div>
				</dl>
			</div>

			<div class="card panel">
				<div class="section-header">
					<h2>Projects</h2>
					<span class="tag tag--neutral">${activeProjectCount} active / ${projects.length} total</span>
				</div>
				<div class="client-project-list">
					${
						projects.length
							? projects
									.map(
										(project) => `
											<a class="client-project-row${project.archived_at === null ? "" : " client-project-row--archived"}" href="/projects" data-link>
												<span class="time-color" style="--time-color: ${escapeHtml(project.color)}"></span>
												<strong>${escapeHtml(project.name)}</strong>
												${project.archived_at === null ? "" : '<span class="tag tag--neutral">Archived</span>'}
											</a>`,
									)
									.join("")
							: '<div class="empty">No projects for this client.</div>'
					}
				</div>
			</div>
		</section>
	`;

	const form = document.getElementById("client-detail-form");
	const archiveButton = document.getElementById("client-detail-archive");
	form?.addEventListener("submit", async (event) => {
		event.preventDefault();
		const nameInput = document.getElementById("client-detail-name");
		const colorInput = document.getElementById("client-detail-color");
		if (!(nameInput instanceof HTMLInputElement) || !(colorInput instanceof HTMLInputElement)) {
			return;
		}
		const name = nameInput.value.trim();
		if (!name) {
			setStatus("client-detail-status", "Client name is required.", true);
			return;
		}
		try {
			const updatedClient = await apiJson<Client>(`/api/clients/${client.id}`, {
				method: "PATCH",
				body: JSON.stringify({ name, color: colorInput.value }),
			});
			renderClientDetail(updatedClient, projects);
			setStatus("client-detail-status", "Client saved.");
		} catch (error) {
			setStatus(
				"client-detail-status",
				error instanceof Error ? error.message : "Failed to save client.",
				true,
			);
		}
	});

	archiveButton?.addEventListener("click", async () => {
		try {
			const isArchived = client.archived_at !== null;
			const updatedClient = await apiJson<Client>(`/api/clients/${client.id}`, {
				method: "PATCH",
				body: JSON.stringify({
					archived_at: isArchived ? null : new Date().toISOString(),
				}),
			});
			renderClientDetail(updatedClient, projects);
			setStatus(
				"client-detail-status",
				isArchived ? "Client restored." : "Client archived.",
			);
		} catch (error) {
			setStatus(
				"client-detail-status",
				error instanceof Error ? error.message : "Failed to update client.",
				true,
			);
		}
	});
};

export const renderClientDetailPage = (params: Record<string, string>) => {
	renderPage('<div id="client-detail-page"></div>');

	void (async () => {
		const clientId = Number.parseInt(params.id ?? "", 10);
		const page = document.getElementById("client-detail-page");
		if (!page) return;
		if (!Number.isInteger(clientId)) {
			page.innerHTML =
				'<div class="card panel page-panel"><p class="page-copy">Client id is invalid.</p></div>';
			return;
		}

		try {
			const [client, projects] = await Promise.all([
				apiJson<Client>(`/api/clients/${clientId}`),
				apiJson<Project[]>(`/api/projects?client_id=${clientId}&sort=name&order=asc`),
			]);
			renderClientDetail(client, projects);
		} catch (error) {
			page.innerHTML = `
				<div class="card panel page-panel">
					<p class="page-copy">${escapeHtml(error instanceof Error ? error.message : "Failed to load client.")}</p>
				</div>
			`;
		}
	})();
};
