import type { PurchaseReceipt } from "../lib"

export type ReceiptPage = { receipts: PurchaseReceipt[]; next_cursor: string | null }
export const RECEIPT_PAGE_SIZE = 40

export const receiptDateBefore = (date: string) => {
	if (!date) return null
	const end = new Date(`${date}T00:00:00`)
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(end.getTime()) || `${String(end.getFullYear()).padStart(4, "0")}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}` !== date) throw new Error("Invalid receipt date")
	end.setDate(end.getDate() + 1)
	return end.toISOString()
}

export const receiptPageParams = (group: string, date: string) => {
	const params = new URLSearchParams({ view: "page", limit: String(RECEIPT_PAGE_SIZE) })
	if (group !== "all") params.set("group_id", group === "ungrouped" ? "null" : group)
	const before = receiptDateBefore(date)
	if (before) params.set("before", before)
	return params.toString()
}

export const mergeReceiptPage = (existing: PurchaseReceipt[], incoming: PurchaseReceipt[]) => {
	const byId = new Map(existing.map((receipt) => [receipt.id, receipt]))
	for (const receipt of incoming) byId.set(receipt.id, receipt)
	return [...byId.values()]
}
