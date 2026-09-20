import { apiFetch } from "./api"
import { setDragPayload } from "./dnd"
import { formatReceiptDateTime, type InventoryContainer, type InventoryItem } from "./lib"

export const getInventoryItemMeta = (item: InventoryItem) => {
	const parts: string[] = []
	if (item.product?.name && item.product.name !== item.name) parts.push(`Product ${item.product.name}`)
	if (item.ingredient?.name && item.ingredient.name !== item.name) parts.push(`Ingredient ${item.ingredient.name}`)
	if (item.purchased_at) parts.push(`Bought ${formatReceiptDateTime(item.purchased_at)}`)
	if (item.expires_at) parts.push(`Expires ${formatReceiptDateTime(item.expires_at)}`)
	if (item.consumed_at) parts.push(`Consumed ${formatReceiptDateTime(item.consumed_at)}`)
	if (item.notes) parts.push(item.notes)
	return parts.join(" • ")
}

export const expirationTag = (item: InventoryItem) => {
	if (!item.expires_at) return { className: "tag tag--neutral", label: "No date" }
	const now = new Date()
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
	const expires = new Date(item.expires_at)
	const day = new Date(expires.getFullYear(), expires.getMonth(), expires.getDate()).getTime()
	const days = Math.round((day - today) / 86_400_000)
	if (days < 0) return { className: "tag tag--danger", label: "Expired" }
	if (days === 0) return { className: "tag tag--warning", label: "Today" }
	if (days <= 3) return { className: "tag tag--warning", label: `${days}d` }
	return { className: "tag", label: `${days}d` }
}

export const sortByExpiration = (items: InventoryItem[]) =>
	[...items].sort((l, r) => {
		if (l.expires_at && r.expires_at) {
			const d = Date.parse(l.expires_at) - Date.parse(r.expires_at)
			if (d !== 0) return d
		}
		if (l.expires_at) return -1
		if (r.expires_at) return 1
		return l.name.localeCompare(r.name)
	})

export const updateInventoryItem = (id: number, payload: Record<string, unknown>) =>
	apiFetch(`/api/inventory-items/${id}`, { method: "PATCH", body: JSON.stringify(payload) })

export const createInventoryContainer = (payload: { name: string; parent_container_id: number | null; notes: string | null }) =>
	apiFetch<InventoryContainer>("/api/inventory-containers", { method: "POST", body: JSON.stringify(payload) })

export const updateInventoryContainer = (id: number, payload: { name?: string; parent_container_id?: number | null; notes?: string | null }) =>
	apiFetch<InventoryContainer>(`/api/inventory-containers/${id}`, { method: "PATCH", body: JSON.stringify(payload) })

export const deleteInventoryContainer = (id: number) =>
	apiFetch<void>(`/api/inventory-containers/${id}`, { method: "DELETE" })

export const InventoryItemNode = ({
	item,
	link,
	showConsumeAction,
	onConsume,
	draggable = true,
}: {
	item: InventoryItem
	link: (p: string) => string
	showConsumeAction?: boolean
	onConsume?: (item: InventoryItem) => void
	draggable?: boolean
}) => {
	const isConsumed = item.consumed_at !== null
	const canDrag = draggable && !isConsumed
	const meta = getInventoryItemMeta(item)
	return (
		<div
			className={`inventory-node inventory-node--item${isConsumed ? " inventory-node--consumed" : ""}`}
			draggable={canDrag}
			data-drag-kind={canDrag ? "item" : undefined}
			data-drag-id={canDrag ? String(item.id) : undefined}
			data-source-container-id={canDrag ? String(item.container_id ?? "") : undefined}
			onDragStart={
				canDrag
					? (event) => {
							setDragPayload(event, { kind: "item", id: item.id })
							event.currentTarget.classList.add("inventory-node--dragging")
						}
					: undefined
			}
			onDragEnd={
				canDrag
					? (event) => {
							event.currentTarget.classList.remove("inventory-node--dragging")
						}
					: undefined
			}
		>
			<a className="inventory-node__main inventory-node__link" href={link(`/inventory/items/${item.id}`)} data-link="">
				<strong>{item.name}</strong>
				<div className="inventory-node__meta">
					<span>{`${item.quantity} ${item.unit}`}</span>
					{meta ? <span>{meta}</span> : null}
				</div>
			</a>
			{showConsumeAction && !isConsumed ? (
				<div className="inventory-node__actions">
					<button className="secondary inventory-node__button" type="button" onClick={() => onConsume?.(item)}>
						Consume
					</button>
				</div>
			) : null}
		</div>
	)
}
