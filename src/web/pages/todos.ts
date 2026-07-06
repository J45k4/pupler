import {
	escapeHtml,
	formatReceiptDateTime,
	formatShoppingDate,
	renderPage,
	setStatus,
} from "../app";
import type { Todo } from "../app";
import { renderModal } from "../ui/modal";

const TodoStatus = {
	Open: 1,
	Done: 2,
	Archived: 3,
} as const;

const getTodoMode = () => {
	const showDone = document.getElementById("todos-show-done");
	const showArchived = document.getElementById("todos-show-archived");
	return {
		showDone: showDone instanceof HTMLInputElement && showDone.checked,
		showArchived:
			showArchived instanceof HTMLInputElement && showArchived.checked,
	};
};

const localDateTimeToIso = (value: string) =>
	value ? new Date(value).toISOString() : null;

const renderTodoItems = (items: Todo[]) => {
	const results = document.getElementById("todo-results");
	if (!results) {
		return;
	}

	if (!items.length) {
		results.innerHTML = '<div class="empty">No todos yet.</div>';
		return;
	}

	results.innerHTML = `
		<table class="shoppinglist-table shoppinglist-table--todos">
			<thead>
				<tr>
					<th>Done</th>
					<th>Todo</th>
					<th>Due</th>
					<th>Actions</th>
				</tr>
			</thead>
			<tbody>
				${items
					.map((todo) => {
						const isDone = todo.status === TodoStatus.Done;
						const isArchived = todo.status === TodoStatus.Archived;
						const rowClass = isDone || isArchived
							? "shoppinglist-table__row shoppinglist-table__row--done"
							: "shoppinglist-table__row";
						const statusLabel = isArchived
							? "Archived"
							: isDone
								? "Done"
								: "Open";

						return `
							<tr class="${rowClass}">
								<td class="shoppinglist-table__check">
									<input
										type="checkbox"
										data-todo-id="${todo.id}"
										aria-label="Mark ${escapeHtml(todo.title)} done"
										${isDone ? " checked" : ""}
										${isArchived ? " disabled" : ""}
									/>
								</td>
								<td>
									<div class="shoppinglist-product__name">${escapeHtml(todo.title)}</div>
									${todo.notes ? `<div class="section-copy">${escapeHtml(todo.notes)}</div>` : ""}
									<div class="section-copy">${statusLabel} · Added ${formatShoppingDate(todo.created_at)}</div>
								</td>
								<td class="shoppinglist-table__date">
									${todo.due_at ? formatReceiptDateTime(todo.due_at) : "-"}
								</td>
								<td>
									<button class="secondary" type="button" data-archive-todo-id="${todo.id}" ${isArchived ? " disabled" : ""}>Archive</button>
								</td>
							</tr>
						`;
					})
					.join("")}
			</tbody>
		</table>
	`;
};

const loadTodos = async () => {
	try {
		const response = await fetch("/api/todos?sort=created_at&order=desc");
		const body = (await response.json()) as Todo[] | { error?: string };

		if (!response.ok) {
			throw new Error(
				"error" in body
					? (body.error ?? "Failed to load todos")
					: "Failed to load todos",
			);
		}

		const mode = getTodoMode();
		const todos = (body as Todo[]).filter((todo) => {
			if (todo.status === TodoStatus.Archived) {
				return mode.showArchived;
			}
			if (todo.status === TodoStatus.Done) {
				return mode.showDone;
			}
			return true;
		});

		renderTodoItems(todos);
		setStatus("todo-status", `Loaded ${todos.length} todo(s).`);
	} catch (error) {
		renderTodoItems([]);
		setStatus(
			"todo-status",
			error instanceof Error ? error.message : "Failed to load todos",
			true,
		);
	}
};

const updateTodo = async (todoId: number, payload: Partial<Todo>) => {
	const response = await fetch(`/api/todos/${todoId}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
	const body = (await response.json()) as Todo | { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to update todo")
				: "Failed to update todo",
		);
	}

	return body as Todo;
};

const attachTodosPageEvents = () => {
	const modal = document.getElementById("todo-create-modal");
	const addButton = document.getElementById("open-todo-modal-button");
	const titleInput = document.getElementById("todo-title");

	const closeModal = () => {
		if (!modal) {
			return;
		}
		modal.hidden = true;
		document.body.classList.remove("modal-open");
		setStatus("todo-modal-status", "");
	};

	const openModal = () => {
		if (!modal) {
			return;
		}
		modal.hidden = false;
		document.body.classList.add("modal-open");
		setStatus("todo-modal-status", "");
		if (titleInput instanceof HTMLInputElement) {
			titleInput.focus();
		}
	};

	addButton?.addEventListener("click", openModal);
	modal?.addEventListener("click", (event) => {
		const target = event.target;
		if (!(target instanceof HTMLElement)) return;
		if (target.dataset.todoModalClose !== undefined) {
			closeModal();
		}
	});

	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape" && modal && !modal.hidden) {
			closeModal();
		}
	});

	document
		.getElementById("todo-form")
		?.addEventListener("submit", async (event) => {
			event.preventDefault();

			const titleInput = document.getElementById("todo-title");
			const notesInput = document.getElementById("todo-notes");
			const dueAtInput = document.getElementById("todo-due-at");

			if (!(titleInput instanceof HTMLInputElement)) {
				return;
			}

			const title = titleInput.value.trim();
			if (!title) {
				setStatus("todo-modal-status", "Todo title is required", true);
				return;
			}

			try {
				const response = await fetch("/api/todos", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						title,
						notes:
							notesInput instanceof HTMLInputElement && notesInput.value.trim()
								? notesInput.value.trim()
								: null,
						status: TodoStatus.Open,
						due_at:
							dueAtInput instanceof HTMLInputElement
								? localDateTimeToIso(dueAtInput.value)
								: null,
						completed_at: null,
					}),
				});
				const body = (await response.json()) as Todo | { error?: string };

				if (!response.ok) {
					throw new Error(
						"error" in body
							? (body.error ?? "Failed to add todo")
							: "Failed to add todo",
					);
				}

				setStatus("todo-status", `Added ${title}.`);
				titleInput.value = "";
				if (notesInput instanceof HTMLInputElement) notesInput.value = "";
				if (dueAtInput instanceof HTMLInputElement) dueAtInput.value = "";
				closeModal();
				await loadTodos();
			} catch (error) {
				setStatus(
					"todo-modal-status",
					error instanceof Error ? error.message : "Failed to add todo",
					true,
				);
			}
		});

	document
		.getElementById("todo-results")
		?.addEventListener("change", async (event) => {
			const target = event.target;
			if (!(target instanceof HTMLInputElement)) return;
			if (target.type !== "checkbox" || !target.matches("[data-todo-id]")) return;

			const todoId = Number(target.dataset.todoId);
			if (!Number.isInteger(todoId)) return;

			try {
				await updateTodo(todoId, {
					status: target.checked ? TodoStatus.Done : TodoStatus.Open,
					completed_at: target.checked ? new Date().toISOString() : null,
				});
				setStatus("todo-status", "Todo updated.");
				await loadTodos();
			} catch (error) {
				target.checked = !target.checked;
				setStatus(
					"todo-status",
					error instanceof Error ? error.message : "Failed to update todo",
					true,
				);
			}
		});

	document
		.getElementById("todo-results")
		?.addEventListener("click", async (event) => {
			const target = event.target;
			if (!(target instanceof HTMLElement)) return;
			const button = target.closest("[data-archive-todo-id]");
			if (!(button instanceof HTMLButtonElement)) return;

			const todoId = Number(button.dataset.archiveTodoId);
			if (!Number.isInteger(todoId)) return;

			try {
				await updateTodo(todoId, { status: TodoStatus.Archived });
				setStatus("todo-status", "Todo archived.");
				await loadTodos();
			} catch (error) {
				setStatus(
					"todo-status",
					error instanceof Error ? error.message : "Failed to archive todo",
					true,
				);
			}
		});

	document
		.getElementById("todos-show-done")
		?.addEventListener("change", () => void loadTodos());
	document
		.getElementById("todos-show-archived")
		?.addEventListener("change", () => void loadTodos());
};

export const renderTodosPage = () => {
	renderPage(
		`
			<section class="workspace workspace--single">
				<div class="card panel">
					<div class="section-header">
						<h2>Todos</h2>
						<div class="todos-panel-actions">
							<label class="checkbox-toggle" for="todos-show-done">
								<input id="todos-show-done" type="checkbox" aria-label="Show done todos" />
								<span>Show done</span>
							</label>
							<label class="checkbox-toggle" for="todos-show-archived">
								<input id="todos-show-archived" type="checkbox" aria-label="Show archived todos" />
								<span>Show archived</span>
							</label>
							<button class="primary" id="open-todo-modal-button" type="button">Add</button>
						</div>
					</div>
					<div id="todo-status" class="status"></div>
					<div id="todo-results" class="results"></div>
				</div>
			</section>

			${renderModal({
				id: "todo-create-modal",
				title: "Add Todo",
				titleId: "todo-create-modal-title",
				closeDataAttribute: "data-todo-modal-close",
				className: "todo-create-modal",
				children: `
					<form id="todo-form">
						<label>
							Todo
							<input
								id="todo-title"
								name="todo-title"
								placeholder="Todo"
								autocomplete="off"
								required
							/>
						</label>
						<label>
							Notes
							<input
								id="todo-notes"
								name="todo-notes"
								placeholder="Notes (optional)"
								autocomplete="off"
							/>
						</label>
						<label>
							Due
							<input
								id="todo-due-at"
								name="todo-due-at"
								type="datetime-local"
							/>
						</label>
						<div class="actions">
							<button class="primary" type="submit">Add Todo</button>
						</div>
					</form>
					<div id="todo-modal-status" class="status"></div>
				`,
			})}
		`,
	);

	void loadTodos();
	attachTodosPageEvents();
};
