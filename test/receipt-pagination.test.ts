import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { closeDatabase, createApiRoutes, openDatabase, receiptsCollectionRoute } from "../src/api"
import { setDatabase } from "../src/db"
import { applyTestSchema } from "./support/test-db"
import type { ReceiptPage } from "../src/react/pages/receipt-page-data"

describe("receipt pagination", () => {
	let directory: string
	let database: ReturnType<typeof openDatabase>
	let handler: (request: Request) => Response | Promise<Response>
	const now = "2026-10-17T12:00:00.000Z"

	beforeEach(() => {
		directory = mkdtempSync(join(tmpdir(), "pupler-receipt-pages-"))
		const path = join(directory, "pupler.db")
		applyTestSchema(path)
		database = openDatabase(path)
		setDatabase(database)
		handler = createApiRoutes({ public: { "/api/receipts": receiptsCollectionRoute } })["/api/receipts"] as typeof handler
	})
	afterEach(async () => {
		await closeDatabase(database)
		rmSync(directory, { recursive: true, force: true })
	})

	const receipt = (purchased_at: string, group_id: number | null = null) => database.client.receipt.create({ data: { store_name: "Pagination test", purchased_at, group_id, currency: "EUR", total_amount: 12.5, created_at: now, updated_at: now } })
	const request = (query = "view=page") => handler(new Request(`http://localhost/api/receipts?${query}`))
	const page = async (query = "view=page"): Promise<ReceiptPage> => {
		const response = await request(query)
		expect(response.status).toBe(200)
		return response.json()
	}

	test("orders actual instants across offsets and breaks timestamp ties by descending ID", async () => {
		const older = await receipt("2026-10-17T13:00:00+03:00")
		const newer = await receipt("2026-10-17T11:00:00Z")
		const tied = await receipt("2026-10-17T14:00:00+03:00")
		const first = await page("view=page&limit=1")
		expect(first.receipts.map((item) => item.id)).toEqual([tied.id])
		expect(first.receipts[0]?.total_amount).toBe(12.5)
		const second = await page(`view=page&limit=1&cursor=${first.next_cursor}`)
		expect(second.receipts.map((item) => item.id)).toEqual([newer.id])
		const third = await page(`view=page&limit=1&cursor=${second.next_cursor}`)
		expect(third.receipts.map((item) => item.id)).toEqual([older.id])
		expect(third.next_cursor).toBeNull()
		expect(Array.isArray(await (await request("sort=purchased_at&order=desc")).json())).toBe(true)
	})

	test("loads bounded pages without gaps when newer receipts arrive or the cursor receipt is deleted", async () => {
		const receipts = await Promise.all(Array.from({ length: 83 }, (_, index) => receipt(new Date(Date.UTC(2026, 9, 17, 12, 0, index)).toISOString())))
		const expected = receipts.slice().sort((a, b) => b.purchased_at.localeCompare(a.purchased_at)).map((item) => item.id)
		const first = await page()
		expect(first.receipts).toHaveLength(40)
		expect(first.next_cursor).not.toBeNull()
		await receipt("2026-10-18T00:00:00Z")
		await database.client.receipt.delete({ where: { id: first.receipts.at(-1)!.id } })
		const second = await page(`view=page&cursor=${first.next_cursor}`)
		expect(second.receipts).toHaveLength(40)
		const third = await page(`view=page&cursor=${second.next_cursor}`)
		expect(third.receipts).toHaveLength(3)
		expect(third.next_cursor).toBeNull()
		expect([...first.receipts, ...second.receipts, ...third.receipts].map((item) => item.id)).toEqual(expected)
	})

	test("combines group and exclusive before filters across pages, including ungrouped receipts", async () => {
		const group = await database.client.group.create({ data: { name: "Groceries", created_at: now, updated_at: now } })
		await receipt("2026-10-17T00:00:00Z", group.id)
		const selectedDay = await receipt("2026-10-17T01:59:59+03:00", group.id)
		const older = await receipt("2026-10-15T00:00:00Z", group.id)
		const ungrouped = await receipt("2026-10-16T12:00:00Z")
		const filters = `view=page&limit=1&group_id=${group.id}&before=2026-10-17T00%3A00%3A00Z`
		const first = await page(filters)
		expect(first.receipts.map((item) => item.id)).toEqual([selectedDay.id])
		expect(first.receipts[0]?.group?.name).toBe("Groceries")
		const second = await page(`${filters}&cursor=${first.next_cursor}`)
		expect(second.receipts.map((item) => item.id)).toEqual([older.id])
		expect(second.next_cursor).toBeNull()
		const withoutGroup = await page("view=page&group_id=null&before=2026-10-17T00%3A00%3A00Z")
		expect(withoutGroup.receipts.map((item) => item.id)).toEqual([ungrouped.id])
		expect(await page("view=page&before=2000-01-01T00%3A00%3A00Z")).toEqual({ receipts: [], next_cursor: null })
	})

	test("ends at an exact page boundary and accepts the maximum page size", async () => {
		await receipt(now)
		await receipt(now)
		const exact = await page("view=page&limit=2")
		expect(exact.receipts).toHaveLength(2)
		expect(exact.next_cursor).toBeNull()
		expect((await page("view=page&limit=100")).receipts).toHaveLength(2)
	})

	test("rejects invalid pagination input without changing the legacy endpoint", async () => {
		for (const query of ["limit=0", "limit=101", "limit=-1", "limit=1.5", "limit=2x", "limit=", "group_id=0", "group_id=abc", "before=nope", "cursor=", "cursor=not-json", "cursor=" + "a".repeat(257), "sort=id"]) {
			expect((await request(`view=page&${query}`)).status).toBe(400)
		}
		for (const cursor of [{ at: "bad", id: 1 }, { at: 1, id: 0 }, { at: 1, id: 1.5 }, { at: 1, id: 1, extra: true }, null, []]) {
			expect((await request(`view=page&cursor=${Buffer.from(JSON.stringify(cursor)).toString("base64url")}`)).status).toBe(400)
		}
		expect(await page()).toEqual({ receipts: [], next_cursor: null })
	})
})
