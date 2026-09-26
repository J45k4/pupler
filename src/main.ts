import * as routes from "./api"
import { createApiRoutes } from "./api/route-map"
import { resolvePuplerVersion, versionPayload } from "./config"
import { dbPath, filesPath, initializeDatabase } from "./db"
import { oauthRoute, connectionsRoute } from "./oauth/routes"
import { mcpRoute } from "./mcp/server"
import { cleanupUploads, uploadRoute } from "./mcp/uploads"

import index from "./web/index.html"
import reactIndex from "./react/index.html"

import faviconPath from "./web/favicon.png" with { type: "file" }
const favicon = Bun.file(faviconPath)

const version = resolvePuplerVersion()
const envPort = process.env.PORT
	? Number.parseInt(process.env.PORT, 10)
	: undefined
const port = Number.isFinite(envPort) ? envPort : 5995
const database = initializeDatabase()
setInterval(() => { void cleanupUploads().catch(() => console.error("MCP upload cleanup failed")) }, 60_000).unref()

if (process.env.PUPLER_DISABLE_JOB_WORKER !== "true") {
	void routes.startJobWorker(database)
}

const apiRoutes = createApiRoutes({
	public: {
		"/api/auth/login": routes.authLoginRoute,
		"/api/auth/logout": routes.authLogoutRoute,
		"/api/auth/session": routes.authSessionRoute,
	},
	authenticated: {
		"/api/auth/connections": connectionsRoute,
		"/api/auth/connections/:id": connectionsRoute,
		"/api/auth/api-keys": routes.apiKeysCollectionRoute,
		"/api/auth/api-keys/:id": routes.apiKeyDetailRoute,
		"/api/auth/password": routes.authPasswordRoute,
		"/api/external-integrations": routes.externalIntegrationsCollectionRoute(database),
		"/api/external-integrations/clockify": routes.clockifyIntegrationRoute(database),
		"/api/external-integrations/:id/clockify-options": routes.clockifyIntegrationOptionsRoute(database),
		"/api/external-integrations/:id": routes.externalIntegrationDetailRoute(database),
		"/api/import-schedules": routes.importSchedulesCollectionRoute(database),
		"/api/import-schedules/:id/run": routes.importScheduleRunRoute(database),
		"/api/import-schedules/:id": routes.importScheduleDetailRoute(database),
		"/api/jobs": routes.jobsCollectionRoute(database),
		"/api/jobs/events": routes.jobEventsRoute(database),
		"/api/jobs/:id": routes.jobDetailRoute(database),
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
		"/api/inventory-items/:id/pictures":
			routes.inventoryItemImagesCollectionRoute,
		"/api/inventory-items/:id/pictures/:pictureId":
			routes.inventoryItemImageDetailRoute,
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
		"/api/update": routes.updateStatusRoute,
		"/api/users": routes.usersCollectionRoute,
		"/api/users/:id": routes.userDetailRoute,
	},
})

const instance = Bun.serve({
	port,
	hostname: process.env.BIND_ADDRESS ?? "0.0.0.0",
	development: process.env.NODE_ENV !== "production" && {
		hmr: true,
		console: true,
	},
	routes: {
		...apiRoutes,
		"/.well-known/oauth-protected-resource": oauthRoute,
		"/.well-known/oauth-protected-resource/mcp": oauthRoute,
		"/.well-known/oauth-authorization-server": oauthRoute,
		"/oauth/authorize": oauthRoute,
		"/oauth/register": oauthRoute,
		"/oauth/token": oauthRoute,
		"/oauth/revoke": oauthRoute,
		"/mcp": mcpRoute,
		"/mcp/uploads/:token": uploadRoute,
		"/health": new Response("ok"),
		"/favicon.png": new Response(favicon, {
			headers: { "Content-Type": "image/png" },
		}),
		"/api/*": Response.json({ error: "Route not found" }, { status: 404 }),
		"/time": reactIndex,
		"/time/overview": reactIndex,
		"/time/weekly": reactIndex,
		"/time/monthly": reactIndex,
		"/settings": reactIndex,
		"/mcp/connections": reactIndex,
		"/react/time": new Response("Not found", { status: 404 }),
		"/react/time/*": new Response("Not found", { status: 404 }),
		"/react/settings": new Response("Not found", { status: 404 }),
		"/react/settings/*": new Response("Not found", { status: 404 }),
		"/react/mcp/connections": new Response("Not found", { status: 404 }),
		"/react/mcp/connections/*": new Response("Not found", { status: 404 }),
		"/react": reactIndex,
		"/react/*": reactIndex,
		"/*": index,
	},
})

console.log(
	`Pupler ${version} listening on ${instance.url} using ${dbPath} with files at ${filesPath}`,
)
