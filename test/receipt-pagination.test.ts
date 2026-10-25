import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { closeDatabase, createApiRoutes, openDatabase, receiptsCollectionRoute } from "../src/api"
import { setDatabase } from "../src/db"
import { applyTestSchema } from "./support/test-db"
import type { ReceiptGroupTotal, ReceiptPage } from "../src/react/pages/receipt-page-data"

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

	const receipt = (purchased_at: string, group_id: number | null = null, values: { store_name?: string; currency?: string; total_amount?: number | null } = {}) => database.client.receipt.create({ data: { store_name: "Pagination test", purchased_at, group_id, currency: "EUR", total_amount: 12.5, created_at: now, updated_at: now, ...values } })
	const request = (query = "view=page") => handler(new Request(`http://localhost/api/receipts?${query}`))
	const page = async (query = "view=page"): Promise<ReceiptPage> => {
		const response = await request(query)
		expect(response.status).toBe(200)
		return response.json()
	}
	const totals = async (query = ""): Promise<ReceiptGroupTotal[]> => {
		const response = await request(`view=totals&${query}`)
		expect(response.status).toBe(200)
		return response.json()
	}

	test("searches stores and receipt numbers across older pages with literal text and Finnish case folding", async () => {
		await Promise.all(Array.from({ length: 45 }, () => receipt(now)))
		const older = await receipt("2026-09-01T00:00:00Z", null, { store_name: "KÄPYLÄN Market" })
		const newest = await receipt("2026-09-02T00:00:00Z", null, { store_name: "Käpylän market" })
		const search = "view=page&limit=1&q=" + encodeURIComponent(" KÄPYLÄN ")
		const first = await page(search)
		expect(first.receipts.map(item => item.id)).toEqual([newest.id])
		const second = await page(`${search}&cursor=${first.next_cursor}`)
		expect(second.receipts.map(item => item.id)).toEqual([older.id])
		expect(second.next_cursor).toBeNull()
		expect((await page(`view=page&q=%23${older.id}`)).receipts.map(item => item.id)).toEqual([older.id])
		expect((await page(`view=page&q=${older.id}`)).receipts.map(item => item.id)).toEqual([older.id])
		const special = await receipt(now, null, { store_name: "100%_shop's" })
		for (const query of ["%", "_", "shop's"]) expect((await page(`view=page&q=${encodeURIComponent(query)}`)).receipts.map(item => item.id)).toEqual([special.id])
		expect((await page("view=page&q=missing")).receipts).toEqual([])
	})

	test("totals include the full matching dataset, separate currencies, and distinguish missing amounts from zero", async () => {
		const group = await database.client.group.create({ data: { name: "Groceries", created_at: now, updated_at: now } })
		await Promise.all(Array.from({ length: 45 }, () => receipt(now, group.id, { total_amount: 0.1 })))
		await receipt(now, group.id, { total_amount: null })
		await receipt(now, group.id, { total_amount: 0 })
		await receipt(now, group.id, { total_amount: -1 })
		await receipt(now, group.id, { total_amount: 8, currency: "USD" })
		await receipt(now, null, { total_amount: null })
		expect((await page()).receipts).toHaveLength(40)
		const summary = await totals()
		const euros = summary.find(row => row.group_id === group.id && row.currency === "EUR")!
		expect(euros.receipt_count).toBe(48)
		expect(euros.unknown_count).toBe(1)
		expect(euros.total_amount).toBeCloseTo(3.5)
		expect(summary.find(row => row.group_id === group.id && row.currency === "USD")).toEqual({ group_id: group.id, currency: "USD", total_amount: 8, receipt_count: 1, unknown_count: 0 })
		expect(summary.find(row => row.group_id === null)).toEqual({ group_id: null, currency: "EUR", total_amount: null, receipt_count: 1, unknown_count: 1 })
	})

	test("search, group and date filters constrain pages and totals consistently, including after moves", async () => {
		const group = await database.client.group.create({ data: { name: "Care", created_at: now, updated_at: now } })
		const selected = await receipt("2026-10-15T00:00:00Z", group.id, { store_name: "Apteekki", total_amount: 20 })
		await receipt("2026-10-18T00:00:00Z", group.id, { store_name: "Apteekki", total_amount: 30 })
		await receipt("2026-10-15T00:00:00Z", group.id, { store_name: "Market", total_amount: 40 })
		await receipt("2026-10-15T00:00:00Z", null, { store_name: "Apteekki", total_amount: 50 })
		const filters = `group_id=${group.id}&q=APTEEKKI&before=2026-10-17T00%3A00%3A00Z`
		expect((await page(`view=page&${filters}`)).receipts.map(item => item.id)).toEqual([selected.id])
		expect(await totals(filters)).toEqual([{ group_id: group.id, currency: "EUR", total_amount: 20, receipt_count: 1, unknown_count: 0 }])
		await database.client.receipt.update({ where: { id: selected.id }, data: { group_id: null } })
		expect(await totals(filters)).toEqual([])
		expect(await totals("group_id=null&q=Apteekki")).toEqual([{ group_id: null, currency: "EUR", total_amount: 70, receipt_count: 2, unknown_count: 0 }])
		for (const view of ["page", "totals"]) expect((await request(`view=${view}&q=${"a".repeat(201)}`)).status).toBe(400)
		for (const query of ["cursor=nope", "limit=40", "group_id=0", "before=nope"]) expect((await request(`view=totals&${query}`)).status).toBe(400)
	})

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
