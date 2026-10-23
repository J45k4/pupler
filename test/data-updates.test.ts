import { expect, test } from "bun:test"
import { shoppingPreview, upsertItem } from "../src/react/data-updates"

test("confirmed records insert and replace without mutating existing collections", () => {
	const first = { id: 1, name: "First" }, second = { id: 2, name: "Second" }
	const records = [first, second]
	expect(upsertItem(null, first)).toEqual([first])
	expect(upsertItem(records, { ...second, name: "Saved" }).map(item => item.name)).toEqual(["First", "Saved"])
	expect(upsertItem(records, { id: 3, name: "New" }).map(item => item.id)).toEqual([3, 1, 2])
	expect(records).toEqual([first, second])
})

test("shopping preview keeps the oldest eight pending items and counts all remaining items", () => {
	const items = Array.from({ length: 12 }, (_, id) => ({ id, done: id === 0, created_at: new Date(1000 * (12 - id)).toISOString() }))
	const preview = shoppingPreview(items)
	expect(preview.total).toBe(11)
	expect(preview.items.map(item => item.id)).toEqual([11, 10, 9, 8, 7, 6, 5, 4])
	expect(items[0]!.id).toBe(0)
	expect(shoppingPreview(items.map(item => ({ ...item, done: true })))).toEqual({ items: [], total: 0 })
})
