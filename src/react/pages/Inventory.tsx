import { useMemo, useState } from "react"
import { apiFetch } from "../api"
import { Empty, Modal, Status, fromDateTimeLocalValue, toDateTimeLocalValue, useApi, type InventoryContainer, type InventoryItem } from "../lib"
import { InventoryItemNode, createInventoryContainer, deleteInventoryContainer, updateInventoryContainer, updateInventoryItem } from "../inventory"
import { closest, getDragPayload, setDragPayload, useDropHighlight } from "../dnd"

type Mode = "active" | "consumed" | "all"

const modeLabel = (mode: Mode) => (mode === "consumed" ? "consumed" : mode === "all" ? "total" : "active")
const emptyMessage = (mode: Mode) =>
	mode === "consumed" ? "No consumed inventory items." : mode === "all" ? "No inventory items." : "No active inventory items."

export const InventoryPage = ({ link }: { link: (p: string) => string }) => {
	const [mode, setMode] = useState<Mode>("active")
	const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
	const [status, setStatus] = useState("")
	const [statusError, setStatusError] = useState(false)
	const [containerOpen, setContainerOpen] = useState(false)
	const [containerName, setContainerName] = useState("")
	const [containerNotes, setContainerNotes] = useState("")
	const [consumeItem, setConsumeItem] = useState<InventoryItem | null>(null)
	const [consumeDate, setConsumeDate] = useState("")

	const itemsPath =
		mode === "active"
			? "/api/inventory-items?consumed_at=null&sort=expires_at&order=asc"
			: "/api/inventory-items?sort=expires_at&order=asc"
	const { data: itemsData, loading: itemsLoading, error: itemsError, reload: reloadItems } = useApi<InventoryItem[]>(itemsPath)
	const { data: containersData, loading: containersLoading, error: containersError, reload: reloadContainers } = useApi<InventoryContainer[]>(
		"/api/inventory-containers?sort=name&order=asc",
	)

	const reload = () => {
		reloadItems()
		reloadContainers()
	}

	const items = useMemo(() => {
		const all = itemsData ?? []
		if (mode === "consumed") return all.filter((i) => i.consumed_at !== null)
		return all
	}, [itemsData, mode])
	const containers = containersData ?? []
	const dropHighlight = useDropHighlight("inventory-drop-target--active")

	const containersById = useMemo(() => new Map(containers.map((c) => [c.id, c])), [containers])

	const isContainerDropInvalid = (containerId: number, targetParentId: number | null) => {
		if (targetParentId === null) return false
		if (targetParentId === containerId) return true
		let current: number | null = targetParentId
		while (current !== null) {
			if (current === containerId) return true
			current = containersById.get(current)?.parent_container_id ?? null
		}
		return false
	}

	const onTreeDragOver = (event: React.DragEvent) => {
		const dropTarget = closest(event.target, "[data-drop-kind]")
		if (!dropTarget) {
			dropHighlight.clear()
			return
		}
		event.preventDefault()
		if (event.dataTransfer) event.dataTransfer.dropEffect = "move"
		dropHighlight.highlight(dropTarget)
	}

	const onTreeDrop = (event: React.DragEvent) => {
		const dropTarget = closest(event.target, "[data-drop-kind]")
		dropHighlight.clear()
		if (!dropTarget) return
		event.preventDefault()
		const payload = getDragPayload(event)
		if (!payload || (payload.kind !== "item" && payload.kind !== "container")) return
		const dropKind = dropTarget.dataset.dropKind
		const targetContainerId = dropKind === "root" ? null : Number.parseInt(dropTarget.dataset.dropId ?? "", 10)
		if (dropKind === "container" && (targetContainerId === null || !Number.isInteger(targetContainerId))) return
		void (async () => {
			try {
				if (payload.kind === "item") {
					const source = items.find((item) => item.id === payload.id)?.container_id ?? null
					if (source === targetContainerId) return
					await updateInventoryItem(payload.id, { container_id: targetContainerId })
					setStatus("Inventory location updated.")
					setStatusError(false)
					reload()
					return
				}
				if (isContainerDropInvalid(payload.id, targetContainerId)) {
					setStatus("Container cannot be dropped into itself or one of its descendants.")
					setStatusError(true)
					return
				}
				const current = containersById.get(payload.id)
				if (current && (current.parent_container_id ?? null) === targetContainerId) return
				await updateInventoryContainer(payload.id, { parent_container_id: targetContainerId })
				setStatus("Container location updated.")
				setStatusError(false)
				reload()
			} catch (err) {
				setStatus(err instanceof Error ? err.message : "Failed to update inventory tree")
				setStatusError(true)
			}
		})()
	}

	const deleteContainer = async (container: InventoryContainer) => {
		if (!window.confirm(`Delete ${container.name}? Child containers and inventory items will be unassigned.`)) return
		try {
			await deleteInventoryContainer(container.id)
			setStatus(`Deleted container ${container.name}. Child containers and items are now unassigned.`)
			setStatusError(false)
			reload()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to delete inventory container")
			setStatusError(true)
		}
	}

	const children = useMemo(() => {
		const map = new Map<number | null, InventoryContainer[]>()
		for (const c of containers) {
			const key = c.parent_container_id ?? null
			map.set(key, [...(map.get(key) ?? []), c])
		}
		for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name))
		return map
	}, [containers])

	const itemsByContainer = useMemo(() => {
		const map = new Map<number | null, InventoryItem[]>()
		for (const item of items) {
			const key = item.container_id ?? null
			map.set(key, [...(map.get(key) ?? []), item])
		}
		for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name))
		return map
	}, [items])

	const loading = itemsLoading || containersLoading
	const error = itemsError ?? containersError

	const toggle = (id: number) =>
		setCollapsed((prev) => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})

	const countNested = (containerId: number): number => {
		const direct = itemsByContainer.get(containerId)?.length ?? 0
		const nested = children.get(containerId) ?? []
		return direct + nested.reduce((t, c) => t + countNested(c.id), 0)
	}

	const createContainer = async (event: React.FormEvent) => {
		event.preventDefault()
		if (!containerName.trim()) {
			setStatus("Container name is required.")
			setStatusError(true)
			return
		}
		try {
			const created = await createInventoryContainer({
				name: containerName.trim(),
				parent_container_id: null,
				notes: containerNotes.trim() || null,
			})
			setContainerName("")
			setContainerNotes("")
			setContainerOpen(false)
			setStatus(`Created container ${created.name}.`)
			setStatusError(false)
			reload()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to create inventory container")
			setStatusError(true)
		}
	}

	const consume = async (event: React.FormEvent) => {
		event.preventDefault()
		if (!consumeItem) return
		const date = consumeDate.trim() ? new Date(consumeDate) : new Date()
		if (Number.isNaN(date.getTime())) {
			setStatus("Consumed date is invalid.")
			setStatusError(true)
			return
		}
		try {
			await updateInventoryItem(consumeItem.id, { consumed_at: date.toISOString() })
			const name = consumeItem.name
			setConsumeItem(null)
			setStatus(`Consumed ${name}.`)
			setStatusError(false)
			reload()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to consume inventory item")
			setStatusError(true)
		}
	}

	const renderContainer = (container: InventoryContainer): React.ReactNode => {
		const childContainers = children.get(container.id) ?? []
		const hasChildren = childContainers.length > 0 || (itemsByContainer.get(container.id)?.length ?? 0) > 0
		const isCollapsed = hasChildren && collapsed.has(container.id)
		const count = countNested(container.id)
		return (
			<li key={container.id} className="inventory-tree__branch">
				<div
					className="inventory-node inventory-node--container inventory-drop-target"
					draggable
					data-drag-kind="container"
					data-drag-id={String(container.id)}
					data-drop-kind="container"
					data-drop-id={String(container.id)}
					onDragStart={(event) => {
						setDragPayload(event, { kind: "container", id: container.id })
						event.currentTarget.classList.add("inventory-node--dragging")
					}}
					onDragEnd={(event) => {
						event.currentTarget.classList.remove("inventory-node--dragging")
					}}
				>
					<div className="inventory-node__main">
						<div className="inventory-node__title-row">
							{hasChildren ? (
								<button
									className="inventory-node__toggle"
									type="button"
									aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${container.name}`}
									aria-expanded={String(!isCollapsed)}
									onClick={() => toggle(container.id)}
								>
									{isCollapsed ? "▸" : "▾"}
								</button>
							) : (
								<span className="inventory-node__toggle-placeholder" />
							)}
							<strong>{container.name}</strong>
						</div>
						<div className="inventory-node__meta">
							<span>{count === 1 ? "1 item" : `${count} items`}</span>
							{container.notes ? <span>{container.notes}</span> : null}
						</div>
					</div>
					<div className="inventory-node__actions">
						<a className="secondary action-link inventory-node__button" href={link(`/inventory/containers/${container.id}`)} data-link="">
							Open
						</a>
						<button className="secondary inventory-node__button" type="button" onClick={() => void deleteContainer(container)}>
							Delete
						</button>
					</div>
				</div>
				{!isCollapsed ? (
					<div className="inventory-tree__children">
						{(itemsByContainer.get(container.id)?.length ?? 0) > 0 ? (
							<ul className="inventory-tree__items">
								{(itemsByContainer.get(container.id) ?? []).map((item) => (
									<li key={item.id} className="inventory-tree__leaf">
										<InventoryItemNode
											item={item}
											link={link}
											showConsumeAction={item.consumed_at === null}
											onConsume={(it) => {
												setConsumeDate(toDateTimeLocalValue())
												setConsumeItem(it)
											}}
										/>
									</li>
								))}
							</ul>
						) : null}
						{childContainers.length > 0 ? (
							<ul className="inventory-tree__containers">{childContainers.map(renderContainer)}</ul>
						) : null}
					</div>
				) : null}
			</li>
		)
	}

	const topLevel = children.get(null) ?? []
	const unplaced = itemsByContainer.get(null) ?? []
	const hasRootContent = unplaced.length > 0 || topLevel.length > 0

	return (
		<>
			<section className="inventory-page">
				<div
					id="inventory-tree-root"
					onDragOver={onTreeDragOver}
					onDrop={onTreeDrop}
					onDragEnd={() => dropHighlight.clear()}
				>
					<div className="inventory-root inventory-drop-target" data-drop-kind="root" data-drop-id="">
						<div className="inventory-tree__toolbar">
							<Status message={loading ? "Loading…" : (error ?? status) || `${items.length} ${modeLabel(mode)} item(s).`} error={!!error || statusError} />
							<select id="inventory-item-mode" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
								<option value="active">Active</option>
								<option value="consumed">Consumed</option>
								<option value="all">All</option>
							</select>
							<button className="primary inventory-node__button" type="button" onClick={() => setContainerOpen(true)}>
								Add Container
							</button>
						</div>
						{!loading && !error ? (
							<div className="inventory-tree__root-content">
								{items.length === 0 ? <div className="inventory-tree__empty">{emptyMessage(mode)}</div> : null}
								{unplaced.length > 0 ? (
									<ul className="inventory-tree__items">
										{unplaced.map((item) => (
											<li key={item.id} className="inventory-tree__leaf">
												<InventoryItemNode
													item={item}
													link={link}
													showConsumeAction={item.consumed_at === null}
													onConsume={(it) => {
														setConsumeDate(toDateTimeLocalValue())
														setConsumeItem(it)
													}}
												/>
											</li>
										))}
									</ul>
								) : null}
								{topLevel.length > 0 ? (
									<ul className="inventory-tree__containers inventory-tree__containers--root">
										{topLevel.map(renderContainer)}
									</ul>
								) : null}
								{!hasRootContent && items.length > 0 ? (
									<div className="inventory-tree__empty">{emptyMessage(mode)}</div>
								) : null}
							</div>
						) : null}
					</div>
				</div>
			</section>
			<Modal id="inventory-container-modal" title="Add Container" open={containerOpen} onClose={() => setContainerOpen(false)} className="inventory-container-modal">
				<form id="inventory-container-modal-form" onSubmit={createContainer}>
					<label>
						Name
						<input id="inventory-container-name" name="name" placeholder="Room X" required value={containerName} onChange={(e) => setContainerName(e.target.value)} />
					</label>
					<label>
						Notes
						<input id="inventory-container-notes" name="notes" placeholder="Pantry shelf or freezer drawer" value={containerNotes} onChange={(e) => setContainerNotes(e.target.value)} />
					</label>
					<div className="actions">
						<button className="primary" type="submit">
							Add Container
						</button>
					</div>
				</form>
			</Modal>
			<Modal id="inventory-consume-modal" title="Consume Item" open={consumeItem !== null} onClose={() => setConsumeItem(null)} className="inventory-container-modal">
				<form id="inventory-consume-form" onSubmit={consume}>
					<div id="inventory-consume-item-name" className="inventory-consume-target">
						{consumeItem?.name}
					</div>
					<label>
						Consumed At
						<input
							id="inventory-consume-date"
							name="consumed_at"
							type="datetime-local"
							value={consumeDate}
							onChange={(e) => setConsumeDate(e.target.value)}
						/>
					</label>
					<div className="actions">
						<button className="primary" type="submit">
							Consume
						</button>
						<button className="secondary" type="button" onClick={() => setConsumeItem(null)}>
							Cancel
						</button>
					</div>
				</form>
			</Modal>
		</>
	)
}
