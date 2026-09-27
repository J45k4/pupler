import { useEffect, useRef, useState } from "react"
import { apiFetch } from "../api"
import { useAuth } from "../auth"
import { Combobox } from "../Combobox"
import { Empty, Status, useApi, type ShoppingListItem } from "../lib"

type ShoppingList = { id: number; name: string; role: "viewer" | "editor" }
type ListMember = { user_id: number; role: "viewer" | "editor"; user: { name: string; username: string | null } }
type ShoppingListDetail = { id: number; name: string; members: ListMember[] }
type ShareCandidate = { id: number; name: string; username: string }
type ShareCandidates = { list_id: number; users: ShareCandidate[] }
const candidateLabel = (candidate: ShareCandidate) => `${candidate.name} (@${candidate.username})`
const collapsedListsStorageKey = "pupler:shopping-lists:collapsed"

const readCollapsedLists = () => {
	try {
		const saved: unknown = JSON.parse(window.localStorage.getItem(collapsedListsStorageKey) ?? "{}")
		if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {}
		const collapsed: Record<number, boolean> = {}
		for (const [id, value] of Object.entries(saved)) {
			if (/^[1-9]\d*$/.test(id) && typeof value === "boolean") collapsed[Number(id)] = value
		}
		return collapsed
	} catch {
		return {}
	}
}

export const ShoppingListsPage = ({ link }: { link: (path: string) => string }) => {
	const { user } = useAuth()
	const shareDialogRef = useRef<HTMLDialogElement>(null)
	const shareTriggerRef = useRef<HTMLButtonElement>(null)
	const [creatingList, setCreatingList] = useState(false)
	const [showBought, setShowBought] = useState(false)
	const [listName, setListName] = useState("")
	const [cardNames, setCardNames] = useState<Record<number, string>>({})
	const [sharingId, setSharingId] = useState<number | null>(null)
	const [showRemoved, setShowRemoved] = useState<Record<number, boolean>>({})
	const [collapsedLists, setCollapsedLists] = useState<Record<number, boolean>>(readCollapsedLists)
	const [editingItems, setEditingItems] = useState<Record<number, boolean>>({})
	const [deletedListIds, setDeletedListIds] = useState<number[]>([])
	const [doneOverrides, setDoneOverrides] = useState<Record<number, boolean>>({})
	const [recipientLabel, setRecipientLabel] = useState("")
	const [shareRole, setShareRole] = useState<"viewer" | "editor">("editor")
	const [status, setStatus] = useState("")
	const [statusError, setStatusError] = useState(false)

	const { data: listsData, loading: listsLoading, error: listsError, reload: reloadLists } = useApi<ShoppingList[]>("/api/shopping-lists")
	const { data, loading, error, reload } = useApi<ShoppingListItem[]>("/api/shopping-list-items?removed=all")
	const { data: detail, loading: detailLoading, error: detailError, reload: reloadDetail } = useApi<ShoppingListDetail>(sharingId === null ? null : `/api/shopping-lists/${sharingId}`)
	const lists = (listsData ?? []).filter((list) => !deletedListIds.includes(list.id))
	const sharingList = lists.find((list) => list.id === sharingId) ?? null
	const { data: candidates, loading: candidatesLoading, error: candidatesError, reload: reloadCandidates } = useApi<ShareCandidates>(sharingList?.role === "editor" ? `/api/shopping-lists/${sharingList.id}/members` : null)
	const availableUsers = candidates?.list_id === sharingId ? candidates.users : []
	const recipient = availableUsers.find((candidate) => candidateLabel(candidate) === recipientLabel)

	useEffect(() => {
		const dialog = shareDialogRef.current
		if (!dialog) return
		if (sharingId !== null && !dialog.open) {
			dialog.showModal()
			dialog.querySelector<HTMLButtonElement>(".shoppinglist-share-modal__close")?.focus()
		} else if (sharingId === null && dialog.open) dialog.close()
	}, [sharingId])

	useEffect(() => {
		try {
			window.localStorage.setItem(collapsedListsStorageKey, JSON.stringify(collapsedLists))
		} catch {
			// The page still works when browser storage is unavailable.
		}
	}, [collapsedLists])

	useEffect(() => {
		const closeMenus = (event: PointerEvent) => {
			if (!(event.target instanceof Node)) return
			for (const menu of document.querySelectorAll<HTMLDetailsElement>(".shoppinglist-board-card__menu[open]")) {
				if (!menu.contains(event.target)) menu.open = false
			}
		}
		const closeMenusOnEscape = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return
			for (const menu of document.querySelectorAll<HTMLDetailsElement>(".shoppinglist-board-card__menu[open]")) {
				menu.open = false
				menu.querySelector("summary")?.focus()
			}
		}
		document.addEventListener("pointerdown", closeMenus)
		document.addEventListener("keydown", closeMenusOnEscape)
		return () => {
			document.removeEventListener("pointerdown", closeMenus)
			document.removeEventListener("keydown", closeMenusOnEscape)
		}
	}, [])

	useEffect(() => {
		if (!data) return
		setDoneOverrides((current) => {
			const next = { ...current }
			let changed = false
			for (const item of data) {
				if (next[item.id] === item.done) {
					delete next[item.id]
					changed = true
				}
			}
			return changed ? next : current
		})
	}, [data])

	const createList = async (event: React.FormEvent) => {
		event.preventDefault()
		try {
			const created = await apiFetch<ShoppingList>("/api/shopping-lists", { method: "POST", body: JSON.stringify({ name: listName.trim() }) })
			setListName("")
			setCreatingList(false)
			setStatus(`Created ${created.name}.`)
			setStatusError(false)
			reloadLists()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to create list")
			setStatusError(true)
		}
	}

	const addToCard = async (event: React.FormEvent, list: ShoppingList) => {
		event.preventDefault()
		if (list.role !== "editor") return
		const name = (cardNames[list.id] ?? "").trim()
		if (!name) return
		try {
			await apiFetch("/api/shopping-list-items", { method: "POST", body: JSON.stringify({ shopping_list_id: list.id, name, quantity: 1, unit: "pcs", done: false }) })
			setCardNames((current) => ({ ...current, [list.id]: "" }))
			setStatus(`Added ${name} to ${list.name}.`)
			setStatusError(false)
			reload()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to add item")
			setStatusError(true)
		}
	}

	const updateItem = async (item: ShoppingListItem, values: { done: boolean } | { removed: boolean }) => {
		if ("done" in values) setDoneOverrides((current) => ({ ...current, [item.id]: values.done }))
		try {
			await apiFetch(`/api/shopping-list-items/${item.id}`, { method: "PATCH", body: JSON.stringify(values) })
			setStatus("")
			setStatusError(false)
			reload()
		} catch (err) {
			if ("done" in values) setDoneOverrides((current) => {
				const next = { ...current }
				delete next[item.id]
				return next
			})
			setStatus(err instanceof Error ? err.message : "Failed to update item")
			setStatusError(true)
		}
	}

	const share = async (event: React.FormEvent, list: ShoppingList) => {
		event.preventDefault()
		if (list.role !== "editor" || !recipient) return
		try {
			await apiFetch(`/api/shopping-lists/${list.id}/members`, { method: "POST", body: JSON.stringify({ username: recipient.username, role: shareRole }) })
			setStatus(`Shared ${list.name} with ${recipient.name}.`)
			setStatusError(false)
			setRecipientLabel("")
			reloadDetail()
			reloadCandidates()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to share list")
			setStatusError(true)
		}
	}

	const changeAccess = async (listId: number, member: ListMember, role: "viewer" | "editor" | null) => {
		try {
			await apiFetch(`/api/shopping-lists/${listId}/members/${member.user_id}`, { method: role === null ? "DELETE" : "PATCH", ...(role === null ? {} : { body: JSON.stringify({ role }) }) })
			setStatus(role === null ? "Access removed." : "Access updated.")
			setStatusError(false)
			reloadDetail()
			if (role === null) reloadCandidates()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to update access")
			setStatusError(true)
		}
	}

	const removeList = async (list: ShoppingList) => {
		if (list.role !== "editor" || !window.confirm(`Remove "${list.name}" and all its items? Everyone with access will lose this list.`)) return
		try {
			await apiFetch(`/api/shopping-lists/${list.id}`, { method: "DELETE" })
			setDeletedListIds((current) => [...current, list.id])
			setCollapsedLists((current) => {
				const next = { ...current }
				delete next[list.id]
				return next
			})
			if (sharingId === list.id) setSharingId(null)
			setStatus(`Removed ${list.name}.`)
			setStatusError(false)
			reloadLists()
			reload()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to remove list")
			setStatusError(true)
		}
	}

	return <section className="shoppinglist-page shoppinglist-page--board">
		<header className="shoppinglist-page__header">
			<p>{listsLoading ? "Loading lists…" : `${lists.length} ${lists.length === 1 ? "list" : "lists"}`}</p>
			<div className="shoppinglist-page__controls">
				<label className="shoppinglist-page__filter"><input type="checkbox" checked={showBought} onChange={(event) => setShowBought(event.target.checked)} />Show bought</label>
				<button className="primary shoppinglist-page__new" type="button" onClick={() => setCreatingList((current) => !current)}>+ New list</button>
			</div>
		</header>
		{creatingList ? <form className="shoppinglist-page__new-form" onSubmit={createList}>
			<input aria-label="New list name" placeholder="List name" value={listName} onChange={(event) => setListName(event.target.value)} required autoFocus />
			<button className="primary" type="submit">Create list</button>
			<button className="secondary" type="button" onClick={() => setCreatingList(false)}>Cancel</button>
		</form> : null}
		{listsError || error || (sharingId === null && status) ? <Status message={listsError ?? error ?? status} error={!!listsError || !!error || statusError} /> : null}
		<div className="shoppinglist-board">
			{!loading && !listsLoading && !error && lists.length === 0 ? <Empty message="Create a list to get started." /> : null}
			{data !== null ? lists.map((list) => {
				const listItems = data.filter((item) => item.shopping_list_id === list.id).map((item) => ({ ...item, done: doneOverrides[item.id] ?? item.done }))
				const activeItems = listItems.filter((item) => !item.removed_at)
				const uncheckedItems = activeItems.filter((item) => !item.done)
				const visibleItems = showBought ? [...uncheckedItems, ...activeItems.filter((item) => item.done)] : uncheckedItems
				const removedItems = listItems.filter((item) => !!item.removed_at)
				const bought = activeItems.filter((item) => item.done).length
				const canEdit = list.role === "editor"
				return <article key={list.id} className="shoppinglist-board-card">
					<div className="shoppinglist-board-card__header">
						<h2><button className="shoppinglist-board-card__title" type="button" aria-expanded={!collapsedLists[list.id]} aria-controls={`shopping-list-${list.id}-content`} onClick={() => setCollapsedLists((current) => ({ ...current, [list.id]: !current[list.id] }))}><span className="shoppinglist-board-card__chevron" aria-hidden="true">▾</span>{list.name}</button></h2>
						<div className="shoppinglist-board-card__actions">
							<button type="button" aria-label={`Share ${list.name}`} title={`Share ${list.name}`} onClick={(event) => { shareTriggerRef.current = event.currentTarget; setSharingId(list.id); setRecipientLabel(""); setStatus("") }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.3 10.8 7.4-4.5m-7.4 6.9 7.4 4.5"/></svg></button>
							<details className="shoppinglist-board-card__menu"><summary aria-label={`More options for ${list.name}`} title="More options">⋯</summary><div onClick={(event) => { if ((event.target as HTMLElement).closest("button")) event.currentTarget.closest("details")!.open = false }}>
								{canEdit ? <button type="button" onClick={() => { setCollapsedLists((current) => ({ ...current, [list.id]: false })); setEditingItems((current) => ({ ...current, [list.id]: !current[list.id] })) }}>{editingItems[list.id] ? "Done editing" : "Remove items"}</button> : null}
								<button type="button" onClick={() => { setCollapsedLists((current) => ({ ...current, [list.id]: false })); setShowRemoved((current) => ({ ...current, [list.id]: !current[list.id] })) }}>{showRemoved[list.id] ? "Hide" : "Show"} removed items ({removedItems.length})</button>
								{canEdit ? <button className="shoppinglist-board-card__delete" type="button" onClick={() => void removeList(list)}>Remove list</button> : null}
							</div></details>
						</div>
					</div>
					<div id={`shopping-list-${list.id}-content`} className="shoppinglist-board-card__content" hidden={!!collapsedLists[list.id]}>
					<p className="shoppinglist-board-card__progress">{canEdit ? "" : "Viewer · "}{bought} of {activeItems.length} bought{activeItems.length > 0 && bought === activeItems.length ? " · All bought" : ""}</p>
					{visibleItems.length ? <ul className="shoppinglist-board-card__items">{visibleItems.map((item) => <li key={item.id} className={item.done ? "shoppinglist-board-card__item shoppinglist-board-card__item--done" : "shoppinglist-board-card__item"}>
						<input type="checkbox" checked={item.done} disabled={!canEdit} aria-label={`Mark ${item.name} bought in ${list.name}`} onChange={(event) => void updateItem(item, { done: event.target.checked })} />
						<span>{item.name}{item.product ? <a href={link(`/products/${item.product.id}`)} data-link="">Product: {item.product.name}</a> : null}</span>
						{canEdit && editingItems[list.id] ? <button className="shoppinglist-board-card__remove" type="button" aria-label={`Remove ${item.name} from ${list.name}`} title="Remove item" onClick={() => void updateItem(item, { removed: true })}>×</button> : null}
					</li>)}</ul> : <p className="shoppinglist-board-card__empty">{activeItems.length ? "All items bought." : "No items yet."}</p>}
					{canEdit ? <form className="shoppinglist-board-card__add" onSubmit={(event) => void addToCard(event, list)}>
						<input aria-label={`Add item to ${list.name}`} placeholder="Add an item" autoComplete="off" required value={cardNames[list.id] ?? ""} onChange={(event) => setCardNames((current) => ({ ...current, [list.id]: event.target.value }))} />
						<button type="submit" aria-label={`Add item to ${list.name}`} title="Add item">+</button>
					</form> : null}
					{showRemoved[list.id] ? <div className="shoppinglist-board-card__removed"><h3>Removed items</h3>{removedItems.length ? <ul>{removedItems.map((item) => <li key={item.id}><span>{item.name}</span>{canEdit ? <button type="button" className="secondary" onClick={() => void updateItem(item, { removed: false })}>Restore</button> : null}</li>)}</ul> : <p>No removed items.</p>}</div> : null}
					</div>
				</article>
			}) : null}
		</div>
		<dialog ref={shareDialogRef} className="shoppinglist-share-modal" aria-labelledby="shoppinglist-share-title" onClose={() => { setSharingId(null); shareTriggerRef.current?.focus() }} onClick={(event) => {
			if (event.target !== event.currentTarget) return
			const rect = event.currentTarget.getBoundingClientRect()
			if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setSharingId(null)
		}}>
			{sharingList ? <>
				<div className="shoppinglist-share-modal__header"><div><h2 id="shoppinglist-share-title">Share {sharingList.name}</h2><p>People with access</p></div><button className="shoppinglist-share-modal__close" type="button" aria-label="Close sharing" onClick={() => setSharingId(null)}>×</button></div>
				{sharingList.role === "editor" ? <form className="shoppinglist-share-form" onSubmit={(event) => void share(event, sharingList)}>
					<div className="shoppinglist-share-form__user"><label htmlFor="shoppinglist-share-user">Person</label><Combobox id="shoppinglist-share-user" placeholder={candidatesLoading ? "Loading people…" : "Search people"} options={availableUsers.map((candidate) => ({ value: String(candidate.id), label: candidateLabel(candidate) }))} value={recipientLabel} onChange={setRecipientLabel} /></div>
					<select aria-label="Access role" value={shareRole} onChange={(event) => setShareRole(event.target.value as "viewer" | "editor")}><option value="editor">Editor</option><option value="viewer">Viewer</option></select>
					<button className="secondary" type="submit" disabled={!recipient}>Give access</button>
				</form> : null}
				{status ? <Status message={status} error={statusError} /> : null}
				{candidatesError ? <Status message={candidatesError} error /> : null}
				{detailError ? <Status message={detailError} error /> : null}
				{detailLoading ? <p className="section-copy">Loading people…</p> : null}
				<div className="shoppinglist-members">{(detail?.id === sharingList.id ? detail.members : []).map((member) => <div key={member.user_id} className="shoppinglist-member">
					<span>{member.user.name} {member.user.username ? `(@${member.user.username})` : ""}</span>
					{sharingList.role === "editor" && member.user_id !== user?.id ? <><select aria-label={`Access for ${member.user.name}`} value={member.role} onChange={(event) => void changeAccess(sharingList.id, member, event.target.value as "viewer" | "editor")}><option value="editor">Editor</option><option value="viewer">Viewer</option></select><button className="secondary" type="button" onClick={() => void changeAccess(sharingList.id, member, null)}>Remove</button></> : <span className="section-copy">{member.role}</span>}
				</div>)}</div>
			</> : null}
		</dialog>
	</section>
}
