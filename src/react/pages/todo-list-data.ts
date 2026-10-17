import { TodoListRole } from "../../todo-list-role"
import type { Todo } from "../lib"

export type TodoList = { id: number; name: string; role: TodoListRole; hidden: boolean }
export type TodoGroups = Record<number, Todo[]>

export const groupTodos = (todos: Todo[]) => {
	const groups: TodoGroups = {}
	for (const todo of todos) (groups[todo.todo_list_id] ??= []).push(todo)
	return groups
}

export const upsertTodo = (groups: TodoGroups, todo: Todo) => {
	const items = groups[todo.todo_list_id] ?? []
	const exists = items.some((item) => item.id === todo.id)
	const next = exists
		? items.map((item) => item.id === todo.id ? todo : item)
		: [...items, todo].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)
	return { ...groups, [todo.todo_list_id]: next }
}

export const removeTodoGroup = (groups: TodoGroups, listId: number) => {
	if (!(listId in groups)) return groups
	const next = { ...groups }
	delete next[listId]
	return next
}

export const replaceTodo = (groups: TodoGroups, todo: Todo) =>
	groups[todo.todo_list_id]?.some((item) => item.id === todo.id) ? upsertTodo(groups, todo) : groups
