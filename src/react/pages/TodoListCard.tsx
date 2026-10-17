import { TodoListRole } from "../../todo-list-role"
import { memo, useState } from "react"
import { Status, TodoStatus, formatReceiptDateTime, type Todo } from "../lib"
import type { TodoList } from "./todo-list-data"

const collapsedListsStorageKey = "pupler:todo-lists:collapsed"
const readCollapsedLists = (): Record<number, boolean> => {
	try {
		const saved: unknown = JSON.parse(window.localStorage.getItem(collapsedListsStorageKey) ?? "{}")
		if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {}
		return Object.fromEntries(Object.entries(saved).filter(([id, value]) => /^[1-9]\d*$/.test(id) && typeof value === "boolean"))
	} catch {
		return {}
	}
}

type Props = {
	list: TodoList
	items: Todo[]
	showDone: boolean
	onAdd: (listId: number, values: { title: string }) => Promise<void>
	onUpdate: (item: Todo, status: number) => Promise<void>
	onHide: (list: TodoList, hidden: boolean) => Promise<void>
	onRemove: (list: TodoList) => Promise<void>
	onRename: (list: TodoList, trigger: HTMLElement | null) => void
	onShare: (listId: number, trigger: HTMLButtonElement) => void
	onAddDetails: (list: TodoList) => void
}

export const TodoListCard = memo(function TodoListCard({ list, items, showDone, onAdd, onUpdate, onHide, onRemove, onRename, onShare, onAddDetails }: Props) {
	const [collapsed, setCollapsed] = useState(() => readCollapsedLists()[list.id] ?? false)
	const [editing, setEditing] = useState(false)
	const [showArchived, setShowArchived] = useState(false)
	const [newTitle, setNewTitle] = useState("")
	const [addingPending, setAddingPending] = useState(false)
	const [visibilityPending, setVisibilityPending] = useState(false)
	const [pendingItems, setPendingItems] = useState<Record<number, boolean>>({})
	const [status, setStatus] = useState("")
	const activeItems = items.filter((item) => item.status !== TodoStatus.Archived)
	const openItems = activeItems.filter((item) => item.status === TodoStatus.Open)
	const visibleItems = showDone ? [...openItems, ...activeItems.filter((item) => item.status === TodoStatus.Done)] : openItems
	const archivedItems = items.filter((item) => item.status === TodoStatus.Archived)
	const done = activeItems.filter((item) => item.status === TodoStatus.Done).length
	const canEdit = list.role === TodoListRole.Editor

	const toggleCollapsed = (value: boolean) => {
		setCollapsed(value)
		try {
			window.localStorage.setItem(collapsedListsStorageKey, JSON.stringify({ ...readCollapsedLists(), [list.id]: value }))
		} catch {
			// The card still works when browser storage is unavailable.
		}
	}

	const addToCard = async (event: React.FormEvent) => {
		event.preventDefault()
		if (!canEdit || addingPending || !newTitle.trim()) return
		setAddingPending(true)
		setStatus("")
		try {
			await onAdd(list.id, { title: newTitle.trim() })
			setNewTitle("")
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to add todo")
		} finally {
			setAddingPending(false)
		}
	}

	const updateItem = async (item: Todo, status: number) => {
		if (pendingItems[item.id]) return
		setPendingItems((current) => ({ ...current, [item.id]: true }))
		setStatus("")
		try {
			await onUpdate(item, status)
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to update todo")
		} finally {
			setPendingItems((current) => ({ ...current, [item.id]: false }))
		}
	}

	const hideList = async () => {
		setVisibilityPending(true)
		setStatus("")
		try {
			await onHide(list, !list.hidden)
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to update list visibility")
		} finally {
			setVisibilityPending(false)
		}
	}

	return <article className="shoppinglist-board-card">
		<div className="shoppinglist-board-card__header">
			<h2><button className="shoppinglist-board-card__title" type="button" aria-expanded={!collapsed} aria-controls={`todo-list-${list.id}-content`} onClick={() => toggleCollapsed(!collapsed)}><span className="shoppinglist-board-card__chevron" aria-hidden="true">▾</span>{list.name}</button></h2>
			<div className="shoppinglist-board-card__actions">
				<button type="button" aria-label={`Share ${list.name}`} title={`Share ${list.name}`} onClick={(event) => onShare(list.id, event.currentTarget)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.3 10.8 7.4-4.5m-7.4 6.9 7.4 4.5"/></svg></button>
				<details className="shoppinglist-board-card__menu"><summary aria-label={`More options for ${list.name}`} title="More options">⋯</summary><div onClick={(event) => { if ((event.target as HTMLElement).closest("button")) event.currentTarget.closest("details")!.open = false }}>
					{canEdit ? <button type="button" onClick={(event) => onRename(list, event.currentTarget.closest("details")?.querySelector("summary") ?? null)}>Rename list</button> : null}
					<button type="button" disabled={visibilityPending} onClick={() => void hideList()}>{list.hidden ? "Show list" : "Hide list"}</button>
					{canEdit ? <button type="button" onClick={() => { toggleCollapsed(false); setEditing((current) => !current) }}>{editing ? "Done editing" : "Archive todos"}</button> : null}
					<button type="button" onClick={() => { toggleCollapsed(false); setShowArchived((current) => !current) }}>{showArchived ? "Hide" : "Show"} archived todos ({archivedItems.length})</button>
					{canEdit ? <button type="button" onClick={() => onAddDetails(list)}>Add with details</button> : null}
					{canEdit ? <button className="shoppinglist-board-card__delete" type="button" onClick={() => void onRemove(list)}>Remove list</button> : null}
				</div></details>
			</div>
		</div>
		<Status message={status} error />
		<div id={`todo-list-${list.id}-content`} className="shoppinglist-board-card__content" hidden={collapsed}>
		<p className="shoppinglist-board-card__progress">{list.hidden ? "Hidden · " : ""}{canEdit ? "" : "Viewer · "}{done} of {activeItems.length} done{activeItems.length > 0 && done === activeItems.length ? " · All done" : ""}</p>
		{visibleItems.length ? <ul className="shoppinglist-board-card__items">{visibleItems.map((item) => <li key={item.id} className={item.status === TodoStatus.Done ? "shoppinglist-board-card__item shoppinglist-board-card__item--done" : "shoppinglist-board-card__item"}>
			<input type="checkbox" checked={item.status === TodoStatus.Done} disabled={!canEdit || pendingItems[item.id]} aria-label={`Mark ${item.title} done in ${list.name}`} onChange={(event) => void updateItem(item, event.target.checked ? TodoStatus.Done : TodoStatus.Open)} />
			<span>{item.title}{item.notes ? <small className="todo-card__detail">{item.notes}</small> : null}{item.due_at ? <small className="todo-card__detail">Due {formatReceiptDateTime(item.due_at)}</small> : null}</span>
			{canEdit && editing ? <button className="shoppinglist-board-card__remove" type="button" disabled={pendingItems[item.id]} aria-label={`Archive ${item.title} from ${list.name}`} title="Archive todo" onClick={() => void updateItem(item, TodoStatus.Archived)}>×</button> : null}
		</li>)}</ul> : <p className="shoppinglist-board-card__empty">{activeItems.length ? "All todos done." : "No todos yet."}</p>}
		{canEdit ? <form className="shoppinglist-board-card__add" onSubmit={(event) => void addToCard(event)}>
			<input aria-label={`Add todo to ${list.name}`} placeholder="Add a todo" autoComplete="off" required readOnly={addingPending} value={newTitle} onChange={(event) => setNewTitle(event.target.value)} />
			<button type="submit" disabled={addingPending} aria-label={`Add todo to ${list.name}`} title="Add todo">+</button>
		</form> : null}
		{showArchived ? <div className="shoppinglist-board-card__removed"><h3>Archived todos</h3>{archivedItems.length ? <ul>{archivedItems.map((item) => <li key={item.id}><span>{item.title}</span>{canEdit ? <button type="button" className="secondary" disabled={pendingItems[item.id]} onClick={() => void updateItem(item, TodoStatus.Open)}>Restore</button> : null}</li>)}</ul> : <p>No archived todos.</p>}</div> : null}
		</div>
	</article>
})
