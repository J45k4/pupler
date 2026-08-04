import {
	attachProductDetailEvents,
	fetchProduct,
	renderPage,
	renderProductDetail,
} from "../app"
import { createElement, createPageMessage, withQueryRoot } from "../lib/dom"

export const renderProductDetailPage = async (
	params: Record<string, string>,
) => {
	const productId = Number.parseInt(params.id ?? "", 10)
	const page = createElement("div", { id: "product-detail-page" })
	if (!Number.isInteger(productId)) {
		page.append(createPageMessage("Product id is invalid."))
		renderPage(page)
		return
	}

	try {
		const product = await fetchProduct(productId)
		withQueryRoot(page, () => {
			renderProductDetail(product)
			attachProductDetailEvents(productId)
		})
	} catch (error) {
		page.append(
			createPageMessage(
				error instanceof Error
					? error.message
					: "Failed to load product.",
			),
		)
	}
	renderPage(page)
}
