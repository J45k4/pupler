import {
	attachReceiptDetailEvents,
	fetchAllProducts,
	fetchGroups,
	fetchReceipt,
	fetchReceiptItems,
	renderPage,
	renderReceiptDetail,
} from "../app";

export const renderReceiptDetailPage = (params: Record<string, string>) => {
	renderPage('<div id="receipt-detail-page"></div>');

	void (async () => {
		const rawId = params.id ?? "";
		const receiptId = Number.parseInt(rawId, 10);
		if (!Number.isInteger(receiptId)) {
			const page = document.getElementById("receipt-detail-page");
			if (page) {
				page.innerHTML =
					'<div class="card panel page-panel"><p class="page-copy">Receipt id is invalid.</p></div>';
			}
			return;
		}

		try {
			const [receipt, items, products, groups] = await Promise.all([
				fetchReceipt(receiptId),
				fetchReceiptItems(receiptId),
				fetchAllProducts(),
				fetchGroups(),
			]);
			renderReceiptDetail(receipt, items, products, groups);
			attachReceiptDetailEvents(receipt, items, products, groups);
		} catch (error) {
			const page = document.getElementById("receipt-detail-page");
			if (page) {
				page.innerHTML = `
					<div class="card panel page-panel">
						<p class="page-copy">${error instanceof Error ? error.message : "Failed to load receipt."}</p>
					</div>
				`;
			}
		}
	})();
};
