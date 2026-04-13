import {
	createCollectionRoute,
	createDetailRoute,
	createProductPictureRoute,
	openDatabase,
} from "./api";

import index from "./web/index.html";

const notFoundPage = Bun.file(new URL("./web/404.html", import.meta.url));

type ServerOptions = {
	dbPath?: string;
	port?: number;
};

export const server = (options: ServerOptions = {}) => {
	const dbPath = options.dbPath ?? process.env.DB_PATH ?? "pupler.db";
	const envPort = process.env.PORT
		? Number.parseInt(process.env.PORT, 10)
		: undefined;
	const port = options.port ?? (Number.isFinite(envPort) ? envPort : 5995);
	const db = openDatabase(dbPath);

	return Bun.serve({
		port,
		routes: {
			"/api/products": createCollectionRoute(db, "products"),
			"/api/products/:id": createDetailRoute(db, "products"),
			"/api/products/:id/picture": createProductPictureRoute(db),
			"/api/product-links": createCollectionRoute(db, "product-links"),
			"/api/product-links/:id": createDetailRoute(db, "product-links"),
			"/api/purchase-receipts": createCollectionRoute(
				db,
				"purchase-receipts",
			),
			"/api/purchase-receipts/:id": createDetailRoute(
				db,
				"purchase-receipts",
			),
			"/api/purchase-receipt-items": createCollectionRoute(
				db,
				"purchase-receipt-items",
			),
			"/api/purchase-receipt-items/:id": createDetailRoute(
				db,
				"purchase-receipt-items",
			),
			"/api/inventory-items": createCollectionRoute(
				db,
				"inventory-items",
			),
			"/api/inventory-items/:id": createDetailRoute(
				db,
				"inventory-items",
			),
			"/api/recipes": createCollectionRoute(db, "recipes"),
			"/api/recipes/:id": createDetailRoute(db, "recipes"),
			"/api/recipe-ingredients": createCollectionRoute(
				db,
				"recipe-ingredients",
			),
			"/api/recipe-ingredients/:id": createDetailRoute(
				db,
				"recipe-ingredients",
			),
			"/api/meal-plan-items": createCollectionRoute(
				db,
				"meal-plan-items",
			),
			"/api/meal-plan-items/:id": createDetailRoute(
				db,
				"meal-plan-items",
			),
			"/api/shopping-list-items": createCollectionRoute(
				db,
				"shopping-list-items",
			),
			"/api/shopping-list-items/:id": createDetailRoute(
				db,
				"shopping-list-items",
			),
			"/health": new Response("ok"),
			"/api/*": Response.json(
				{ error: "Route not found" },
				{ status: 404 },
			),
			"/": index,
			"/products": index,
			"/shopping-lists": index,
			"/recipes": index,
			"/*": new Response(notFoundPage, {
				status: 404,
				headers: { "Content-Type": "text/html; charset=utf-8" },
			}),
		},
	});
};

if (import.meta.main) {
	const dbPath = process.env.DB_PATH ?? "pupler.db";
	const instance = server({ dbPath });
	console.log(`Pupler API listening on ${instance.url} using ${dbPath}`);
}
