import { useState } from "react"
import { apiFetch } from "../api"
import { Empty, Modal, Status, useApi } from "../lib"

export type ExternalIntegration = {
	id: number
	provider: number
	name: string
	status: number
	config: {
		workspace_id?: string
		api_base_url?: string
		reports_base_url?: string
	}
	credentials_configured: boolean
	created_at: string
	updated_at: string
}

const PROVIDER_CLOCKIFY = 1
const STATUS_ACTIVE = 1

const formatDateTime = (value: string | null | undefined) =>
	value
		? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
		: "Not set"

export const IntegrationsPage = () => {
	const { data, loading, error, reload } = useApi<ExternalIntegration[]>("/api/external-integrations")
	const [status, setStatus] = useState("Loading integrations...")
	const [statusError, setStatusError] = useState(false)
	const [modalOpen, setModalOpen] = useState(false)
	const [modalStatus, setModalStatus] = useState("")
	const [editing, setEditing] = useState<ExternalIntegration | null>(null)

	const [provider, setProvider] = useState(String(PROVIDER_CLOCKIFY))
	const [name, setName] = useState("default")
	const [workspaceId, setWorkspaceId] = useState("")
	const [apiKey, setApiKey] = useState("")
	const [apiBaseUrl, setApiBaseUrl] = useState("")
	const [reportsBaseUrl, setReportsBaseUrl] = useState("")

	const integrations = data ?? []

	const openCreate = () => {
		setEditing(null)
		setProvider(String(PROVIDER_CLOCKIFY))
		setName("default")
		setWorkspaceId("")
		setApiKey("")
		setApiBaseUrl("")
		setReportsBaseUrl("")
		setModalStatus("")
		setModalOpen(true)
	}

	const openEdit = async (id: number) => {
		setStatus("Loading integration values...")
		try {
			const integration = await apiFetch<ExternalIntegration>(`/api/external-integrations/${id}`)
			setEditing(integration)
			setProvider(String(integration.provider))
			setName(integration.name)
			setWorkspaceId(integration.config.workspace_id ?? "")
			setApiKey("")
			setApiBaseUrl(integration.config.api_base_url ?? "")
			setReportsBaseUrl(integration.config.reports_base_url ?? "")
			setModalStatus("")
			setModalOpen(true)
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to load integration values.")
			setStatusError(true)
		}
	}

	const save = async (event: React.FormEvent) => {
		event.preventDefault()
		if (Number(provider) !== PROVIDER_CLOCKIFY) {
			setModalStatus("Unsupported integration type.")
			return
		}
		try {
			const values: Record<string, string> = {
				name: name.trim() || "default",
				workspace_id: workspaceId.trim(),
				api_base_url: apiBaseUrl.trim(),
				reports_base_url: reportsBaseUrl.trim(),
			}
			if (apiKey.trim()) values.api_key = apiKey.trim()
			await apiFetch(editing === null ? "/api/external-integrations/clockify" : `/api/external-integrations/${editing.id}`, {
				method: editing === null ? "POST" : "PATCH",
				body: JSON.stringify(values),
			})
			const wasEditing = editing !== null
			setEditing(null)
			setModalOpen(false)
			reload()
			setStatus(wasEditing ? "Integration updated." : "Clockify integration saved.")
			setStatusError(false)
		} catch (err) {
			setModalStatus(err instanceof Error ? err.message : "Failed to save integration.")
		}
	}

	return (
		<>
			<section className="workspace workspace--single">
				<div className="card panel">
					<div className="section-header">
						<h2>External Integrations</h2>
						<button id="integration-create-button" className="primary" type="button" onClick={openCreate}>
							Create
						</button>
					</div>
					<Status message={loading ? "Loading integrations..." : (error ?? status) || "Integrations loaded."} error={!!error || statusError} />
					<div id="integrations-list" className="integration-list">
						{!loading && !error && integrations.length === 0 ? <Empty message="No integrations configured." /> : null}
						{integrations.length > 0 ? (
							<div className="integration-table" role="table" aria-label="External integrations">
								<div className="integration-table__row integration-table__row--head" role="row">
									<div role="columnheader">Name</div>
									<div role="columnheader">Provider</div>
									<div role="columnheader">Workspace</div>
									<div role="columnheader">Status</div>
									<div role="columnheader">Updated</div>
									<div role="columnheader">Actions</div>
								</div>
								{integrations.map((integration) => (
									<div key={integration.id} className="integration-table__row" role="row">
										<div role="cell">
											<strong>{integration.name}</strong>
										</div>
										<div role="cell">{integration.provider === PROVIDER_CLOCKIFY ? "Clockify" : `Provider ${integration.provider}`}</div>
										<div role="cell">{integration.config.workspace_id ?? "Unknown workspace"}</div>
										<div role="cell">
											<span className="tag">{integration.status === STATUS_ACTIVE ? "Active" : "Disabled"}</span>
										</div>
										<div role="cell">{formatDateTime(integration.updated_at)}</div>
										<div role="cell">
											<button className="secondary" type="button" onClick={() => void openEdit(integration.id)}>
												Edit
											</button>
										</div>
									</div>
								))}
							</div>
						) : null}
					</div>
				</div>
			</section>
			<Modal id="integration-create-modal" title={editing ? "Edit Integration" : "Create Integration"} open={modalOpen} onClose={() => setModalOpen(false)}>
				<form id="clockify-configure-form" autoComplete="off" onSubmit={save}>
					<label>
						Type
						<select name="provider" required value={provider} onChange={(e) => setProvider(e.target.value)}>
							<option value={PROVIDER_CLOCKIFY}>Clockify</option>
						</select>
					</label>
					<label>
						Name
						<input name="name" type="text" required value={name} onChange={(e) => setName(e.target.value)} />
					</label>
					<label>
						Workspace ID
						<input name="workspace_id" type="text" required value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} />
					</label>
					<label>
						API Key
						<input
							name="api_key"
							type="password"
							required={editing === null}
							placeholder={editing === null ? "" : "Leave blank to keep the stored key"}
							value={apiKey}
							onChange={(e) => setApiKey(e.target.value)}
						/>
					</label>
					<p id="clockify-api-key-hint" className="form-hint">
						{editing === null
							? "Required for a new integration."
							: editing.credentials_configured
								? "A key is stored securely. Leave this blank to keep it, or enter a replacement."
								: "No key is stored. Enter a Clockify API key."}
					</p>
					<label>
						Clockify API base URL
						<input name="api_base_url" type="url" placeholder="https://api.clockify.me/api/v1" value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value)} />
					</label>
					<label>
						Clockify reports base URL
						<input name="reports_base_url" type="url" placeholder="https://reports.api.clockify.me/v1" value={reportsBaseUrl} onChange={(e) => setReportsBaseUrl(e.target.value)} />
					</label>
					<div className="actions">
						<button className="primary" type="submit">
							Save
						</button>
						<button className="secondary" type="button" onClick={() => setModalOpen(false)}>
							Cancel
						</button>
					</div>
					<Status message={modalStatus} error={!!modalStatus} />
				</form>
			</Modal>
		</>
	)
}
