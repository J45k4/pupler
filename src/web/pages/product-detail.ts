import {
	attachProductDetailEvents,
	fetchProduct,
	renderPage,
	renderProductDetail,
} from "../app";

export const renderProductDetailPage = (params: Record<string, string>) => {
	renderPage('<div id="product-detail-page"></div>');

	void (async () => {
		const rawId = params.id ?? "";
		const productId = Number.parseInt(rawId, 10);
		const page = document.getElementById("product-detail-page");
		if (!page) {
			return;
		}

		if (!Number.isInteger(productId)) {
			page.innerHTML =
				'<div class="card panel page-panel"><p class="page-copy">Product id is invalid.</p></div>';
			return;
		}

		try {
			const product = await fetchProduct(productId);
			renderProductDetail(product);
			attachProductDetailEvents(productId);
		} catch (error) {
			page.innerHTML = `
				<div class="card panel page-panel">
					<p class="page-copy">${error instanceof Error ? error.message : "Failed to load product."}</p>
				</div>
			`;
		}
	})();
};
