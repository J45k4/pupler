import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { closeDatabase, createApiRoutes, openDatabase, receiptItemsCollectionRoute, shoppingListItemsCollectionRoute, timeReportRoute } from "../src/api"
import { hashSessionToken } from "../src/api/auth"
import { setDatabase } from "../src/db"
import { applyTestSchema } from "./support/test-db"

describe("bounded page fetches", () => {
	let directory: string
	let database: ReturnType<typeof openDatabase>
	let handlers: Record<string, (request: Request) => Response | Promise<Response>>
	let owner: number
	let other: number
	let queries: string[]
	const stamps = { created_at: "2026-10-01T00:00:00.000Z", updated_at: "2026-10-01T00:00:00.000Z" }

	beforeEach(async () => {
		directory = mkdtempSync(join(tmpdir(), "pupler-fetch-"))
		const path = join(directory, "test.db")
		applyTestSchema(path)
		database = openDatabase(path)
		queries = []
		database.client = (database.client as any).$extends({ query: { $allModels: { $allOperations({ model, operation, args, query }: any) { queries.push(`${model}.${operation}`); return query(args) } } } })
		setDatabase(database)
		owner = (await database.client.user.create({ data: { name: "Owner", ...stamps } })).id
		other = (await database.client.user.create({ data: { name: "Other", ...stamps } })).id
		for (const id of [owner, other]) await database.client.userSession.create({ data: { user_id: id, token_hash: hashSessionToken(`test-${id}`), expires_at: "2099-01-01T00:00:00.000Z", last_seen_at: stamps.created_at, created_at: stamps.created_at } })
		handlers = createApiRoutes({ authenticated: { "/api/time-report": timeReportRoute, "/api/shopping-list-items": shoppingListItemsCollectionRoute, "/api/receipt-items": receiptItemsCollectionRoute } })
	})
	afterEach(async () => {
		await closeDatabase(database)
		rmSync(directory, { recursive: true, force: true })
	})
	const request = (path: string, user = owner) => handlers[path.split("?")[0]!]!(new Request(`http://localhost${path}`, { headers: { Cookie: `pupler_session=test-${user}` } }))
	const batchPath = (boundaries: unknown, extra = "") => `/api/time-report?${new URLSearchParams({ view: "days", boundaries: JSON.stringify(boundaries) })}${extra}`
	const entry = (started_at: string, ended_at: string | null, user_id = owner) => database.client.timeEntry.create({ data: { user_id, started_at: new Date(started_at).toISOString(), ended_at: ended_at === null ? null : new Date(ended_at).toISOString(), description: "Work", ...stamps } })

	test("batched daily reports match individual reports across midnight and DST using one entry query", async () => {
		const boundaries = ["2026-10-24T00:00:00+03:00", "2026-10-25T00:00:00+03:00", "2026-10-26T00:00:00+02:00", "2026-10-27T00:00:00+02:00"]
		await entry("2026-10-24T23:00:00+03:00", "2026-10-26T01:00:00+02:00")
		await entry("2026-10-25T12:00:00+02:00", null)
		await entry("2026-10-24T00:00:00+03:00", "2026-10-27T00:00:00+02:00", other)
		queries.length = 0
		const response = await request(batchPath(boundaries))
		expect(response.status).toBe(200)
		const reports = await response.json() as any[]
		expect(queries.filter(query => query === "TimeEntry.findMany")).toHaveLength(1)
		for (let index = 0; index < reports.length; index++) {
			const single = await request(`/api/time-report?${new URLSearchParams({ from: new Date(boundaries[index]!).toISOString(), to: new Date(boundaries[index + 1]!).toISOString() })}`)
			expect(reports[index]).toEqual(await single.json())
		}
		expect(reports.map(report => report.total_seconds)).toEqual([3600, 25 * 3600 + 12 * 3600, 25 * 3600])
		expect(reports[0].running_entry).toBeNull()
		expect((await request(batchPath(boundaries, `&user_id=${other}`))).status).toBe(403)
	})

	test("daily reports accept spring DST and full months, preserve empty days, and reject malformed ranges", async () => {
		const spring = ["2026-03-29T00:00:00+02:00", "2026-03-30T00:00:00+03:00"]
		await entry(spring[0]!, spring[1]!)
		const reports = await (await request(batchPath(spring))).json() as any[]
		expect(reports[0].total_seconds).toBe(23 * 3600)
		const month = Array.from({ length: 32 }, (_, day) => new Date(Date.UTC(2026, 6, day + 1)).toISOString())
		expect((await (await request(batchPath(month))).json() as any[]).map(report => report.total_seconds)).toEqual(Array(31).fill(0))
		for (const values of [null, [], [stamps.created_at], [1, 2], ["invalid", "also invalid"], [spring[1], spring[0]], [spring[0], spring[0]], [spring[0], "2026-04-05T00:00:00Z"], [...month, "2026-08-02T00:00:00Z"]]) expect((await request(batchPath(values))).status).toBe(400)
		expect((await request(batchPath(spring, "&range=all"))).status).toBe(400)
		expect((await handlers["/api/time-report"]!(new Request(`http://localhost${batchPath(spring)}`))).status).toBe(401)
	})

	test("the overview returns eight pending items with an accurate count and membership isolation", async () => {
		const list = await database.client.shoppingList.create({ data: { name: "Shared", ...stamps } })
		await database.client.shoppingListMember.create({ data: { shopping_list_id: list.id, user_id: owner, role: "editor", created_at: stamps.created_at } })
		await database.client.shoppingListItem.createMany({ data: Array.from({ length: 20 }, (_, index) => ({ shopping_list_id: list.id, name: `Item ${index}`, quantity: 1, unit: "pcs", done: index === 0, removed_at: index === 1 ? stamps.created_at : null, ...stamps })) })
		const response = await request("/api/shopping-list-items?view=overview")
		expect(response.status).toBe(200)
		const overview = await response.json() as any
		expect(overview.items).toHaveLength(8)
		expect(overview.total).toBe(18)
		expect(overview.items[0].name).toBe("Item 2")
		expect(Object.keys(overview.items[0]).sort()).toEqual(["id", "name", "quantity", "unit"])
		expect(await (await request("/api/shopping-list-items?view=overview", other)).json()).toEqual({ items: [], total: 0 })
		expect((await request("/api/shopping-list-items?view=overview&done=true")).status).toBe(400)
		const board = await (await request("/api/shopping-list-items?view=board")).json() as any
		expect(board.items).toHaveLength(19)
		expect(board.items.every((item: any) => item.removed_at === null)).toBe(true)
		expect(board.removed_counts).toEqual({ [list.id]: 1 })
		expect(await (await request("/api/shopping-list-items?view=board", other)).json()).toEqual({ items: [], removed_counts: {} })
	})

	test("receipt rows can include product names without downloading the product catalogue", async () => {
		const product = await database.client.product.create({ data: { name: "Milk", category: "Dairy", is_perishable: true, ...stamps } })
		const receipt = await database.client.receipt.create({ data: { store_name: "Shop", purchased_at: stamps.created_at, currency: "EUR", ...stamps } })
		await database.client.receiptItem.create({ data: { product_id: product.id, receipt_id: receipt.id, quantity: 2, unit: "pcs", created_at: stamps.created_at } })
		const path = `/api/receipt-items?receipt_id=${receipt.id}`
		const rows = await (await request(path + "&view=detail")).json() as any[]
		expect(rows[0].product).toEqual({ id: product.id, name: "Milk" })
		expect((await (await request(path)).json() as any[])[0].product).toBeUndefined()
		expect((await request(path + "&view=unknown")).status).toBe(400)
	})

	test("route and handler authentication share one lookup and write only for the current request", async () => {
		queries.length = 0
		expect((await request("/api/time-report")).status).toBe(200)
		expect(queries.filter(query => query === "UserSession.findUnique")).toHaveLength(1)
		expect(queries.filter(query => query === "UserSession.update")).toHaveLength(1)
		await database.client.userSession.deleteMany({ where: { user_id: owner } })
		expect((await request("/api/time-report")).status).toBe(401)
		expect(queries.filter(query => query === "UserSession.findUnique")).toHaveLength(2)
	})
})
