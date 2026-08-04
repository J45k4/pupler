import {
	attachInventoryItemDetailEvents,
	fetchAllProducts,
	fetchAllReceiptItems,
	fetchInventoryContainer,
	fetchInventoryItem,
	fetchReceipts,
	renderInventoryItemDetail,
	renderPage,
} from "../app";
import type { InventoryContainer } from "../app";
import { createElement, createPageMessage, withQueryRoot } from "../lib/dom";

export const renderInventoryItemDetailPage = async (
	params: Record<string, string>,
) => {
	const itemId = Number.parseInt(params.id ?? "", 10);
	const page = createElement("div", { id: "inventory-item-detail-page" });
	if (!Number.isInteger(itemId)) {
		page.append(createPageMessage("Inventory item id is invalid."));
		renderPage(page);
		return;
	}

	try {
		const [item, products, receiptItems, receipts] = await Promise.all([
			fetchInventoryItem(itemId),
			fetchAllProducts(),
			fetchAllReceiptItems(),
			fetchReceipts(),
		]);
		let container: InventoryContainer | null = null;
		if (item.container_id !== null) {
			try {
				container = await fetchInventoryContainer(item.container_id);
			} catch {
				container = null;
			}
		}
		withQueryRoot(page, () => {
			renderInventoryItemDetail(item, container, products, receiptItems, receipts);
			attachInventoryItemDetailEvents(
				item,
				container,
				products,
				receiptItems,
				receipts,
			);
		});
	} catch (error) {
		page.append(
			createPageMessage(
				error instanceof Error ? error.message : "Failed to load inventory item.",
			),
		);
	}
	renderPage(page);
};
