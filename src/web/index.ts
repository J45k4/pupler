import { installLinkInterceptor, routes } from "./router";
import { renderOverviewPage } from "./pages/overview";
import { renderSpendingPage } from "./pages/spending";
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
import { renderTimePage } from "./pages/time";
import { renderTodosPage } from "./pages/todos";
import { renderGroupDetailPage } from "./pages/group-detail";
import { renderReceiptDetailPage } from "./pages/receipt-detail";
import { renderNotFoundPage } from "./pages/not-found";

window.onload = () => {
	installLinkInterceptor(document.body);

	routes({
		"/": renderOverviewPage,
		"/expirations": renderExpirationsPage,
		"/inventory": renderInventoryPage,
		"/inventory/containers/:id": renderInventoryContainerDetailPage,
		"/inventory/items/:id": renderInventoryItemDetailPage,
		"/groups/:id": renderGroupDetailPage,
		"/products": renderProductsPage,
		"/products/:id": renderProductDetailPage,
		"/receipts": renderReceiptsPage,
		"/receipts/:id": renderReceiptDetailPage,
		"/spending": renderSpendingPage,
		"/shoppinglist": renderShoppingListsPage,
		"/todos": renderTodosPage,
		"/time": renderTimePage,
		"/recipes/new": renderRecipeCreatePage,
		"/recipes/:id": renderRecipeDetailPage,
		"/recipes": renderRecipesPage,
		"/*": renderNotFoundPage,
	});
};
