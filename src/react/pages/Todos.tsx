import { DateInput } from "../DateInput"
import { TodoListRole } from "../../todo-list-role"
import { useCallback, useEffect, useRef, useState } from "react"
import { apiFetch } from "../api"
import { useAuth } from "../auth"
import { Combobox } from "../Combobox"
import { Empty, Modal, Status, TodoStatus, useApi, type Todo } from "../lib"
import { TodoListCard } from "./TodoListCard"
import { groupTodos, removeTodoGroup, replaceTodo, upsertTodo, type TodoGroups, type TodoList } from "./todo-list-data"

type ListMember = { user_id: number; role: TodoListRole; user: { name: string; username: string | null } }
type TodoListDetail = { id: number; name: string; members: ListMember[] }
type ShareCandidate = { id: number; name: string; username: string }
type ShareCandidates = { list_id: number; users: ShareCandidate[] }
const candidateLabel = (candidate: ShareCandidate) => `${candidate.name} (@${candidate.username})`
const emptyTodos: Todo[] = []

export const TodosPage = () => {
	const { user } = useAuth()
	const shareDialogRef = useRef<HTMLDialogElement>(null)
	const shareTriggerRef = useRef<HTMLButtonElement>(null)
	const renameTriggerRef = useRef<HTMLElement | null>(null)
	const [lists, setLists] = useState<TodoList[]>([])
	const [todos, setTodos] = useState<TodoGroups>({})
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState("")
	const [renamingList, setRenamingList] = useState<TodoList | null>(null)
	const [renameName, setRenameName] = useState("")
	const [renameStatus, setRenameStatus] = useState("")
	const [renamePending, setRenamePending] = useState(false)
	const [creatingList, setCreatingList] = useState(false)
	const [creatingPending, setCreatingPending] = useState(false)
	const [showDone, setShowDone] = useState(false)
	const [showHidden, setShowHidden] = useState(false)
	const [listName, setListName] = useState("")
	const [sharingId, setSharingId] = useState<number | null>(null)
	const [addingTo, setAddingTo] = useState<TodoList | null>(null)
	const [detailsPending, setDetailsPending] = useState(false)
	const [title, setTitle] = useState("")
	const [notes, setNotes] = useState("")
	const [dueAt, setDueAt] = useState("")
	const [modalStatus, setModalStatus] = useState("")
	const [recipientLabel, setRecipientLabel] = useState("")
	const [shareRole, setShareRole] = useState<TodoListRole>(TodoListRole.Editor)
	const [status, setStatus] = useState("")
	const [statusError, setStatusError] = useState(false)
	const visibleLists = lists.filter((list) => showHidden || !list.hidden)
	const hiddenCount = lists.filter((list) => list.hidden).length
	const sharingList = lists.find((list) => list.id === sharingId) ?? null
	const { data: detail, loading: detailLoading, error: detailError, reload: reloadDetail } = useApi<TodoListDetail>(sharingId === null ? null : `/api/todo-lists/${sharingId}`)
	const { data: candidates, loading: candidatesLoading, error: candidatesError, reload: reloadCandidates } = useApi<ShareCandidates>(sharingList?.role === TodoListRole.Editor ? `/api/todo-lists/${sharingList.id}/members` : null)
	const availableUsers = candidates?.list_id === sharingId ? candidates.users : []
	const recipient = availableUsers.find((candidate) => candidateLabel(candidate) === recipientLabel)

	useEffect(() => {
		let cancelled = false
		Promise.all([apiFetch<TodoList[]>("/api/todo-lists"), apiFetch<Todo[]>("/api/todos?sort=created_at&order=desc")])
			.then(([lists, todos]) => {
				if (cancelled) return
				setLists(lists)
				setTodos(groupTodos(todos))
			})
			.catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load todos") })
			.finally(() => { if (!cancelled) setLoading(false) })
		return () => { cancelled = true }
	}, [])

	useEffect(() => {
		const dialog = shareDialogRef.current
		if (!dialog) return
		if (sharingId !== null && !dialog.open) {
			dialog.showModal()
			dialog.querySelector<HTMLButtonElement>(".shoppinglist-share-modal__close")?.focus()
		} else if (sharingId === null && dialog.open) dialog.close()
	}, [sharingId])

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

	const createList = async (event: React.FormEvent) => {
		event.preventDefault()
		if (creatingPending) return
		setCreatingPending(true)
		try {
			const created = await apiFetch<TodoList>("/api/todo-lists", { method: "POST", body: JSON.stringify({ name: listName.trim() }) })
			setLists((current) => [...current, created])
			setListName("")
			setCreatingList(false)
			setStatus(`Created ${created.name}.`)
			setStatusError(false)
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to create list")
			setStatusError(true)
		} finally {
			setCreatingPending(false)
		}
	}

	const closeRename = () => {
		if (renamePending) return
		setRenamingList(null)
		renameTriggerRef.current?.focus()
	}

	const renameList = async (event: React.FormEvent) => {
		event.preventDefault()
		if (!renamingList || renamePending) return
		const name = renameName.trim()
		if (!name) { setRenameStatus("List name is required"); return }
		setRenamePending(true)
		setRenameStatus("")
		try {
			await apiFetch(`/api/todo-lists/${renamingList.id}`, { method: "PATCH", body: JSON.stringify({ name }) })
			setStatus(`Renamed list to ${name}.`)
			setStatusError(false)
			setRenamingList(null)
			renameTriggerRef.current?.focus()
			setLists((current) => current.map((list) => list.id === renamingList.id ? { ...list, name } : list))
		} catch (err) {
			setRenameStatus(err instanceof Error ? err.message : "Failed to rename list")
		} finally {
			setRenamePending(false)
		}
	}

	const addTodo = useCallback(async (listId: number, values: { title: string; notes?: string | null; due_at?: string | null }) => {
		const created = await apiFetch<Todo>("/api/todos", { method: "POST", body: JSON.stringify({ todo_list_id: listId, ...values }) })
		setTodos((current) => upsertTodo(current, created))
	}, [])

	const updateTodo = useCallback(async (item: Todo, status: number) => {
		const values = { status, ...(status === TodoStatus.Archived ? {} : { completed_at: status === TodoStatus.Done ? new Date().toISOString() : null }) }
		const optimistic = { ...item, ...values }
		setTodos((current) => replaceTodo(current, optimistic))
		try {
			const saved = await apiFetch<Todo>(`/api/todos/${item.id}`, { method: "PATCH", body: JSON.stringify(values) })
			setTodos((current) => replaceTodo(current, saved))
		} catch (err) {
			setTodos((current) => replaceTodo(current, item))
			throw err
		}
	}, [])

	const setListHidden = useCallback(async (list: TodoList, hidden: boolean) => {
		await apiFetch(`/api/todo-lists/${list.id}`, { method: "PATCH", body: JSON.stringify({ hidden }) })
		setLists((current) => current.map((entry) => entry.id === list.id ? { ...entry, hidden } : entry))
	}, [])

	const removeList = useCallback(async (list: TodoList) => {
		if (list.role !== TodoListRole.Editor || !window.confirm(`Remove "${list.name}" and all its todos? Everyone with access will lose this list.`)) return
		try {
			await apiFetch(`/api/todo-lists/${list.id}`, { method: "DELETE" })
			setLists((current) => current.filter((entry) => entry.id !== list.id))
			setTodos((current) => removeTodoGroup(current, list.id))
			setSharingId((current) => current === list.id ? null : current)
			setStatus(`Removed ${list.name}.`)
			setStatusError(false)
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to remove list")
			setStatusError(true)
		}
	}, [])

	const openRename = useCallback((list: TodoList, trigger: HTMLElement | null) => {
		renameTriggerRef.current = trigger
		setRenamingList(list)
		setRenameName(list.name)
		setRenameStatus("")
	}, [])

	const openSharing = useCallback((listId: number, trigger: HTMLButtonElement) => {
		shareTriggerRef.current = trigger
		setSharingId(listId)
		setRecipientLabel("")
		setStatus("")
	}, [])

	const openAddDetails = useCallback((list: TodoList) => {
		setAddingTo(list)
		setTitle("")
		setNotes("")
		setDueAt("")
		setModalStatus("")
	}, [])

	const addWithDetails = async (event: React.FormEvent) => {
		event.preventDefault()
		if (!addingTo || detailsPending) return
		if (!title.trim()) { setModalStatus("Todo title is required"); return }
		setDetailsPending(true)
		setModalStatus("")
		try {
			await addTodo(addingTo.id, { title: title.trim(), notes: notes.trim() || null, due_at: dueAt ? new Date(dueAt).toISOString() : null })
			setAddingTo(null)
		} catch (err) {
			setModalStatus(err instanceof Error ? err.message : "Failed to add todo")
		} finally {
			setDetailsPending(false)
		}
	}

	const share = async (event: React.FormEvent, list: TodoList) => {
		event.preventDefault()
		if (list.role !== TodoListRole.Editor || !recipient) return
		try {
			await apiFetch(`/api/todo-lists/${list.id}/members`, { method: "POST", body: JSON.stringify({ username: recipient.username, role: shareRole }) })
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

	const changeAccess = async (listId: number, member: ListMember, role: TodoListRole | null) => {
		try {
			await apiFetch(`/api/todo-lists/${listId}/members/${member.user_id}`, { method: role === null ? "DELETE" : "PATCH", ...(role === null ? {} : { body: JSON.stringify({ role }) }) })
			setStatus(role === null ? "Access removed." : "Access updated.")
			setStatusError(false)
			reloadDetail()
			if (role === null) reloadCandidates()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to update access")
			setStatusError(true)
		}
	}

	return <section className="shoppinglist-page shoppinglist-page--board">
		<header className="shoppinglist-page__header">
			<p>{loading ? "Loading lists…" : `${visibleLists.length} ${visibleLists.length === 1 ? "list" : "lists"}`}</p>
			<div className="shoppinglist-page__controls">
				<label className="shoppinglist-page__filter"><input type="checkbox" checked={showHidden} onChange={(event) => setShowHidden(event.target.checked)} />Show hidden ({hiddenCount})</label>
				<label className="shoppinglist-page__filter"><input type="checkbox" checked={showDone} onChange={(event) => setShowDone(event.target.checked)} />Show done</label>
				<button className="primary shoppinglist-page__new" type="button" disabled={loading || !!error} onClick={() => setCreatingList((current) => !current)}>+ New list</button>
			</div>
		</header>
		{creatingList ? <form className="shoppinglist-page__new-form" onSubmit={createList}>
			<input aria-label="New list name" placeholder="List name" value={listName} onChange={(event) => setListName(event.target.value)} required autoFocus />
			<button className="primary" type="submit" disabled={creatingPending}>Create list</button>
			<button className="secondary" type="button" onClick={() => setCreatingList(false)}>Cancel</button>
		</form> : null}
		{error || (sharingId === null && status) ? <Status message={error || status} error={!!error || statusError} /> : null}
		<div className="shoppinglist-board">
			{!loading && !error && visibleLists.length === 0 ? <Empty message={hiddenCount ? "All lists are hidden. Turn on Show hidden to show them again." : "Create a list to get started."} /> : null}
			{visibleLists.map((list) => <TodoListCard key={list.id} list={list} items={todos[list.id] ?? emptyTodos} showDone={showDone} onAdd={addTodo} onUpdate={updateTodo} onHide={setListHidden} onRemove={removeList} onRename={openRename} onShare={openSharing} onAddDetails={openAddDetails} />)}
		</div>
		<dialog ref={shareDialogRef} className="shoppinglist-share-modal" aria-labelledby="todo-list-share-title" onClose={() => { setSharingId(null); shareTriggerRef.current?.focus() }} onClick={(event) => {
			if (event.target !== event.currentTarget) return
			const rect = event.currentTarget.getBoundingClientRect()
			if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setSharingId(null)
		}}>
			{sharingList ? <>
				<div className="shoppinglist-share-modal__header"><div><h2 id="todo-list-share-title">Share {sharingList.name}</h2><p>People with access</p></div><button className="shoppinglist-share-modal__close" type="button" aria-label="Close sharing" onClick={() => setSharingId(null)}>×</button></div>
				{sharingList.role === TodoListRole.Editor ? <form className="shoppinglist-share-form" onSubmit={(event) => void share(event, sharingList)}>
					<div className="shoppinglist-share-form__user"><label htmlFor="todo-list-share-user">Person</label><Combobox id="todo-list-share-user" placeholder={candidatesLoading ? "Loading people…" : "Search people"} options={availableUsers.map((candidate) => ({ value: String(candidate.id), label: candidateLabel(candidate) }))} value={recipientLabel} onChange={setRecipientLabel} /></div>
					<select aria-label="Access role" value={shareRole} onChange={(event) => setShareRole(Number(event.target.value) as TodoListRole)}><option value={TodoListRole.Editor}>Editor</option><option value={TodoListRole.Viewer}>Viewer</option></select>
					<button className="secondary" type="submit" disabled={!recipient}>Give access</button>
				</form> : null}
				{status ? <Status message={status} error={statusError} /> : null}
				{candidatesError ? <Status message={candidatesError} error /> : null}
				{detailError ? <Status message={detailError} error /> : null}
				{detailLoading ? <p className="section-copy">Loading people…</p> : null}
				<div className="shoppinglist-members">{(detail?.id === sharingList.id ? detail.members : []).map((member) => <div key={member.user_id} className="shoppinglist-member">
					<span>{member.user.name} {member.user.username ? `(@${member.user.username})` : ""}</span>
					{sharingList.role === TodoListRole.Editor && member.user_id !== user?.id ? <><select aria-label={`Access for ${member.user.name}`} value={member.role} onChange={(event) => void changeAccess(sharingList.id, member, Number(event.target.value) as TodoListRole)}><option value={TodoListRole.Editor}>Editor</option><option value={TodoListRole.Viewer}>Viewer</option></select><button className="secondary" type="button" onClick={() => void changeAccess(sharingList.id, member, null)}>Remove</button></> : <span className="section-copy">{TodoListRole[member.role]}</span>}
				</div>)}</div>
			</> : null}
		</dialog>
		<Modal id="todo-list-rename-modal" title="Rename list" open={renamingList !== null} onClose={closeRename} className="todo-create-modal">
			<form onSubmit={(event) => void renameList(event)}>
				<label>List name<input required autoComplete="off" value={renameName} disabled={renamePending} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setRenameName(event.target.value)} /></label>
				<div className="actions">
					<button className="primary" type="submit" disabled={renamePending || !renameName.trim()}>{renamePending ? "Saving…" : "Save"}</button>
					<button className="secondary" type="button" disabled={renamePending} onClick={closeRename}>Cancel</button>
				</div>
			</form>
			<Status message={renameStatus} error={!!renameStatus} />
		</Modal>
		<Modal id="todo-create-modal" title={`Add todo to ${addingTo?.name ?? "list"}`} open={addingTo !== null} onClose={() => setAddingTo(null)} className="todo-create-modal">
			<form onSubmit={(event) => void addWithDetails(event)}>
				<label>Todo<input required autoComplete="off" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
				<label>Notes<input autoComplete="off" value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
				<label>Due<DateInput type="datetime-local" value={dueAt} onChange={value => setDueAt(value)} /></label>
				<div className="actions"><button className="primary" type="submit" disabled={detailsPending}>Add todo</button></div>
			</form>
			<Status message={modalStatus} error={!!modalStatus} />
		</Modal>
	</section>
}
