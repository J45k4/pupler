import {
	installLinkInterceptor,
	routes,
	setRouteShellRenderer,
} from "./router";
import { renderAppShell } from "./app";
import { renderOverviewPage } from "./pages/overview";
import {
	renderSpendingItemsPage,
	renderSpendingMonthlyPage,
	renderSpendingPage,
} from "./pages/spending";
import { renderExpirationsPage } from "./pages/expirations";
import { renderRecipesPage } from "./pages/recipes";
import { renderRecipeDetailPage } from "./pages/recipe-detail";
import { renderRecipeCreatePage } from "./pages/recipe-create";
import { renderProductsPage } from "./pages/products";
import { renderProductDetailPage } from "./pages/product-detail";
import { renderInventoryPage } from "./pages/inventory";
import { renderInventoryItemDetailPage } from "./pages/inventory-item-detail";
import { renderInventoryContainerDetailPage } from "./pages/inventory-container-detail";
import { renderReceiptsPage } from "./pages/receipts";
import { renderShoppingListsPage } from "./pages/shopping-lists";
import { renderTimeOverviewPage, renderTimePage } from "./pages/time";
import { renderTodosPage } from "./pages/todos";
import { renderGroupDetailPage } from "./pages/group-detail";
import { renderReceiptDetailPage } from "./pages/receipt-detail";
import { renderNotFoundPage } from "./pages/not-found";

window.onload = () => {
	installLinkInterceptor(document.body);
	setRouteShellRenderer(renderAppShell);

	routes({
		"/": renderOverviewPage,
		"/expirations": renderExpirationsPage,
		"/inventory": renderInventoryPage,
		"/inventory/containers/:id": (_main, params) =>
			renderInventoryContainerDetailPage(params),
		"/inventory/items/:id": (_main, params) =>
			renderInventoryItemDetailPage(params),
		"/groups/:id": (_main, params) => renderGroupDetailPage(params),
		"/products": renderProductsPage,
		"/products/:id": (_main, params) => renderProductDetailPage(params),
		"/receipts": renderReceiptsPage,
		"/receipts/:id": (_main, params) => renderReceiptDetailPage(params),
		"/spending": renderSpendingPage,
		"/spending/monthly": renderSpendingMonthlyPage,
		"/spending/items": renderSpendingItemsPage,
		"/shoppinglist": renderShoppingListsPage,
		"/todos": renderTodosPage,
		"/time": renderTimePage,
		"/time/overview": renderTimeOverviewPage,
		"/recipes/new": renderRecipeCreatePage,
		"/recipes/:id": (_main, params) => renderRecipeDetailPage(params),
		"/recipes": renderRecipesPage,
		"/*": renderNotFoundPage,
	});
};
