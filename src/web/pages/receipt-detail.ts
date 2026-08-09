import {
	attachReceiptDetailEvents,
	fetchAllProducts,
	fetchGroups,
	fetchReceipt,
	fetchReceiptItems,
	renderPage,
	renderReceiptDetail,
} from "../app"
import { createElement, createPageMessage, withQueryRoot } from "../lib/dom"

export const renderReceiptDetailPage = async (
	params: Record<string, string>,
) => {
	const receiptId = Number.parseInt(params.id ?? "", 10)
	const page = createElement("div", { id: "receipt-detail-page" })
	if (!Number.isInteger(receiptId)) {
		page.append(createPageMessage("Receipt id is invalid."))
		renderPage(page)
		return
	}

	try {
		const [receipt, items, products, groups] = await Promise.all([
			fetchReceipt(receiptId),
			fetchReceiptItems(receiptId),
			fetchAllProducts(),
			fetchGroups(),
		])
		withQueryRoot(page, () => {
			renderReceiptDetail(receipt, items, products, groups)
			attachReceiptDetailEvents(receipt, items, products, groups)
		})
	} catch (error) {
		page.append(
			createPageMessage(
				error instanceof Error
					? error.message
					: "Failed to load receipt.",
			),
		)
	}
	renderPage(page)
}
