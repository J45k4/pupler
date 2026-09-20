import { useMemo, useState } from "react"
import { apiFetch } from "../api"
import {
	Empty,
	Modal,
	Status,
	TodoStatus,
	formatReceiptDateTime,
	formatShoppingDate,
	useApi,
	type Todo,
} from "../lib"

const localDateTimeToIso = (value: string) =>
	value ? new Date(value).toISOString() : null

export const TodosPage = () => {
	const [showDone, setShowDone] = useState(false)
	const [showArchived, setShowArchived] = useState(false)
	const [modalOpen, setModalOpen] = useState(false)
	const [status, setStatus] = useState("")
	const [statusError, setStatusError] = useState(false)
	const [modalStatus, setModalStatus] = useState("")
	const [title, setTitle] = useState("")
	const [notes, setNotes] = useState("")
	const [dueAt, setDueAt] = useState("")
	const [pending, setPending] = useState(false)

	const { data, loading, error, reload } = useApi<Todo[]>("/api/todos?sort=created_at&order=desc")

	const todos = useMemo(
		() =>
			(data ?? []).filter((todo) => {
				if (todo.status === TodoStatus.Archived) return showArchived
				if (todo.status === TodoStatus.Done) return showDone
				return true
			}),
		[data, showDone, showArchived],
	)

	const updateTodo = async (todoId: number, payload: Partial<Todo>, doneMessage: string) => {
		try {
			await apiFetch(`/api/todos/${todoId}`, {
				method: "PATCH",
				body: JSON.stringify(payload),
			})
			setStatus(doneMessage)
			setStatusError(false)
			reload()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to update todo")
			setStatusError(true)
		}
	}

	const onSubmit = async (event: React.FormEvent) => {
		event.preventDefault()
		const trimmed = title.trim()
		if (!trimmed) {
			setModalStatus("Todo title is required")
			return
		}
		setPending(true)
		setModalStatus("")
		try {
			await apiFetch("/api/todos", {
				method: "POST",
				body: JSON.stringify({
					title: trimmed,
					notes: notes.trim() ? notes.trim() : null,
					status: TodoStatus.Open,
					due_at: localDateTimeToIso(dueAt),
					completed_at: null,
				}),
			})
			setStatus(`Added ${trimmed}.`)
			setStatusError(false)
			setTitle("")
			setNotes("")
			setDueAt("")
			setModalOpen(false)
			reload()
		} catch (err) {
			setModalStatus(err instanceof Error ? err.message : "Failed to add todo")
		} finally {
			setPending(false)
		}
	}

	return (
		<>
			<section className="workspace workspace--single">
				<div className="card panel">
					<div className="section-header">
						<h2>Todos</h2>
						<div className="todos-panel-actions">
							<label className="checkbox-toggle" htmlFor="todos-show-done">
								<input
									id="todos-show-done"
									type="checkbox"
									checked={showDone}
									onChange={(e) => setShowDone(e.target.checked)}
									aria-label="Show done todos"
								/>
								<span>Show done</span>
							</label>
							<label className="checkbox-toggle" htmlFor="todos-show-archived">
								<input
									id="todos-show-archived"
									type="checkbox"
									checked={showArchived}
									onChange={(e) => setShowArchived(e.target.checked)}
									aria-label="Show archived todos"
								/>
								<span>Show archived</span>
							</label>
							<button
								id="open-todo-modal-button"
								className="primary"
								type="button"
								onClick={() => {
									setModalStatus("")
									setModalOpen(true)
								}}
							>
								Add
							</button>
						</div>
					</div>
					<Status message={loading ? "Loading todos…" : error ?? status} error={!!error || statusError} />
					{!loading && !error ? (
						todos.length === 0 ? (
							<Empty message="No todos yet." />
						) : (
							<table className="shoppinglist-table shoppinglist-table--todos">
								<thead>
									<tr>
										<th>Done</th>
										<th>Todo</th>
										<th>Due</th>
										<th>Actions</th>
									</tr>
								</thead>
								<tbody>
									{todos.map((todo) => {
										const isDone = todo.status === TodoStatus.Done
										const isArchived = todo.status === TodoStatus.Archived
										return (
											<tr
												key={todo.id}
												className={
													isDone || isArchived
														? "shoppinglist-table__row shoppinglist-table__row--done"
														: "shoppinglist-table__row"
												}
											>
												<td className="shoppinglist-table__check">
													<input
														type="checkbox"
														checked={isDone}
														disabled={isArchived}
														aria-label={`Mark ${todo.title} done`}
														onChange={(e) =>
															void updateTodo(
																todo.id,
																{
																	status: e.target.checked ? TodoStatus.Done : TodoStatus.Open,
																	completed_at: e.target.checked ? new Date().toISOString() : null,
																},
																"Todo updated.",
															)
														}
													/>
												</td>
												<td>
													<div className="shoppinglist-product__name">{todo.title}</div>
													{todo.notes ? <div className="section-copy">{todo.notes}</div> : null}
													<div className="section-copy">
														{isArchived ? "Archived" : isDone ? "Done" : "Open"} · Added{" "}
														{formatShoppingDate(todo.created_at)}
													</div>
												</td>
												<td className="shoppinglist-table__date">
													{todo.due_at ? formatReceiptDateTime(todo.due_at) : "-"}
												</td>
												<td>
													<button
														className="secondary"
														type="button"
														disabled={isArchived}
														onClick={() => void updateTodo(todo.id, { status: TodoStatus.Archived }, "Todo archived.")}
													>
														Archive
													</button>
												</td>
											</tr>
										)
									})}
								</tbody>
							</table>
						)
					) : null}
				</div>
			</section>
			<Modal id="todo-create-modal" title="Add Todo" open={modalOpen} onClose={() => setModalOpen(false)} className="todo-create-modal">
				<form id="todo-form" onSubmit={onSubmit}>
					<label>
						Todo
						<input
							id="todo-title"
							name="todo-title"
							placeholder="Todo"
							autoComplete="off"
							required
							value={title}
							onChange={(e) => setTitle(e.target.value)}
						/>
					</label>
					<label>
						Notes
						<input
							id="todo-notes"
							name="todo-notes"
							placeholder="Notes (optional)"
							autoComplete="off"
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
						/>
					</label>
					<label>
						Due
						<input
							id="todo-due-at"
							name="todo-due-at"
							type="datetime-local"
							value={dueAt}
							onChange={(e) => setDueAt(e.target.value)}
						/>
					</label>
					<div className="actions">
						<button className="primary" type="submit" disabled={pending}>
							Add Todo
						</button>
					</div>
				</form>
				<Status message={modalStatus} error={!!modalStatus} />
			</Modal>
		</>
	)
}
