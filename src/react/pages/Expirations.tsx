import { useState } from "react"
import { Empty, Status, formatReceiptDateTime, useApi, type InventoryContainer, type InventoryItem } from "../lib"
import { expirationTag, sortByExpiration, updateInventoryItem } from "../inventory"

export const ExpirationsPage = ({ link }: { link: (p: string) => string }) => {
	const [status, setStatus] = useState("")
	const [statusError, setStatusError] = useState(false)
	const { data: itemsData, loading: itemsLoading, error: itemsError, reload } = useApi<InventoryItem[]>(
		"/api/inventory-items?consumed_at=null&sort=expires_at&order=asc",
	)
	const { data: containersData } = useApi<InventoryContainer[]>("/api/inventory-containers?sort=name&order=asc")

	const containersById = new Map((containersData ?? []).map((c) => [c.id, c.name]))
	const items = sortByExpiration(itemsData ?? [])

	const consume = async (item: InventoryItem) => {
		try {
			await updateInventoryItem(item.id, { consumed_at: new Date().toISOString() })
			setStatus(`Consumed ${item.name}.`)
			setStatusError(false)
			reload()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to consume inventory item.")
			setStatusError(true)
		}
	}

	const loading = itemsLoading
	const error = itemsError

	return (
		<>
			<section className="page-heading page-heading--compact">
				<a className="secondary action-link" href={link("/inventory")} data-link="">
					Back To Inventory
				</a>
			</section>
			<section className="workspace workspace--single">
				<div className="card panel inventory-expiration-panel">
					<div className="section-header section-header--end">
						<Status
							message={loading ? "Loading…" : (error ?? status) || `${items.length} active item(s).`}
							error={!!error || statusError}
						/>
					</div>
					<div id="expiration-results">
						{!loading && !error ? (
							items.length === 0 ? (
								<Empty message="No active inventory items." />
							) : (
								<div className="inventory-expiration-list">
									{items.map((item) => {
										const tag = expirationTag(item)
										const location = item.container_id === null ? "Top level" : (containersById.get(item.container_id) ?? "Unknown container")
										return (
											<div key={item.id} className="inventory-expiration-item">
												<a className="inventory-expiration-item__main" href={link(`/inventory/items/${item.id}`)} data-link="">
													<strong>{item.name}</strong>
													<div className="inventory-node__meta">
														<span>{`${item.quantity} ${item.unit}`}</span>
														<span>{location}</span>
														<span>
															{item.expires_at ? `Expires ${formatReceiptDateTime(item.expires_at)}` : "No expiration date"}
														</span>
													</div>
												</a>
												<div className="inventory-expiration-item__actions">
													<span className={tag.className}>{tag.label}</span>
													<button className="secondary inventory-node__button" type="button" onClick={() => void consume(item)}>
														Consume
													</button>
												</div>
											</div>
										)
									})}
								</div>
							)
						) : null}
					</div>
				</div>
			</section>
		</>
	)
}
