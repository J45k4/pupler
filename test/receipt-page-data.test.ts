import { describe, expect, test } from "bun:test"
import type { PurchaseReceipt } from "../src/react/lib"
import { mergeReceiptPage, receiptDateBefore, receiptPageParams } from "../src/react/pages/receipt-page-data"

describe("receipt page data", () => {
	test("builds consistent page and group filters", () => {
		expect(new URLSearchParams(receiptPageParams("all", "")).toString()).toBe("view=page&limit=40")
		expect(new URLSearchParams(receiptPageParams("ungrouped", "")).get("group_id")).toBe("null")
		expect(new URLSearchParams(receiptPageParams("7", "2026-10-17")).get("before")).toBe(receiptDateBefore("2026-10-17"))
		expect(new URLSearchParams(receiptPageParams("7", "")).get("group_id")).toBe("7")
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
