import { describe, expect, test } from "bun:test"
import type { PurchaseReceipt } from "../src/react/lib"
import { applyReceiptChanges, mergeReceiptPage, receiptDateBefore, receiptPageParams, receiptTotalsParams } from "../src/react/pages/receipt-page-data"

describe("receipt page data", () => {
	test("confirmed receipts override old pages, follow group/date filters and sort equivalent timezones", () => {
		const receipt = (id: number, group_id: number | null, purchased_at: string) => ({ id, group_id, purchased_at }) as PurchaseReceipt
		const old = receipt(1, null, "2026-10-24T10:00:00Z")
		const moved = { ...old, group_id: 7 }
		const newer = receipt(2, null, "2026-10-24T13:00:00+03:00")
		expect(applyReceiptChanges([old, newer], [moved], "group_id=null")).toEqual([newer])
		expect(applyReceiptChanges([old, newer], [moved], "group_id=7")).toEqual([moved])
		expect(applyReceiptChanges([old], [newer], "").map(item => item.id)).toEqual([2, 1])
		expect(applyReceiptChanges([old], [receipt(3, null, "2026-10-25T00:00:00Z")], "before=2026-10-25T00%3A00%3A00Z")).toEqual([old])
	})
	test("builds consistent page and group filters", () => {
		expect(new URLSearchParams(receiptPageParams("all", "")).toString()).toBe("view=page&limit=40")
		expect(new URLSearchParams(receiptPageParams("ungrouped", "")).get("group_id")).toBe("null")
		expect(new URLSearchParams(receiptPageParams("7", "2026-10-17")).get("before")).toBe(receiptDateBefore("2026-10-17"))
		expect(new URLSearchParams(receiptPageParams("7", "")).get("group_id")).toBe("7")
	})

	test("keeps search and summary filters consistent without carrying pagination into totals", () => {
		const params = receiptPageParams("7", "2026-10-17", " Käpylän Market ")
		expect(new URLSearchParams(params).get("q")).toBe("Käpylän Market")
		const summary = new URLSearchParams(receiptTotalsParams(`${params}&cursor=older`))
		expect(summary.get("view")).toBe("totals")
		expect(summary.get("group_id")).toBe("7")
		expect(summary.get("before")).toBe(receiptDateBefore("2026-10-17"))
		expect(summary.get("q")).toBe("Käpylän Market")
		expect(summary.has("limit")).toBe(false)
		expect(summary.has("cursor")).toBe(false)
		expect(new URLSearchParams(receiptPageParams("all", "", "  ")).has("q")).toBe(false)
	})

	test("confirmed changes enter or leave store and receipt-number search results", () => {
		const first = { id: 12, store_name: "KÄPYLÄN Market", purchased_at: "2026-10-24T10:00:00Z", group_id: null } as PurchaseReceipt
		const second = { ...first, id: 13, store_name: "Apteekki" }
		expect(applyReceiptChanges([first, second], [], "q=k%C3%A4pyl%C3%A4n")).toEqual([first])
		expect(applyReceiptChanges([first], [{ ...first, store_name: "Renamed" }], "q=market")).toEqual([])
		expect(applyReceiptChanges([first, second], [], "q=%2313")).toEqual([second])
	})

	test("includes the whole selected local date, handles daylight saving, and rejects invalid dates", () => {
		// Bun caches timezone changes even after TZ is deleted, so isolate this check.
		const source = `
			import { receiptDateBefore } from ${JSON.stringify(new URL("../src/react/pages/receipt-page-data.ts", import.meta.url).href)}
			console.log(JSON.stringify(["2026-10-24", "2026-10-25", "2026-03-28", "2026-03-29"].map(receiptDateBefore)))
		`
		const result = Bun.spawnSync([process.execPath, "-e", source], { env: { ...process.env, TZ: "Europe/Helsinki" }, stdout: "pipe", stderr: "pipe" })
		expect(result.exitCode).toBe(0)
		const [fallStart, fallEnd, springStart, springEnd] = JSON.parse(result.stdout.toString()) as [string, string, string, string]
		expect(fallEnd).toBe("2026-10-25T22:00:00.000Z")
		expect(Date.parse(fallEnd) - Date.parse(fallStart)).toBe(25 * 60 * 60 * 1000)
		expect(Date.parse(springEnd) - Date.parse(springStart)).toBe(23 * 60 * 60 * 1000)
		expect(receiptDateBefore("")).toBeNull()
		for (const value of ["nope", "2026-02-30", "2026-13-01", "2026-1-1"]) expect(() => receiptDateBefore(value)).toThrow("Invalid receipt date")
	})

	test("merges by ID without duplicating receipts or replacing unchanged objects", () => {
		const first = { id: 3, store_name: "First" } as PurchaseReceipt
		const second = { id: 2, store_name: "Second" } as PurchaseReceipt
		const updated = { ...second, store_name: "Updated" }
		const older = { id: 1, store_name: "Older" } as PurchaseReceipt
		const merged = mergeReceiptPage([first, second], [updated, older])
		expect(merged).toEqual([first, updated, older])
		expect(merged[0]).toBe(first)
		expect(merged[1]).toBe(updated)
		expect(mergeReceiptPage(merged, [older])).toEqual(merged)
	})
})
