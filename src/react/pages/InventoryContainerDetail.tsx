import { useEffect, useState } from "react"
import { apiFetch } from "../api"
import { Empty, Status, useApi, type InventoryContainer, type InventoryItem } from "../lib"
import { InventoryItemNode, deleteInventoryContainer, updateInventoryContainer } from "../inventory"

export const InventoryContainerDetailPage = ({
	id,
	link,
	navigate,
}: {
	id: string
	link: (p: string) => string
	navigate: (p: string) => void
}) => {
	const containerId = Number.parseInt(id, 10)
	const valid = Number.isInteger(containerId)
	const { data: container, loading: cLoading, error: cError, reload: reloadContainer } = useApi<InventoryContainer>(
		valid ? `/api/inventory-containers/${containerId}` : null,
	)
	const { data: containers } = useApi<InventoryContainer[]>("/api/inventory-containers?sort=name&order=asc")
	const { data: items } = useApi<InventoryItem[]>(
		valid ? `/api/inventory-items?container_id=${containerId}&consumed_at=null&sort=expires_at&order=asc` : null,
	)

	const [name, setName] = useState<string | null>(null)
	const [parentId, setParentId] = useState<string | null>(null)
	const [notes, setNotes] = useState<string | null>(null)
	const [status, setStatus] = useState("")
	const [statusError, setStatusError] = useState(false)

	useEffect(() => {
		if (!container) return
		setName(container.name)
		setParentId(container.parent_container_id === null ? "" : String(container.parent_container_id))
		setNotes(container.notes ?? "")
	}, [container?.id])

	if (!valid) return <div className="card panel page-panel"><p className="page-copy">Container id is invalid.</p></div>
	if (cLoading) return <p className="page-copy">Loading…</p>
	if (cError || !container) return <Status message={cError ?? "Failed to load inventory container."} error />

	const all = containers ?? []
	const descendants = new Set<number>([containerId])
	let changed = true
	while (changed) {
		changed = false
		for (const c of all) {
			if (c.parent_container_id !== null && descendants.has(c.parent_container_id) && !descendants.has(c.id)) {
				descendants.add(c.id)
				changed = true
			}
		}
	}
	const parentOptions = all.filter((c) => !descendants.has(c.id)).sort((a, b) => a.name.localeCompare(b.name))
	const children = all.filter((c) => c.parent_container_id === containerId).sort((a, b) => a.name.localeCompare(b.name))
	const activeItems = items ?? []

	const save = async (event: React.FormEvent) => {
		event.preventDefault()
		try {
			const updated = await updateInventoryContainer(containerId, {
				name: (name ?? "").trim(),
				parent_container_id: parentId ? Number(parentId) : null,
				notes: (notes ?? "").trim() || null,
			})
			setStatus(`Saved ${updated.name}.`)
			setStatusError(false)
			reloadContainer()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to save container.")
			setStatusError(true)
		}
	}

	const remove = async () => {
		if (!window.confirm(`Delete ${container.name}? Child containers and inventory items will be unassigned.`)) return
		try {
			await deleteInventoryContainer(containerId)
			navigate(link("/inventory"))
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to delete container.")
			setStatusError(true)
		}
	}

	return (
		<>
			<section className="page-heading page-heading--compact">
				<a className="secondary action-link" href={link("/inventory")} data-link="">
					Back To Inventory
				</a>
			</section>
			<section className="workspace">
				<div className="card panel">
					<h2>Container Details</h2>
					<form id="inventory-container-detail-form" onSubmit={save}>
						<label>
							Name
							<input id="inventory-container-detail-name" name="name" required value={name ?? ""} onChange={(e) => setName(e.target.value)} />
						</label>
						<label>
							Inside
							<select id="inventory-container-detail-parent" name="parent_container_id" value={parentId ?? ""} onChange={(e) => setParentId(e.target.value)}>
								<option value="">Top level</option>
								{parentOptions.map((c) => (
									<option key={c.id} value={String(c.id)}>
										{c.name}
									</option>
								))}
							</select>
						</label>
						<label>
							Notes
							<input id="inventory-container-detail-notes" name="notes" placeholder="Pantry shelf or freezer drawer" value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} />
						</label>
						<div className="actions">
							<button className="primary" type="submit">
								Save
							</button>
							<button id="inventory-container-detail-delete" className="secondary" type="button" onClick={() => void remove()}>
								Delete
							</button>
						</div>
					</form>
					<Status message={status} error={statusError} />
				</div>
				<div className="card panel">
					<h2>Contents</h2>
					<div className="results">
						<div className="inventory-detail-block">
							<h3>Child Containers</h3>
							<div id="inventory-container-detail-children">
								{children.length === 0 ? (
									<Empty message="No child containers." />
								) : (
									<div className="inventory-detail-list">
										{children.map((child) => (
											<a key={child.id} className="receipt-card" href={link(`/inventory/containers/${child.id}`)} data-link="">
												<div className="receipt-card__header">
													<h3>{child.name}</h3>
												</div>
												<div className="section-copy">{child.notes ?? "No notes"}</div>
											</a>
										))}
									</div>
								)}
							</div>
						</div>
						<div className="inventory-detail-block">
							<h3>Active Items</h3>
							<div id="inventory-container-detail-items">
								{activeItems.length === 0 ? (
									<Empty message="No active items in this container." />
								) : (
									<div className="inventory-detail-list">
										{activeItems.map((item) => (
											<InventoryItemNode key={item.id} item={item} link={link} />
										))}
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			</section>
		</>
	)
}
