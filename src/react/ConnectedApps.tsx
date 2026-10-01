import { useState } from "react"
import { apiFetch } from "./api"
import { Status, useApi } from "./lib"

type Connection = { id: string; scope: string; created_at: string; last_used_at: string | null; client: { name: string } }
const available: { value: string; label: string }[] = [
	{ value: "receipts:read", label: "View receipts" },
	{ value: "receipts:write", label: "Manage receipts and images" },
	{ value: "products:read", label: "Search products" },
	{ value: "products:write", label: "Create products" },
	{ value: "inventory:read", label: "View inventory" },
	{ value: "inventory:write", label: "Manage inventory" },
	{ value: "shopping_lists:read", label: "View shopping lists" },
	{ value: "shopping_lists:write", label: "Manage shopping lists" },
]
const permissionGroups = [
	{ key: "receipts", label: "Receipts" },
	{ key: "products", label: "Products" },
	{ key: "inventory", label: "Inventory" },
	{ key: "shopping_lists", label: "Shopping lists" },
]

export const ConnectedApps = () => {
	const { data, loading, error, reload } = useApi<Connection[]>("/api/auth/connections")
	const [status, setStatus] = useState("")
	const [pending, setPending] = useState<string | null>(null)
	const [editing, setEditing] = useState<string | null>(null)
	const [draft, setDraft] = useState<string[]>([])
	const startEdit = (connection: Connection) => {
		setEditing(connection.id)
		setDraft(connection.scope.split(" ").filter(Boolean))
		setStatus("")
	}
	const toggle = (value: string) => setDraft(current => current.includes(value) ? current.filter(scope => scope !== value) : [...current, value])
	const save = async (connection: Connection) => {
		if (!draft.length) {
			setStatus("Select at least one permission.")
			return
		}
		setPending(connection.id)
		try {
			await apiFetch(`/api/auth/connections/${connection.id}`, { method: "PATCH", body: JSON.stringify({ scope: draft.join(" ") }) })
			setStatus(`${connection.client.name} permissions updated. Changes apply immediately.`)
			setEditing(null)
			reload()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Could not update permissions")
		} finally { setPending(null) }
	}
	const revoke = async (connection: Connection) => {
		if (!window.confirm(`Disconnect ${connection.client.name}? It will lose access to Pupler immediately.`)) return
		setPending(connection.id)
		try {
			await apiFetch(`/api/auth/connections/${connection.id}`, { method: "DELETE" })
			setStatus(`${connection.client.name} disconnected.`)
			reload()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Could not disconnect app")
		} finally { setPending(null) }
	}
	return (
		<div className="card panel settings-panel">
			<h2>Connected apps</h2>
			<p>Review what each app can access. Edit its permissions or disconnect it to revoke access.</p>
			<Status message={status} />
			{loading ? <p>Loading…</p> : error ? <Status message={error} error /> : !data?.length ? <p>No connected apps yet.</p> : (
				<div className="api-key-list">
					{data.map(connection => (
						<div key={connection.id} className="api-key-card connected-app-card">
							<div className="api-key-details">
								<strong>{connection.client.name}</strong>
								{editing === connection.id ? (
									<div className="connected-app-permissions">
										{available.map(scope => (
											<label key={scope.value} className="connected-app-permission">
												<input type="checkbox" checked={draft.includes(scope.value)} disabled={pending !== null} onChange={() => toggle(scope.value)} />
												<span>{scope.label}</span>
											</label>
										))}
									</div>
								) : (
									<dl className="connected-app-summary">
										{permissionGroups.map(group => {
											const granted = available.filter(scope => scope.value.startsWith(`${group.key}:`) && connection.scope.split(" ").includes(scope.value))
											if (!granted.length) return null
											return (
												<div key={group.key}>
													<dt>{group.label}</dt>
													<dd>{granted.map(scope => <span key={scope.value}>{scope.label}</span>)}</dd>
												</div>
											)
										})}
										{connection.scope.split(" ").filter(scope => scope && !available.some(permission => permission.value === scope)).map(scope => (
											<div key={scope}><dt>Other permission</dt><dd>{scope}</dd></div>
										))}
									</dl>
								)}
								<div className="api-key-dates">
									<span>Connected {new Date(connection.created_at).toLocaleString()}</span>
									<span>{connection.last_used_at ? `Last used ${new Date(connection.last_used_at).toLocaleString()}` : "Not used yet"}</span>
								</div>
							</div>
							{editing === connection.id ? (
								<div className="connected-app-actions">
									<button type="button" disabled={pending !== null} onClick={() => void save(connection)}>{pending === connection.id ? "Saving…" : "Save"}</button>
									<button type="button" disabled={pending !== null} onClick={() => setEditing(null)}>Cancel</button>
								</div>
							) : (
								<div className="connected-app-actions">
									<button type="button" disabled={pending !== null} onClick={() => startEdit(connection)}>Edit</button>
									<button type="button" disabled={pending !== null} onClick={() => void revoke(connection)}>{pending === connection.id ? "Disconnecting…" : "Disconnect"}</button>
								</div>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	)
}
