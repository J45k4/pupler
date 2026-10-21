import { useEffect, useState } from "react"
import { discardOfflineChanges, offlineStatus, syncOfflineChanges } from "./offline"

export const OfflineStatus = () => {
	const [status, setStatus] = useState(offlineStatus)
	const [online, setOnline] = useState(navigator.onLine)
	useEffect(() => {
		const update = () => {
			setStatus(offlineStatus())
			setOnline(navigator.onLine)
		}
		window.addEventListener("pupler:offline", update)
		window.addEventListener("online", update)
		window.addEventListener("offline", update)
		return () => {
			window.removeEventListener("pupler:offline", update)
			window.removeEventListener("online", update)
			window.removeEventListener("offline", update)
		}
	}, [])
	if (online && !status.pending && !status.error) return null
	const message =
		status.error ||
		(status.syncing
			? `Syncing ${status.pending} changes…`
			: !online
				? `Offline · ${status.pending ? `${status.pending} changes saved on this device` : "Changes will be saved on this device"}`
				: `${status.pending} changes waiting to sync`)
	return (
		<aside className="card panel" style={{ margin: "12px 16px", padding: "12px 16px" }}>
			<p role="status" style={{ margin: 0 }}>
				{message}
			</p>
			{status.pending > 0 ? (
				<details>
					<summary>Pending changes ({status.pending})</summary>
					<ul>
						{status.operations.map((operation) => (
							<li key={operation.id}>
								{operation.path.includes("time-entries")
									? `${operation.path.endsWith("/start") ? "Start timer" : operation.path.endsWith("/stop") ? "Stop timer" : "Update time entry"}: ${new Date(operation.time).toLocaleString()}`
									: (operation.optimistic.name ?? "Shopping list change")}
								{operation.error ? ` — ${operation.error}` : ""}
							</li>
						))}
					</ul>
					<div className="actions">
						<button type="button" disabled={!online || status.syncing} onClick={() => void syncOfflineChanges(true)}>
							Retry sync
						</button>
						<button
							type="button"
							className="secondary"
							onClick={() => {
								const url = URL.createObjectURL(
									new Blob([JSON.stringify(status.operations, null, 2)], { type: "application/json" }),
								)
								const link = document.createElement("a")
								link.href = url
								link.download = "pupler-unsynced-changes.json"
								link.click()
								setTimeout(() => URL.revokeObjectURL(url), 1000)
							}}
						>
							Download changes
						</button>
						<button
							type="button"
							className="secondary"
							disabled={status.syncing}
							onClick={() => {
								if (window.confirm("Discard unsynced changes from this device? Download them first if you need a copy."))
									void discardOfflineChanges()
							}}
						>
							Discard changes
						</button>
					</div>
				</details>
			) : null}
		</aside>
	)
}
