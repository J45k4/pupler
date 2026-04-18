import {
	ingredientDetailRoute,
	ingredientsCollectionRoute,
	inventoryContainerDetailRoute,
	inventoryContainersCollectionRoute,
	inventoryItemDetailRoute,
	inventoryItemsCollectionRoute,
	mealPlanItemDetailRoute,
	mealPlanItemsCollectionRoute,
	openDatabase,
	productDetailRoute,
	productLinkDetailRoute,
	productLinksCollectionRoute,
	productPictureRoute,
	productsCollectionRoute,
	receiptItemDetailRoute,
	receiptItemsCollectionRoute,
	receiptDetailRoute,
	receiptPictureRoute,
	receiptsCollectionRoute,
	recipeDetailRoute,
	recipeImageDetailRoute,
	recipeIngredientDetailRoute,
	recipeImagesCollectionRoute,
	recipeIngredientsCollectionRoute,
	recipesCollectionRoute,
	shoppingListItemDetailRoute,
	shoppingListItemsCollectionRoute,
} from "./api";

import index from "./web/index.html";

const notFoundPage = Bun.file(new URL("./web/404.html", import.meta.url));

type ServerOptions = {
	dbPath?: string;
	port?: number;
};

const resolveDatabasePath = (override?: string) =>
	override ?? process.env.DB_PATH ?? process.env.DATABASE_URL ?? "pupler.db";

export const server = (options: ServerOptions = {}) => {
	const dbPath = resolveDatabasePath(options.dbPath);
	const envPort = process.env.PORT
		? Number.parseInt(process.env.PORT, 10)
		: undefined;
	const port = options.port ?? (Number.isFinite(envPort) ? envPort : 5995);
	const db = openDatabase(dbPath);

	return Bun.serve({
		port,
		routes: {
			"/api/ingredients": ingredientsCollectionRoute(db),
			"/api/ingredients/:id": ingredientDetailRoute(db),
			"/api/products": productsCollectionRoute(db),
			"/api/products/:id": productDetailRoute(db),
			"/api/products/:id/picture": productPictureRoute(db),
			"/api/product-links": productLinksCollectionRoute(db),
			"/api/product-links/:id": productLinkDetailRoute(db),
			"/api/receipts": receiptsCollectionRoute(db),
			"/api/receipts/:id": receiptDetailRoute(db),
			"/api/receipts/:id/picture": receiptPictureRoute(db),
			"/api/receipt-items": receiptItemsCollectionRoute(db),
			"/api/receipt-items/:id": receiptItemDetailRoute(db),
			"/api/inventory-containers": inventoryContainersCollectionRoute(db),
			"/api/inventory-containers/:id": inventoryContainerDetailRoute(db),
			"/api/inventory-items": inventoryItemsCollectionRoute(db),
			"/api/inventory-items/:id": inventoryItemDetailRoute(db),
			"/api/recipes": recipesCollectionRoute(db),
			"/api/recipes/:id": recipeDetailRoute(db),
			"/api/recipes/:id/pictures": recipeImagesCollectionRoute(db),
			"/api/recipes/:id/pictures/:pictureId": recipeImageDetailRoute(db),
			"/api/recipe-ingredients": recipeIngredientsCollectionRoute(db),
			"/api/recipe-ingredients/:id": recipeIngredientDetailRoute(db),
			"/api/meal-plan-items": mealPlanItemsCollectionRoute(db),
			"/api/meal-plan-items/:id": mealPlanItemDetailRoute(db),
			"/api/shopping-list-items": shoppingListItemsCollectionRoute(db),
			"/api/shopping-list-items/:id": shoppingListItemDetailRoute(db),
			"/health": new Response("ok"),
			"/api/*": Response.json(
				{ error: "Route not found" },
				{ status: 404 },
			),
			"/": index,
			"/inventory": index,
			"/inventory/containers/:id": index,
			"/products": index,
			"/products/:id": index,
			"/receipts": index,
			"/receipts/:id": index,
			"/shopping-lists": index,
			"/recipes": index,
			"/recipes/new": index,
			"/recipes/:id": index,
			"/*": new Response(notFoundPage, {
				status: 404,
				headers: { "Content-Type": "text/html; charset=utf-8" },
			}),
		},
	});
};

if (import.meta.main) {
	const version = process.env.APP_VERSION ?? "dev";
	const dbPath = resolveDatabasePath();
	const instance = server({ dbPath });
	console.log(
		`Pupler ${version} listening on ${instance.url} using ${dbPath}`,
	);
}
