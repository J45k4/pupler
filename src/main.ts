import * as routes from "./api";
import { createApiRoutes } from "./api/route-map";
import {
	resolvePuplerVersion,
	versionPayload,
} from "./config";
import { dbPath, filesPath, initializeDatabase } from "./db";

import index from "./web/index.html";

const favicon = Bun.file(new URL("./web/favicon.png", import.meta.url));

const version = resolvePuplerVersion();
const envPort = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : undefined;
const port = Number.isFinite(envPort) ? envPort : 5995;
initializeDatabase();

const apiRoutes = createApiRoutes({
	public: {
		"/api/auth/bootstrap": routes.authBootstrapRoute,
		"/api/auth/login": routes.authLoginRoute,
		"/api/auth/logout": routes.authLogoutRoute,
		"/api/auth/session": routes.authSessionRoute,
	},
	authenticated: {
		"/api/auth/password": routes.authPasswordRoute,
		"/api/groups": routes.groupsCollectionRoute,
		"/api/groups/:id": routes.groupDetailRoute,
		"/api/ingredients": routes.ingredientsCollectionRoute,
		"/api/ingredients/:id": routes.ingredientDetailRoute,
		"/api/products": routes.productsCollectionRoute,
		"/api/product-stats": routes.productStatsRoute,
		"/api/products/:id": routes.productDetailRoute,
		"/api/products/:id/picture": routes.productPictureRoute,
		"/api/product-links": routes.productLinksCollectionRoute,
		"/api/product-links/:id": routes.productLinkDetailRoute,
		"/api/receipts": routes.receiptsCollectionRoute,
		"/api/receipts/:id": routes.receiptDetailRoute,
		"/api/receipts/:id/picture": routes.receiptPictureRoute,
		"/api/receipt-items": routes.receiptItemsCollectionRoute,
		"/api/receipt-items/:id": routes.receiptItemDetailRoute,
		"/api/inventory-containers": routes.inventoryContainersCollectionRoute,
		"/api/inventory-containers/:id": routes.inventoryContainerDetailRoute,
		"/api/inventory-items": routes.inventoryItemsCollectionRoute,
		"/api/inventory-items/:id/pictures": routes.inventoryItemImagesCollectionRoute,
		"/api/inventory-items/:id/pictures/:pictureId": routes.inventoryItemImageDetailRoute,
		"/api/inventory-items/:id": routes.inventoryItemDetailRoute,
		"/api/recipes": routes.recipesCollectionRoute,
		"/api/recipes/:id": routes.recipeDetailRoute,
		"/api/recipes/:id/pictures": routes.recipeImagesCollectionRoute,
		"/api/recipes/:id/pictures/:pictureId": routes.recipeImageDetailRoute,
		"/api/recipe-ingredients": routes.recipeIngredientsCollectionRoute,
		"/api/recipe-ingredients/:id": routes.recipeIngredientDetailRoute,
		"/api/meal-plan-items": routes.mealPlanItemsCollectionRoute,
		"/api/meal-plan-items/:id": routes.mealPlanItemDetailRoute,
		"/api/shopping-list-items": routes.shoppingListItemsCollectionRoute,
		"/api/shopping-list-items/:id": routes.shoppingListItemDetailRoute,
		"/api/todos": routes.todosCollectionRoute,
		"/api/todos/:id": routes.todoDetailRoute,
		"/api/clients": routes.clientsCollectionRoute,
		"/api/clients/:id": routes.clientDetailRoute,
		"/api/projects": routes.projectsCollectionRoute,
		"/api/projects/:id/merge": routes.projectMergeRoute,
		"/api/projects/:id": routes.projectDetailRoute,
		"/api/time-entries": routes.timeEntriesCollectionRoute,
		"/api/time-entries/start": routes.timeEntryStartRoute,
		"/api/time-entries/:id/stop": routes.timeEntryStopRoute,
		"/api/time-entries/:id": routes.timeEntryDetailRoute,
		"/api/time-report": routes.timeReportRoute,
		"/api/spending": routes.spendingRoute,
		"/version": () => Response.json(versionPayload()),
	},
	admin: {
		"/api/users": routes.usersCollectionRoute,
		"/api/users/:id": routes.userDetailRoute,
	},
});

const instance = Bun.serve({
	port,
	routes: {
		...apiRoutes,
		"/health": new Response("ok"),
		"/favicon.png": new Response(favicon, {
			headers: { "Content-Type": "image/png" },
		}),
		"/api/*": Response.json(
			{ error: "Route not found" },
			{ status: 404 },
		),
		"/*": index,
	},
});

console.log(`Pupler ${version} listening on ${instance.url} using ${dbPath} with files at ${filesPath}`);
