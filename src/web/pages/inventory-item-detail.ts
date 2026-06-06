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

export const renderInventoryItemDetailPage = (params: Record<string, string>) => {
	renderPage('<div id="inventory-item-detail-page"></div>');

	void (async () => {
		const rawId = params.id ?? "";
		const itemId = Number.parseInt(rawId, 10);
		const page = document.getElementById("inventory-item-detail-page");
		if (!page) {
			return;
		}

		if (!Number.isInteger(itemId)) {
			page.innerHTML =
				'<div class="card panel page-panel"><p class="page-copy">Inventory item id is invalid.</p></div>';
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
			renderInventoryItemDetail(item, container, products, receiptItems, receipts);
			attachInventoryItemDetailEvents(
				item,
				container,
				products,
				receiptItems,
				receipts,
			);
		} catch (error) {
			page.innerHTML = `
				<div class="card panel page-panel">
					<p class="page-copy">${error instanceof Error ? error.message : "Failed to load inventory item."}</p>
				</div>
			`;
		}
	})();
};
