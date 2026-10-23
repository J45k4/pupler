import { useEffect, useId, useRef, useState } from "react"
import { discardOfflineChanges, offlineStatus, syncOfflineChanges } from "./offline"

export const OfflineStatus = ({ currentPath, onOpen }: { currentPath: string; onOpen: () => void }) => {
	const [status, setStatus] = useState(offlineStatus)
	const [online, setOnline] = useState(navigator.onLine)
	const [open, setOpen] = useState(false)
	const root = useRef<HTMLDivElement>(null)
	const trigger = useRef<HTMLButtonElement>(null)
	const panel = useRef<HTMLElement>(null)
	const panelId = useId()
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
	useEffect(() => setOpen(false), [currentPath])
	useEffect(() => {
		if (!open) return
		panel.current?.focus()
		const outside = (event: PointerEvent) => {
			if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
		}
		const escape = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return
			setOpen(false)
			trigger.current?.focus()
		}
		document.addEventListener("pointerdown", outside)
		document.addEventListener("keydown", escape)
		return () => {
			document.removeEventListener("pointerdown", outside)
			document.removeEventListener("keydown", escape)
		}
	}, [open])
	const state = status.error ? "error" : !online ? "offline" : status.pending ? status.syncing ? "syncing" : "pending" : "saved"
	const label = state === "error" ? "Needs attention" : state === "offline" ? "Offline" : state === "syncing" ? "Syncing" : state === "pending" ? "Changes waiting to sync" : "All changes saved"
	const changes = `${status.pending} change${status.pending === 1 ? "" : "s"}`
	const message =
		status.error ||
		(!online
			? `Offline · ${status.pending ? `${changes} saved on this device` : "Changes will be saved on this device"}`
			: status.pending ? status.syncing ? `Syncing ${changes}…` : `${changes} waiting to sync` : "All changes saved.")
	return (
		<div ref={root} className={`sync-status sync-status--${state}`} onBlurCapture={event => {
			if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false)
		}}>
			<button ref={trigger} className="sync-status__trigger" type="button" aria-label={`Sync status: ${label}`} title={message} aria-haspopup="dialog" aria-expanded={open} aria-controls={panelId} onClick={() => {
				if (!open) onOpen()
				setOpen(value => !value)
			}}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
					{state === "syncing" || state === "pending" ? <g className={state === "syncing" ? "sync-status__spinner" : undefined}><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 6a8 8 0 0 1 14 6M18 18A8 8 0 0 1 4 12" /></g> : state === "error" ? <><circle cx="12" cy="12" r="9" /><path d="M12 7v6m0 4h.01" /></> : <><path d="M7 18H6a4 4 0 0 1-.5-8A6.5 6.5 0 0 1 18 8a5 5 0 0 1 1 9.9" />{state === "offline" ? <path d="m3 3 18 18m-10-7 4 4m0-4-4 4" /> : <path d="m10 17 3 3 6-6" />}</>}
				</svg>
				{status.pending > 0 ? <span className="sync-status__count" aria-hidden="true">{status.pending > 99 ? "99+" : status.pending}</span> : null}
			</button>
			<span className="sync-status__announcement" role="status">{message}</span>
			<section ref={panel} id={panelId} className="sync-status__panel" role="dialog" aria-label="Sync status" tabIndex={-1} hidden={!open}>
				<div className="sync-status__heading"><strong>Sync status</strong><button type="button" className="sync-status__close" aria-label="Close sync status" onClick={() => { setOpen(false); trigger.current?.focus() }}>×</button></div>
				<p className={status.error ? "sync-status__error" : undefined}>
					{message}
				</p>
				{status.pending > 0 ? (
					<div>
						<h3>Pending changes ({status.pending})</h3>
						<ul className="sync-status__changes">
							{status.operations.map((operation) => (
								<li key={operation.id}>
									{operation.path.includes("time-entries")
										? `${operation.path.endsWith("/start") ? "Start timer" : operation.path.endsWith("/stop") ? "Stop timer" : "Update time entry"}: ${new Date(operation.time).toLocaleString()}`
										: (operation.optimistic.name ?? "Shopping list change")}
									{operation.error ? ` — ${operation.error}` : ""}
								</li>
							))}
						</ul>
						<div className="sync-status__actions">
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
					</div>
				) : null}
			</section>
		</div>
	)
}
