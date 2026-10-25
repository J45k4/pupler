import type { PurchaseReceipt } from "../lib"

export type ReceiptPage = { receipts: PurchaseReceipt[]; next_cursor: string | null }
export type ReceiptGroupTotal = { group_id: number | null; currency: string; total_amount: number | null; receipt_count: number; unknown_count: number }
export const RECEIPT_PAGE_SIZE = 40

export const receiptCutoffDate = (now = new Date()) => {
	const cutoff = new Date(now)
	cutoff.setHours(0, 0, 0, 0)
	cutoff.setDate(cutoff.getDate() - 30)
	return cutoff
}

export const receiptCutoffIndex = (receipts: PurchaseReceipt[], cutoff: Date) => receipts.findIndex(receipt => Date.parse(receipt.purchased_at) < cutoff.getTime())

export const receiptDateBefore = (date: string) => {
	if (!date) return null
	const end = new Date(`${date}T00:00:00`)
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(end.getTime()) || `${String(end.getFullYear()).padStart(4, "0")}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}` !== date) throw new Error("Invalid receipt date")
	end.setDate(end.getDate() + 1)
	return end.toISOString()
}

export const receiptPageParams = (group: string, date: string, search = "") => {
	const params = new URLSearchParams({ view: "page", limit: String(RECEIPT_PAGE_SIZE) })
	if (group !== "all") params.set("group_id", group === "ungrouped" ? "null" : group)
	const before = receiptDateBefore(date)
	if (before) params.set("before", before)
	if (search.trim()) params.set("q", search.trim())
	return params.toString()
}

export const receiptTotalsParams = (params: string) => {
	const query = new URLSearchParams(params)
	query.set("view", "totals")
	query.delete("limit")
	query.delete("cursor")
	return query.toString()
}

export const receiptGroupPageParams = (params: string, groupId: number | null) => {
	const query = new URLSearchParams(params)
	query.set("group_id", groupId === null ? "null" : String(groupId))
	query.set("limit", "10")
	query.delete("cursor")
	return query.toString()
}

export const receiptMatchesSearch = (receipt: PurchaseReceipt, search: string) => {
	const query = search.trim().toLowerCase()
	return !query || receipt.store_name.toLowerCase().includes(query) || String(receipt.id) === query.replace(/^#/, "")
}

export const mergeReceiptPage = (existing: PurchaseReceipt[], incoming: PurchaseReceipt[]) => {
	const byId = new Map(existing.map((receipt) => [receipt.id, receipt]))
	for (const receipt of incoming) byId.set(receipt.id, receipt)
	return [...byId.values()]
}

export const applyReceiptChanges = (existing: PurchaseReceipt[], changes: PurchaseReceipt[], params: string) => {
	const query = new URLSearchParams(params)
	const group = query.get("group_id")
	const before = query.get("before")
	const search = query.get("q") ?? ""
	return mergeReceiptPage(existing, changes).filter(item =>
		(group === null || (group === "null" ? item.group_id === null : String(item.group_id) === group)) &&
		(before === null || Date.parse(item.purchased_at) < Date.parse(before)) && receiptMatchesSearch(item, search),
	).sort((a, b) => Date.parse(b.purchased_at) - Date.parse(a.purchased_at) || b.id - a.id)
}
