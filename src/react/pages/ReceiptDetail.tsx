import { useEffect, useState } from "react"
import { apiFetch } from "../api"
import { Empty, Status, formatMoney, formatReceiptDateTime, useApi, type Group, type Product, type PurchaseReceipt, type ReceiptItem } from "../lib"
import { findOrCreateGroup } from "./Receipts"

export const ReceiptDetailPage = ({ id, link }: { id: string; link: (p: string) => string }) => {
	const receiptId = Number.parseInt(id, 10)
	const valid = Number.isInteger(receiptId)
	const { data: receipt, loading: rLoading, error: rError, reload: reloadReceipt } = useApi<PurchaseReceipt>(
		valid ? `/api/receipts/${receiptId}` : null,
	)
	const { data: items } = useApi<ReceiptItem[]>(
		valid ? `/api/receipt-items?receipt_id=${receiptId}` : null,
	)
	const { data: products } = useApi<Product[]>("/api/products")
	const { data: groups, reload: reloadGroups } = useApi<Group[]>("/api/groups?sort=name&order=asc")

	const [groupName, setGroupName] = useState<string | null>(null)
	const [groupStatus, setGroupStatus] = useState("")
	const [groupError, setGroupError] = useState(false)
	const [pictureOpen, setPictureOpen] = useState(false)
	const [pictureBroken, setPictureBroken] = useState(false)

	useEffect(() => {
		if (receipt) setGroupName(receipt.group?.name ?? "")
	}, [receipt?.id])

	if (!valid) return <div className="card panel page-panel"><p className="page-copy">Receipt id is invalid.</p></div>
	if (rLoading) return <p className="page-copy">Loading…</p>
	if (rError || !receipt) return <Status message={rError ?? "Failed to load receipt."} error />

	const rows = items ?? []
	const productsById = new Map((products ?? []).map((p) => [p.id, p]))
	const pictureUrl = receipt.picture_file?.created_at
		? `/api/receipts/${receipt.id}/picture?updated=${encodeURIComponent(receipt.picture_file.created_at)}`
		: `/api/receipts/${receipt.id}/picture`

	const saveGroup = async (event: React.FormEvent) => {
		event.preventDefault()
		try {
			const trimmed = (groupName ?? "").trim()
			const group = trimmed ? await findOrCreateGroup(trimmed, groups ?? []) : null
			await apiFetch(`/api/receipts/${receipt.id}`, {
				method: "PATCH",
				body: JSON.stringify({ group_id: group?.id ?? null }),
			})
			setGroupStatus(group ? `Saved group ${group.name}.` : "Cleared receipt group.")
			setGroupError(false)
			reloadReceipt()
			reloadGroups()
		} catch (err) {
			setGroupStatus(err instanceof Error ? err.message : "Failed to save receipt group")
			setGroupError(true)
		}
	}

	return (
		<>
			<section className="page-heading page-heading--compact">
				<div>
					<span className="eyebrow">Receipt</span>
				</div>
				<a className="secondary action-link" href={link("/receipts")} data-link="">
					Back To Receipts
				</a>
			</section>
			<section className="workspace receipt-detail-grid">
				<div className="card panel">
					<h2>Receipt</h2>
					<div className="receipt-picture">
						{pictureBroken ? (
							<Empty message="No receipt picture uploaded." />
						) : (
							<button className="receipt-picture__trigger" type="button" aria-label="Receipt picture" onClick={() => setPictureOpen(true)}>
								<img
									className="receipt-picture__image"
									src={pictureUrl}
									alt={receipt.store_name}
									loading="lazy"
									onError={() => setPictureBroken(true)}
								/>
							</button>
						)}
					</div>
					<dl className="receipt-metadata">
						<div>
							<dt>Store</dt>
							<dd>{receipt.store_name}</dd>
						</div>
						<div>
							<dt>Purchased</dt>
							<dd>{formatReceiptDateTime(receipt.purchased_at)}</dd>
						</div>
						<div>
							<dt>Total</dt>
							<dd>{formatMoney(receipt.total_amount, receipt.currency)}</dd>
						</div>
						<div>
							<dt>Group</dt>
							<dd>{receipt.group?.name ?? "Ungrouped"}</dd>
						</div>
					</dl>
					<form id="receipt-detail-group-form" className="receipt-group-form" onSubmit={saveGroup}>
						<label>
							Group
							<input
								id="receipt-detail-group-name"
								value={groupName ?? ""}
								onChange={(e) => setGroupName(e.target.value)}
								list="receipt-detail-group-options"
							/>
							<datalist id="receipt-detail-group-options">
								{(groups ?? []).map((g) => (
									<option key={g.id} value={g.name} />
								))}
							</datalist>
						</label>
						<div className="actions">
							<button className="primary" type="submit">
								Save Group
							</button>
							<button
								id="receipt-detail-clear-group"
								className="secondary"
								type="button"
								onClick={() => {
									setGroupName("")
								}}
							>
								Clear
							</button>
						</div>
					</form>
					<Status message={groupStatus} error={groupError} />
				</div>
				<div className="card panel">
					<div className="section-header">
						<h2>Items</h2>
						<span className="tag tag--neutral">{`${rows.length} items`}</span>
					</div>
					{rows.length === 0 ? (
						<Empty message="No receipt items." />
					) : (
						<table className="shoppinglist-table">
							<thead>
								<tr>
									<th>Product Name</th>
									<th>Quantity</th>
									<th>Line Total</th>
								</tr>
							</thead>
							<tbody>
								{rows.map((item) => (
									<tr key={item.id}>
										<td>{productsById.get(item.product_id)?.name ?? `Product #${item.product_id}`}</td>
										<td>{`${item.quantity} ${item.unit}`}</td>
										<td>{item.line_total !== null ? formatMoney(item.line_total, receipt.currency) : "-"}</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</div>
			</section>
			{pictureOpen && !pictureBroken ? (
				<div className="app-modal" id="receipt-picture-modal">
					<div className="app-modal__backdrop" onClick={() => setPictureOpen(false)} />
					<div className="receipt-modal__viewport">
						<img className="receipt-modal__image" src={pictureUrl} alt={receipt.store_name} />
						<button className="secondary" type="button" aria-label="Close receipt picture" onClick={() => setPictureOpen(false)}>
							Close
						</button>
					</div>
				</div>
			) : null}
		</>
	)
}
