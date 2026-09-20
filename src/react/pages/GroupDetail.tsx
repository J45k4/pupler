import { useState } from "react"
import { apiFetch } from "../api"
import { Empty, Status, formatReceiptDateTime, useApi, type Group, type PurchaseReceipt } from "../lib"
import { ReceiptCard } from "../catalog"

export const GroupDetailPage = ({ id, link }: { id: string; link: (p: string) => string }) => {
	const groupId = Number.parseInt(id, 10)
	const valid = Number.isInteger(groupId)
	const { data: group, loading: groupLoading, error: groupError, reload: reloadGroup } = useApi<Group>(
		valid ? `/api/groups/${groupId}` : null,
	)
	const { data: receipts, loading: receiptsLoading, error: receiptsError, reload: reloadReceipts } = useApi<PurchaseReceipt[]>(
		valid ? `/api/receipts?group_id=${groupId}&sort=purchased_at&order=desc` : null,
	)
	const [name, setName] = useState<string | null>(null)
	const [status, setStatus] = useState("")
	const [statusError, setStatusError] = useState(false)

	if (!valid) return <div className="card panel page-panel"><p className="page-copy">Group id is invalid.</p></div>

	const loading = groupLoading || receiptsLoading
	const error = groupError ?? receiptsError
	const rows = receipts ?? []
	const currentName = name ?? group?.name ?? ""

	const save = async (event: React.FormEvent) => {
		event.preventDefault()
		const trimmed = currentName.trim()
		if (!trimmed) {
			setStatus("Group name is required.")
			setStatusError(true)
			return
		}
		try {
			const updated = await apiFetch<Group>(`/api/groups/${groupId}`, {
				method: "PATCH",
				body: JSON.stringify({ name: trimmed }),
			})
			setName(updated.name)
			setStatus(`Saved ${updated.name}.`)
			setStatusError(false)
			reloadGroup()
			reloadReceipts()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to save group.")
			setStatusError(true)
		}
	}

	return (
		<>
			<section className="page-heading page-heading--compact">
				<div>
					<span className="eyebrow">Group</span>
				</div>
				<a className="secondary action-link" href={link("/receipts")} data-link="">
					Back To Receipts
				</a>
			</section>
			{loading ? <p className="page-copy">Loading…</p> : null}
			{error ? <Status message={error} error /> : null}
			{!loading && !error && group ? (
				<section className="workspace">
					<div className="card panel">
						<h2>Group Details</h2>
						<form id="group-detail-form" onSubmit={save}>
							<label>
								Name
								<input id="group-detail-name" name="name" required value={currentName} onChange={(e) => setName(e.target.value)} />
							</label>
							<div className="actions">
								<button className="primary" type="submit">
									Save Group
								</button>
							</div>
						</form>
						<Status message={status} error={statusError} />
						<dl className="receipt-metadata">
							<div>
								<dt>Created</dt>
								<dd>{formatReceiptDateTime(group.created_at)}</dd>
							</div>
							<div>
								<dt>Updated</dt>
								<dd>{formatReceiptDateTime(group.updated_at)}</dd>
							</div>
						</dl>
					</div>
					<div className="card panel">
						<div className="section-header">
							<h2>Receipts</h2>
							<span className="tag tag--neutral">{String(rows.length)}</span>
						</div>
						<div className="results">
							{rows.length ? rows.map((r) => <ReceiptCard key={r.id} receipt={r} link={link} draggable={false} />) : <Empty message="No receipts in this group." />}
						</div>
					</div>
				</section>
			) : null}
		</>
	)
}
