import { renderPage, setStatus } from "../app";
import {
	createElement,
	createEmptyState,
	createPageMessage,
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
	const page = getElementById("client-detail-page");
	if (!page) return;

	const activeProjectCount = projects.filter(
		(project) => project.archived_at === null,
	).length;
	const archiveAction = client.archived_at === null ? "Archive" : "Restore";

	const back = createElement("a", { className: "secondary action-link", properties: { href: "/clients" }, attributes: { "data-link": "" } }, "Back To Clients");
	const detailForm = createElement("form", { id: "client-detail-form" },
		createElement("label", {}, "Name", createElement("input", { id: "client-detail-name", properties: { name: "name", required: true } })),
		createElement("label", {}, "Color", createElement("input", { id: "client-detail-color", properties: { name: "color", type: "color", required: true } })),
		createElement("div", { className: "actions" }, createElement("button", { className: "primary", properties: { type: "submit" } }, "Save Client"), createElement("button", { id: "client-detail-archive", className: "secondary", properties: { type: "button" } })),
	);
	const metadata = createElement("dl", { className: "receipt-metadata" },
		createElement("div", {}, createElement("dt", {}, "Created"), createElement("dd", { id: "client-detail-created" })),
		createElement("div", {}, createElement("dt", {}, "Updated"), createElement("dd", { id: "client-detail-updated" })),
	);
	page.replaceChildren(
		createElement("section", { className: "page-heading page-heading--compact" }, createElement("div", {}, createElement("span", { className: "eyebrow" }, "Client"), createElement("h1", { className: "page-title" }, createElement("span", { id: "client-detail-heading-color", className: "time-color" }), createElement("span", { id: "client-detail-heading-name" }))), back),
		createElement("section", { className: "workspace" },
			createElement("div", { className: "card panel" }, createElement("div", { className: "section-header" }, createElement("h2", {}, "Client Information"), createElement("span", { id: "client-detail-tag" })), detailForm, createElement("div", { id: "client-detail-status", className: "status", attributes: { role: "status" } }), metadata),
			createElement("div", { className: "card panel" }, createElement("div", { className: "section-header" }, createElement("h2", {}, "Projects"), createElement("span", { id: "client-project-count", className: "tag tag--neutral" })), createElement("div", { id: "client-project-list", className: "client-project-list" })),
		),
	);

	const headingColor = getElementById("client-detail-heading-color");
	if (headingColor instanceof HTMLElement) {
		headingColor.style.setProperty("--time-color", client.color);
	}
	const setText = (id: string, value: string) => {
		const element = getElementById(id);
		if (element) element.textContent = value;
	};
	setText("client-detail-heading-name", client.name);
	setText("client-detail-created", formatDateTime(client.created_at));
	setText("client-detail-updated", formatDateTime(client.updated_at));
	setText("client-project-count", `${activeProjectCount} active / ${projects.length} total`);
	setText("client-detail-archive", archiveAction);
	const statusTag = getElementById("client-detail-tag");
	if (statusTag) {
		statusTag.className = client.archived_at === null ? "tag" : "tag tag--neutral";
		statusTag.textContent = client.archived_at === null ? "Active" : "Archived";
	}
	const nameInput = getElementById("client-detail-name");
	const colorInput = getElementById("client-detail-color");
	if (nameInput instanceof HTMLInputElement) nameInput.value = client.name;
	if (colorInput instanceof HTMLInputElement) colorInput.value = client.color;
	const projectList = getElementById("client-project-list");
	if (projectList) {
		if (!projects.length) {
			projectList.replaceChildren(createEmptyState("No projects for this client."));
		} else {
			projectList.replaceChildren(...projects.map((project) => {
				const projectColor = createElement("span", { className: "time-color" });
				projectColor.style.setProperty("--time-color", project.color);
				const row = createElement(
					"a",
					{
						className: `client-project-row${project.archived_at === null ? "" : " client-project-row--archived"}`,
					},
					projectColor,
					createElement("strong", { text: project.name }),
				);
				row.href = "/projects";
				row.dataset.link = "";
				if (project.archived_at !== null) {
					row.append(createElement("span", { className: "tag tag--neutral", text: "Archived" }));
				}
				return row;
			}));
		}
	}

	const form = getElementById("client-detail-form");
	const archiveButton = getElementById("client-detail-archive");
	form?.addEventListener("submit", async (event) => {
		event.preventDefault();
		const nameInput = getElementById("client-detail-name");
		const colorInput = getElementById("client-detail-color");
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

export const renderClientDetailPage = async (params: Record<string, string>) => {
	const clientId = Number.parseInt(params.id ?? "", 10);
	const page = createElement("div", { id: "client-detail-page" });
	if (!Number.isInteger(clientId)) {
		page.append(createPageMessage("Client id is invalid."));
		renderPage(page);
		return;
	}

	try {
		const [client, projects] = await Promise.all([
			apiJson<Client>(`/api/clients/${clientId}`),
			apiJson<Project[]>(`/api/projects?client_id=${clientId}&sort=name&order=asc`),
		]);
		withQueryRoot(page, () => renderClientDetail(client, projects));
	} catch (error) {
		page.append(
			createPageMessage(
				error instanceof Error ? error.message : "Failed to load client.",
			),
		);
	}
	renderPage(page);
};
