import { expect, test } from "bun:test"
import type { Todo } from "../src/react/lib"
import { groupTodos, removeTodoGroup, replaceTodo, upsertTodo } from "../src/react/pages/todo-list-data"

const todo = (id: number, listId: number, status = 1): Todo => ({
	id,
	todo_list_id: listId,
	title: `Todo ${id}`,
	notes: null,
	status,
	due_at: null,
	completed_at: null,
	created_at: "2026-10-17T10:00:00Z",
	updated_at: "2026-10-17T10:00:00Z",
})

test("groups the initial response without copying or reordering todos", () => {
	const items = [todo(3, 2), todo(2, 1), todo(1, 2)]
	const groups = groupTodos(items)
	expect(groups[1]).toEqual([items[1]!])
	expect(groups[2]).toEqual([items[0]!, items[2]!])
	expect(groups[2]![0]).toBe(items[0]!)
})

test("adding concurrent responses keeps newest todos first and preserves unrelated cards", () => {
	const original = groupTodos([todo(1, 1), todo(2, 2)])
	const next = upsertTodo(upsertTodo(original, todo(4, 1)), todo(3, 1))
	expect(next[1]!.map((item) => item.id)).toEqual([4, 3, 1])
	expect(next[2]).toBe(original[2]!)
	expect(original[1]!.map((item) => item.id)).toEqual([1])
	const duplicateResponse = upsertTodo(next, { ...todo(3, 1), notes: "Saved" })
	expect(duplicateResponse[1]).toHaveLength(3)
	expect(duplicateResponse[1]!.find((item) => item.id === 3)?.notes).toBe("Saved")
})

test("completing or archiving a todo preserves all other todos and card arrays", () => {
	const first = todo(1, 1)
	const sibling = todo(2, 1)
	const original = groupTodos([first, sibling, todo(3, 2)])
	for (const status of [2, 3, 1]) {
		const next = replaceTodo(original, { ...first, status })
		expect(next[1]![0]!.status).toBe(status)
		expect(next[1]![1]).toBe(sibling)
		expect(next[2]).toBe(original[2]!)
		expect(original[1]![0]!.status).toBe(1)
	}
})

test("rolling back one failed change retains concurrent changes to other todos", () => {
	const first = todo(1, 1)
	const second = todo(2, 1)
	let groups = groupTodos([first, second])
	groups = replaceTodo(groups, { ...first, status: 2 })
	groups = replaceTodo(groups, { ...second, status: 3 })
	groups = replaceTodo(groups, first)
	expect(groups[1]!.map((item) => item.status)).toEqual([1, 3])
})

test("deleting a card preserves other cards and ignores late save or rollback responses", () => {
	const first = todo(1, 1)
	const original = groupTodos([first, todo(2, 2)])
	const next = removeTodoGroup(original, 1)
	expect(next[1]).toBeUndefined()
	expect(next[2]).toBe(original[2]!)
	expect(original[1]).toEqual([first])
	expect(replaceTodo(next, { ...first, status: 2 })).toBe(next)
	expect(replaceTodo(next, first)).toBe(next)
	expect(removeTodoGroup(next, 1)).toBe(next)
})
