import {
	formatReceiptDateTime,
	formatShoppingDate,
	renderPage,
	setStatus,
} from "../app"
import type { Todo } from "../app"
import {
	createElement,
	createEmptyState,
	getElementById,
	withQueryRoot,
} from "../lib/dom"
import { createModal } from "../ui/modal"

const TodoStatus = {
	Open: 1,
	Done: 2,
	Archived: 3,
} as const

const getTodoMode = () => {
	const showDone = getElementById("todos-show-done")
	const showArchived = getElementById("todos-show-archived")
	return {
		showDone: showDone instanceof HTMLInputElement && showDone.checked,
		showArchived:
			showArchived instanceof HTMLInputElement && showArchived.checked,
	}
}

const localDateTimeToIso = (value: string) =>
	value ? new Date(value).toISOString() : null

const renderTodoItems = (items: Todo[]) => {
	const results = getElementById("todo-results")
	if (!results) {
		return
	}

	if (!items.length) {
		results.replaceChildren(createEmptyState("No todos yet."))
		return
	}

	const table = createElement("table", {
		className: "shoppinglist-table shoppinglist-table--todos",
	})
	const headerRow = document.createElement("tr")
	for (const label of ["Done", "Todo", "Due", "Actions"]) {
		headerRow.append(createElement("th", { text: label }))
	}
	const head = document.createElement("thead")
	head.append(headerRow)
	const body = document.createElement("tbody")

	for (const todo of items) {
		const isDone = todo.status === TodoStatus.Done
		const isArchived = todo.status === TodoStatus.Archived
		const row = createElement("tr", {
			className:
				isDone || isArchived
					? "shoppinglist-table__row shoppinglist-table__row--done"
					: "shoppinglist-table__row",
		})
		const checkbox = document.createElement("input")
		checkbox.type = "checkbox"
		checkbox.checked = isDone
		checkbox.disabled = isArchived
		checkbox.setAttribute("aria-label", `Mark ${todo.title} done`)
		checkbox.addEventListener("change", async () => {
			try {
				await updateTodo(todo.id, {
					status: checkbox.checked
						? TodoStatus.Done
						: TodoStatus.Open,
					completed_at: checkbox.checked
						? new Date().toISOString()
						: null,
				})
				setStatus("todo-status", "Todo updated.")
				await loadTodos()
			} catch (error) {
				checkbox.checked = !checkbox.checked
				setStatus(
					"todo-status",
					error instanceof Error
						? error.message
						: "Failed to update todo",
					true,
				)
			}
		})
		const checkCell = createElement(
			"td",
			{
				className: "shoppinglist-table__check",
			},
			checkbox,
		)
		const todoCell = document.createElement("td")
		todoCell.append(
			createElement("div", {
				className: "shoppinglist-product__name",
				text: todo.title,
			}),
		)
		if (todo.notes) {
			todoCell.append(
				createElement("div", {
					className: "section-copy",
					text: todo.notes,
				}),
			)
		}
		const statusLabel = isArchived ? "Archived" : isDone ? "Done" : "Open"
		todoCell.append(
			createElement("div", {
				className: "section-copy",
				text: `${statusLabel} · Added ${formatShoppingDate(todo.created_at)}`,
			}),
		)
		const archive = createElement("button", {
			className: "secondary",
			text: "Archive",
		})
		archive.type = "button"
		archive.disabled = isArchived
		archive.addEventListener("click", async () => {
			try {
				await updateTodo(todo.id, { status: TodoStatus.Archived })
				setStatus("todo-status", "Todo archived.")
				await loadTodos()
			} catch (error) {
				setStatus(
					"todo-status",
					error instanceof Error
						? error.message
						: "Failed to archive todo",
					true,
				)
			}
		})
		row.append(
			checkCell,
			todoCell,
			createElement("td", {
				className: "shoppinglist-table__date",
				text: todo.due_at ? formatReceiptDateTime(todo.due_at) : "-",
			}),
			createElement("td", {}, archive),
		)
		body.append(row)
	}
	table.append(head, body)
	results.replaceChildren(table)
}

const loadTodos = async () => {
	try {
		const response = await fetch("/api/todos?sort=created_at&order=desc")
		const body = (await response.json()) as Todo[] | { error?: string }

		if (!response.ok) {
			throw new Error(
				"error" in body
					? (body.error ?? "Failed to load todos")
					: "Failed to load todos",
			)
		}

		const mode = getTodoMode()
		const todos = (body as Todo[]).filter((todo) => {
			if (todo.status === TodoStatus.Archived) {
				return mode.showArchived
			}
			if (todo.status === TodoStatus.Done) {
				return mode.showDone
			}
			return true
		})

		renderTodoItems(todos)
		setStatus("todo-status", `Loaded ${todos.length} todo(s).`)
	} catch (error) {
		renderTodoItems([])
		setStatus(
			"todo-status",
			error instanceof Error ? error.message : "Failed to load todos",
			true,
		)
	}
}

const updateTodo = async (todoId: number, payload: Partial<Todo>) => {
	const response = await fetch(`/api/todos/${todoId}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	})
	const body = (await response.json()) as Todo | { error?: string }

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to update todo")
				: "Failed to update todo",
		)
	}

	return body as Todo
}

const attachTodosPageEvents = () => {
	const modal = getElementById("todo-create-modal")
	const addButton = getElementById("open-todo-modal-button")
	const titleInput = getElementById("todo-title")

	const closeModal = () => {
		if (!modal) {
			return
		}
		modal.hidden = true
		document.body.classList.remove("modal-open")
		setStatus("todo-modal-status", "")
	}

	const openModal = () => {
		if (!modal) {
			return
		}
		modal.hidden = false
		document.body.classList.add("modal-open")
		setStatus("todo-modal-status", "")
		if (titleInput instanceof HTMLInputElement) {
			titleInput.focus()
		}
	}

	addButton?.addEventListener("click", openModal)
	modal?.addEventListener("click", (event) => {
		const target = event.target
		if (!(target instanceof HTMLElement)) return
		if (target.dataset.todoModalClose !== undefined) {
			closeModal()
		}
	})

	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape" && modal && !modal.hidden) {
			closeModal()
		}
	})

	document
		.getElementById("todo-form")
		?.addEventListener("submit", async (event) => {
			event.preventDefault()

			const titleInput = getElementById("todo-title")
			const notesInput = getElementById("todo-notes")
			const dueAtInput = getElementById("todo-due-at")

			if (!(titleInput instanceof HTMLInputElement)) {
				return
			}

			const title = titleInput.value.trim()
			if (!title) {
				setStatus("todo-modal-status", "Todo title is required", true)
				return
			}

			try {
				const response = await fetch("/api/todos", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						title,
						notes:
							notesInput instanceof HTMLInputElement &&
							notesInput.value.trim()
								? notesInput.value.trim()
								: null,
						status: TodoStatus.Open,
						due_at:
							dueAtInput instanceof HTMLInputElement
								? localDateTimeToIso(dueAtInput.value)
								: null,
						completed_at: null,
					}),
				})
				const body = (await response.json()) as
					| Todo
					| { error?: string }

				if (!response.ok) {
					throw new Error(
						"error" in body
							? (body.error ?? "Failed to add todo")
							: "Failed to add todo",
					)
				}

				setStatus("todo-status", `Added ${title}.`)
				titleInput.value = ""
				if (notesInput instanceof HTMLInputElement)
					notesInput.value = ""
				if (dueAtInput instanceof HTMLInputElement)
					dueAtInput.value = ""
				closeModal()
				await loadTodos()
			} catch (error) {
				setStatus(
					"todo-modal-status",
					error instanceof Error
						? error.message
						: "Failed to add todo",
					true,
				)
			}
		})

	document
		.getElementById("todos-show-done")
		?.addEventListener("change", () => void loadTodos())
	document
		.getElementById("todos-show-archived")
		?.addEventListener("change", () => void loadTodos())
}

export const renderTodosPage = () => {
	const page = document.createDocumentFragment()
	const showDone = createElement("input", {
		id: "todos-show-done",
		properties: { type: "checkbox" },
		attributes: { "aria-label": "Show done todos" },
	})
	const showArchived = createElement("input", {
		id: "todos-show-archived",
		properties: { type: "checkbox" },
		attributes: { "aria-label": "Show archived todos" },
	})
	const todoForm = createElement(
		"form",
		{ id: "todo-form" },
		createElement(
			"label",
			{},
			"Todo",
			createElement("input", {
				id: "todo-title",
				properties: {
					name: "todo-title",
					placeholder: "Todo",
					autocomplete: "off",
					required: true,
				},
			}),
		),
		createElement(
			"label",
			{},
			"Notes",
			createElement("input", {
				id: "todo-notes",
				properties: {
					name: "todo-notes",
					placeholder: "Notes (optional)",
					autocomplete: "off",
				},
			}),
		),
		createElement(
			"label",
			{},
			"Due",
			createElement("input", {
				id: "todo-due-at",
				properties: { name: "todo-due-at", type: "datetime-local" },
			}),
		),
		createElement(
			"div",
			{ className: "actions" },
			createElement(
				"button",
				{ className: "primary", properties: { type: "submit" } },
				"Add Todo",
			),
		),
	)
	page.append(
		createElement(
			"section",
			{ className: "workspace workspace--single" },
			createElement(
				"div",
				{ className: "card panel" },
				createElement(
					"div",
					{ className: "section-header" },
					createElement("h2", {}, "Todos"),
					createElement(
						"div",
						{ className: "todos-panel-actions" },
						createElement(
							"label",
							{
								className: "checkbox-toggle",
								properties: { htmlFor: "todos-show-done" },
							},
							showDone,
							createElement("span", {}, "Show done"),
						),
						createElement(
							"label",
							{
								className: "checkbox-toggle",
								properties: { htmlFor: "todos-show-archived" },
							},
							showArchived,
							createElement("span", {}, "Show archived"),
						),
						createElement(
							"button",
							{
								id: "open-todo-modal-button",
								className: "primary",
								properties: { type: "button" },
							},
							"Add",
						),
					),
				),
				createElement("div", {
					id: "todo-status",
					className: "status",
				}),
				createElement("div", {
					id: "todo-results",
					className: "results",
				}),
			),
		),
		createModal({
			id: "todo-create-modal",
			title: "Add Todo",
			titleId: "todo-create-modal-title",
			closeDataAttribute: "data-todo-modal-close",
			className: "todo-create-modal",
			children: [
				todoForm,
				createElement("div", {
					id: "todo-modal-status",
					className: "status",
				}),
			],
		}),
	)
	withQueryRoot(page, attachTodosPageEvents)
	renderPage(page)
	void loadTodos()
}
