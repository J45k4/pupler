import { useState } from "react"
import { apiFetch } from "./api"
import { Status, useApi } from "./lib"

type Connection = { id: string; scope: string; created_at: string; last_used_at: string | null; client: { name: string } }
const labels: Record<string, string> = { "receipts:read": "View receipts", "receipts:write": "Manage receipts and images", "products:read": "Search products", "products:write": "Create products" }

export const ConnectedApps = () => {
	const { data, loading, error, reload } = useApi<Connection[]>("/api/auth/connections")
	const [status, setStatus] = useState("")
	const [pending, setPending] = useState<string | null>(null)
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
			<p>Apps you have allowed to access Pupler. Disconnecting an app revokes its access and pending image uploads.</p>
			<Status message={status} />
			{loading ? <p>Loading…</p> : error ? <Status message={error} error /> : !data?.length ? <p>No connected apps yet.</p> : (
				<div className="api-key-list">
					{data.map(connection => (
						<div key={connection.id} className="api-key-card">
							<div className="api-key-details">
								<strong>{connection.client.name}</strong>
								<p>{connection.scope.split(" ").map(scope => labels[scope] ?? scope).join(", ")}</p>
								<div className="api-key-dates">
									<span>Connected {new Date(connection.created_at).toLocaleString()}</span>
									<span>Last used {connection.last_used_at ? new Date(connection.last_used_at).toLocaleString() : "never"}</span>
								</div>
							</div>
							<button type="button" disabled={pending !== null} onClick={() => void revoke(connection)}>{pending === connection.id ? "Disconnecting…" : "Disconnect"}</button>
						</div>
					))}
				</div>
			)}
		</div>
	)
}
