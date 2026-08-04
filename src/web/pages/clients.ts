import { renderPage, setStatus } from "../app";
import {
	createElement,
	createEmptyState,
	getElementById,
	withQueryRoot,
} from "../lib/dom";

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
	const results = getElementById("client-results");
	if (!results) return;
	const showArchived = getElementById("clients-show-archived");
	const includeArchived = showArchived instanceof HTMLInputElement && showArchived.checked;
	const clients = clientsPageState.clients.filter(
		(client) => includeArchived || client.archived_at === null,
	);

	if (!clients.length) {
		results.replaceChildren(createEmptyState("No clients yet."));
		return;
	}

	results.replaceChildren(...clients.map(createClientRow));
};

const createClientRow = (client: Client) => {
	const isArchived = client.archived_at !== null;
	const color = createElement("span", { className: "time-color" });
	color.style.setProperty("--time-color", client.color);
	const link = createElement("a", { className: "client-row__link", text: client.name });
	link.href = `/clients/${client.id}`;
	link.dataset.link = "";
	const summary = createElement(
		"div",
		{ className: "client-row__summary" },
		createElement(
			"div",
			{ className: "time-entry-row__title" },
			color,
			link,
			createElement("span", {
				className: isArchived ? "tag tag--neutral" : "tag",
				text: isArchived ? "Archived" : "Active",
			}),
		),
		createElement("div", {
			className: "section-copy",
			text: projectSummary(client, clientsPageState.projects),
		}),
	);
	const name = document.createElement("input");
	name.name = "name";
	name.value = client.name;
	name.required = true;
	const colorInput = document.createElement("input");
	colorInput.name = "color";
	colorInput.type = "color";
	colorInput.value = client.color;
	colorInput.required = true;
	const save = createElement("button", { className: "secondary", text: "Save" });
	save.type = "submit";
	const archive = createElement("button", {
		className: "secondary",
		text: isArchived ? "Restore" : "Archive",
	});
	archive.type = "button";
	archive.addEventListener("click", async () => {
		try {
			await apiJson<Client>(`/api/clients/${client.id}`, {
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
	const form = createElement(
		"form",
		{ className: "client-row__form" },
		createElement("label", {}, "Name", name),
		createElement("label", {}, "Color", colorInput),
		createElement("div", { className: "client-row__actions" }, save, archive),
	);
	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		const nextName = name.value.trim();
		if (!nextName) {
			setStatus("clients-status", "Client name is required.", true);
			return;
		}
		try {
			await apiJson<Client>(`/api/clients/${client.id}`, {
				method: "PATCH",
				body: JSON.stringify({ name: nextName, color: colorInput.value }),
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
	return createElement(
		"div",
		{ className: `client-row${isArchived ? " client-row--archived" : ""}` },
		summary,
		form,
	);
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

};

export const renderClientsPage = () => {
	const name = createElement("input", { properties: { name: "name", placeholder: "Client name", autocomplete: "off", required: true } });
	const color = createElement("input", { properties: { name: "color", type: "color", value: "#2d7c6f", required: true } });
	const form = createElement("form", { id: "client-create-form" },
		createElement("label", {}, "Name", name),
		createElement("label", {}, "Color", color),
		createElement("div", { className: "actions" }, createElement("button", { className: "primary", properties: { type: "submit" } }, "Create Client")),
		createElement("div", { id: "client-create-status", className: "status", attributes: { role: "status" } }),
	);
	const archived = createElement("input", { id: "clients-show-archived", properties: { type: "checkbox" } });
	const page = createElement("section", { className: "workspace clients-workspace" },
		createElement("div", { className: "card panel" }, createElement("div", { className: "section-header" }, createElement("h2", {}, "New Client")), form),
		createElement("div", { className: "card panel" },
			createElement("div", { className: "section-header" }, createElement("h2", {}, "Clients"), createElement("label", { className: "inline-toggle" }, archived, "Show archived")),
			createElement("div", { id: "clients-status", className: "status", attributes: { role: "status" } }),
			createElement("div", { id: "client-results", className: "client-list" }),
		),
	);
	withQueryRoot(page, attachClientEvents);
	renderPage(page);
	void loadClients();
};
