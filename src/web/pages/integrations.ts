import { escapeHtml, renderPage, setStatus } from "../app"
import { attachModalControls, renderModal } from "../ui/modal"

type ExternalIntegration = {
	id: number
	provider: number
	name: string
	status: number
	config: {
		workspace_id?: string
		api_base_url?: string
		reports_base_url?: string
	}
	created_at: string
	updated_at: string
}

enum ExternalIntegrationProvider {
	Clockify = 1,
}

const INTEGRATION_STATUS_ACTIVE = 1

const integrationProviderOptions = [
	{ value: ExternalIntegrationProvider.Clockify, label: "Clockify" },
]

const apiJson = async <T>(path: string, options: RequestInit = {}) => {
	const response = await fetch(path, {
		...options,
		headers: {
			...(options.body ? { "Content-Type": "application/json" } : {}),
			...(options.headers ?? {}),
		},
	})
	const body = (await response.json()) as T | { error?: string }
	if (!response.ok) {
		throw new Error(
			typeof body === "object" && body !== null && "error" in body
				? (body.error ?? "Request failed")
				: "Request failed",
		)
	}
	return body as T
}

const formatDateTime = (value: string | null | undefined) =>
	value
		? new Intl.DateTimeFormat(undefined, {
				dateStyle: "medium",
				timeStyle: "short",
			}).format(new Date(value))
		: "Not set"

const integrationStatusLabel = (status: number) =>
	status === INTEGRATION_STATUS_ACTIVE ? "Active" : "Disabled"

const integrationProviderLabel = (provider: number) =>
	integrationProviderOptions.find((option) => option.value === provider)
		?.label ?? `Provider ${provider}`

const renderIntegrationRows = (integrations: ExternalIntegration[]) => {
	const root = document.getElementById("integrations-list")
	if (!root) return
	if (!integrations.length) {
		root.innerHTML = '<div class="empty">No integrations configured.</div>'
		return
	}

	root.innerHTML = `
		<div class="integration-table" role="table" aria-label="External integrations">
			<div class="integration-table__row integration-table__row--head" role="row">
				<div role="columnheader">Name</div>
				<div role="columnheader">Provider</div>
				<div role="columnheader">Workspace</div>
				<div role="columnheader">Status</div>
				<div role="columnheader">Updated</div>
			</div>
			${integrations
				.map((integration) => {
					const workspace =
						integration.config.workspace_id ?? "Unknown workspace"
					return `
						<div class="integration-table__row" role="row">
							<div role="cell"><strong>${escapeHtml(integration.name)}</strong></div>
							<div role="cell">${escapeHtml(integrationProviderLabel(integration.provider))}</div>
							<div role="cell">${escapeHtml(workspace)}</div>
							<div role="cell"><span class="tag">${integrationStatusLabel(integration.status)}</span></div>
							<div role="cell">${formatDateTime(integration.updated_at)}</div>
						</div>
					`
				})
				.join("")}
		</div>
	`
}

const loadIntegrationsPage = async () => {
	setStatus("integrations-status", "Loading integrations...")
	try {
		const integrations = await apiJson<ExternalIntegration[]>(
			"/api/external-integrations",
		)
		renderIntegrationRows(integrations)
		setStatus("integrations-status", "Integrations loaded.")
	} catch (error) {
		setStatus(
			"integrations-status",
			error instanceof Error
				? error.message
				: "Failed to load integrations.",
			true,
		)
	}
}

const attachIntegrationEvents = () => {
	const integrationModal = attachModalControls({
		modalId: "integration-create-modal",
		openButtonId: "integration-create-button",
		closeSelector: "[data-close-integration-modal]",
		focusSelector: "select[name='provider']",
		onOpen: () => setStatus("clockify-configure-status", ""),
	})

	const configureForm = document.getElementById("clockify-configure-form")
	configureForm?.addEventListener("submit", async (event) => {
		event.preventDefault()
		if (!(configureForm instanceof HTMLFormElement)) return
		const data = new FormData(configureForm)
		const provider = Number(data.get("provider"))
		if (provider !== ExternalIntegrationProvider.Clockify) {
			setStatus(
				"clockify-configure-status",
				"Unsupported integration type.",
				true,
			)
			return
		}
		setStatus("clockify-configure-status", "Saving Clockify credentials...")
		try {
			await apiJson("/api/external-integrations/clockify", {
				method: "POST",
				body: JSON.stringify({
					name: String(data.get("name") ?? "default"),
					workspace_id: String(data.get("workspace_id") ?? ""),
					api_key: String(data.get("api_key") ?? ""),
					api_base_url: String(data.get("api_base_url") ?? ""),
					reports_base_url: String(
						data.get("reports_base_url") ?? "",
					),
				}),
			})
			configureForm.reset()
			integrationModal.close()
			setStatus(
				"clockify-configure-status",
				"Clockify integration saved.",
			)
			await loadIntegrationsPage()
		} catch (error) {
			setStatus(
				"clockify-configure-status",
				error instanceof Error
					? error.message
					: "Failed to save integration.",
				true,
			)
		}
	})
}

export const renderIntegrationsPage = () => {
	renderPage(`
		<section class="workspace workspace--single">
			<div class="card panel">
				<div class="section-header">
					<h2>External Integrations</h2>
					<button id="integration-create-button" class="primary" type="button">Create</button>
				</div>
				<div id="integrations-status" class="status" role="status"></div>
				<div id="integrations-list" class="integration-list"></div>
			</div>

		</section>

		${renderModal({
			id: "integration-create-modal",
			title: "Create Integration",
			closeDataAttribute: "data-close-integration-modal",
			children: `
			<form id="clockify-configure-form" autocomplete="off">
				<label>
					Type
					<select name="provider" required>
						${integrationProviderOptions
							.map(
								(option) =>
									`<option value="${option.value}">${escapeHtml(option.label)}</option>`,
							)
							.join("")}
					</select>
				</label>
				<label>
					Name
					<input name="name" type="text" value="default" required />
				</label>
				<label>
					Workspace ID
					<input name="workspace_id" type="text" required />
				</label>
				<label>
					API Key
					<input name="api_key" type="password" required />
				</label>
				<div class="actions">
					<button class="primary" type="submit">Save</button>
					<button class="secondary" type="button" data-close-integration-modal>Cancel</button>
				</div>
				<div id="clockify-configure-status" class="status" role="status"></div>
			</form>
			`,
		})}
	`)

	attachIntegrationEvents()
	void loadIntegrationsPage()
}
