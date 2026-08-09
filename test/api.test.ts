import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, test } from "bun:test"

import {
	authLoginRoute,
	authLogoutRoute,
	authPasswordRoute,
	authSessionRoute,
	clockifyIntegrationRoute,
	clockifyIntegrationOptionsRoute,
	closeDatabase,
	externalIntegrationDetailRoute,
	externalIntegrationsCollectionRoute,
	groupDetailRoute,
	groupsCollectionRoute,
	ingredientDetailRoute,
	ingredientsCollectionRoute,
	importScheduleDetailRoute,
	importScheduleRunRoute,
	importSchedulesCollectionRoute,
	inventoryContainerDetailRoute,
	inventoryContainersCollectionRoute,
	inventoryItemDetailRoute,
	inventoryItemImageDetailRoute,
	inventoryItemImagesCollectionRoute,
	inventoryItemsCollectionRoute,
	openDatabase,
	productDetailRoute,
	productLinkDetailRoute,
	productLinksCollectionRoute,
	productPictureRoute,
	productStatsRoute,
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
	spendingRoute,
	jobDetailRoute,
	jobsCollectionRoute,
	nextScheduleRunAt,
	timeEntriesCollectionRoute,
	timeEntryDetailRoute,
	timeEntryStartRoute,
	timeEntryStopRoute,
	clientDetailRoute,
	clientsCollectionRoute,
	createApiRoutes,
	projectDetailRoute,
	projectMergeRoute,
	projectsCollectionRoute,
	timeReportRoute,
	todoDetailRoute,
	todosCollectionRoute,
	userDetailRoute,
	usersCollectionRoute,
	wakeJobWorker,
} from "../src/api"
import {
	resolveDatabasePath,
	resolveFilesPath,
	versionPayload,
} from "../src/config"
import { setDatabase } from "../src/db"
import { applyTestSchema } from "./support/test-db"

const dbs: ReturnType<typeof openDatabase>[] = []
const tempDirs: string[] = []

afterEach(async () => {
	const db = dbs.pop()
	if (db) {
		await closeDatabase(db)
	}

	const tempDir = tempDirs.pop()
	if (tempDir) {
		rmSync(tempDir, { force: true, recursive: true })
	}
})

const createRoutes = () => {
	const tempDir = mkdtempSync(join(tmpdir(), "pupler-api-"))
	const dbPath = join(tempDir, "pupler.sqlite")
	const filesPath = join(tempDir, "files")
	tempDirs.push(tempDir)
	applyTestSchema(dbPath)

	const db = openDatabase(dbPath, filesPath)
	dbs.push(db)
	setDatabase(db)

	return {
		db,
		filesPath: db.filesPath,
		handlers: createApiRoutes({
			public: {
				"/api/auth/login": authLoginRoute,
				"/api/auth/logout": authLogoutRoute,
				"/api/auth/password": authPasswordRoute,
				"/api/auth/session": authSessionRoute,
				"/api/external-integrations": externalIntegrationsCollectionRoute(db),
				"/api/external-integrations/clockify": clockifyIntegrationRoute(db),
				"/api/external-integrations/:id/clockify-options": clockifyIntegrationOptionsRoute(db),
				"/api/external-integrations/:id": externalIntegrationDetailRoute(db),
				"/api/import-schedules": importSchedulesCollectionRoute(db),
				"/api/import-schedules/:id/run": importScheduleRunRoute(db),
				"/api/import-schedules/:id": importScheduleDetailRoute(db),
				"/api/jobs": jobsCollectionRoute(db),
				"/api/jobs/:id": jobDetailRoute(db),
				"/api/groups": groupsCollectionRoute,
				"/api/groups/:id": groupDetailRoute,
				"/api/ingredients": ingredientsCollectionRoute,
				"/api/ingredients/:id": ingredientDetailRoute,
				"/api/products": productsCollectionRoute,
				"/api/product-stats": productStatsRoute,
				"/api/products/:id": productDetailRoute,
				"/api/products/:id/picture": productPictureRoute,
				"/api/product-links": productLinksCollectionRoute,
				"/api/product-links/:id": productLinkDetailRoute,
				"/api/receipts": receiptsCollectionRoute,
				"/api/receipts/:id": receiptDetailRoute,
				"/api/receipts/:id/picture": receiptPictureRoute,
				"/api/recipes": recipesCollectionRoute,
				"/api/recipes/:id": recipeDetailRoute,
				"/api/recipes/:id/pictures": recipeImagesCollectionRoute,
				"/api/recipes/:id/pictures/:pictureId": recipeImageDetailRoute,
				"/api/recipe-ingredients": recipeIngredientsCollectionRoute,
				"/api/recipe-ingredients/:id": recipeIngredientDetailRoute,
				"/api/receipt-items": receiptItemsCollectionRoute,
				"/api/receipt-items/:id": receiptItemDetailRoute,
				"/api/inventory-containers": inventoryContainersCollectionRoute,
				"/api/inventory-containers/:id": inventoryContainerDetailRoute,
				"/api/inventory-items": inventoryItemsCollectionRoute,
				"/api/inventory-items/:id/pictures":
					inventoryItemImagesCollectionRoute,
				"/api/inventory-items/:id/pictures/:pictureId":
					inventoryItemImageDetailRoute,
				"/api/inventory-items/:id": inventoryItemDetailRoute,
				"/api/shopping-list-items": shoppingListItemsCollectionRoute,
				"/api/shopping-list-items/:id": shoppingListItemDetailRoute,
				"/api/todos": todosCollectionRoute,
				"/api/todos/:id": todoDetailRoute,
				"/api/users": usersCollectionRoute,
				"/api/users/:id": userDetailRoute,
				"/api/clients": clientsCollectionRoute,
				"/api/clients/:id": clientDetailRoute,
				"/api/projects": projectsCollectionRoute,
				"/api/projects/:id/merge": projectMergeRoute,
				"/api/projects/:id": projectDetailRoute,
				"/api/time-entries": timeEntriesCollectionRoute,
				"/api/time-entries/start": timeEntryStartRoute,
				"/api/time-entries/:id/stop": timeEntryStopRoute,
				"/api/time-entries/:id": timeEntryDetailRoute,
				"/api/time-report": timeReportRoute,
				"/api/spending": spendingRoute,
				"/version": () => Response.json(versionPayload()),
			},
		}),
	}
}

const request = async (
	routes: ReturnType<typeof createRoutes>,
	path: string,
	options: RequestInit = {},
	params: Record<string, string> = {},
) => {
	const url = new URL(`http://localhost${path}`)
	const pathname = url.pathname
	const routeKey = pathname.match(/^\/api\/products\/\d+\/picture$/)
		? "/api/products/:id/picture"
		: pathname.match(/^\/api\/receipts\/\d+\/picture$/)
			? "/api/receipts/:id/picture"
			: pathname.match(/^\/api\/import-schedules\/\d+\/run$/)
				? "/api/import-schedules/:id/run"
				: pathname.match(
							/^\/api\/external-integrations\/\d+\/clockify-options$/,
					  )
					? "/api/external-integrations/:id/clockify-options"
					: pathname === "/api/external-integrations/clockify"
						? "/api/external-integrations/clockify"
						: pathname.match(
									/^\/api\/auth\/(login|logout|password|session)$/,
							  )
							? pathname
							: pathname.match(/^\/api\/time-entries\/start$/)
								? "/api/time-entries/start"
								: pathname.match(
											/^\/api\/time-entries\/\d+\/stop$/,
									  )
									? "/api/time-entries/:id/stop"
									: pathname.match(
												/^\/api\/projects\/\d+\/merge$/,
										  )
										? "/api/projects/:id/merge"
										: pathname.match(
													/^\/api\/recipes\/\d+\/pictures$/,
											  )
											? "/api/recipes/:id/pictures"
											: pathname.match(
														/^\/api\/recipes\/\d+\/pictures\/\d+$/,
												  )
												? "/api/recipes/:id/pictures/:pictureId"
												: pathname.match(
															/^\/api\/inventory-items\/\d+\/pictures$/,
													  )
													? "/api/inventory-items/:id/pictures"
													: pathname.match(
																/^\/api\/inventory-items\/\d+\/pictures\/\d+$/,
														  )
														? "/api/inventory-items/:id/pictures/:pictureId"
														: pathname
																	.split("/")
																	.filter(
																		Boolean,
																	).length ===
															  3
															? pathname.replace(
																	/\/[^/]+$/,
																	"/:id",
																)
															: pathname
	const handler = routes.handlers[routeKey as keyof typeof routes.handlers]
	if (handler instanceof Response) {
		return handler.clone()
	}
	const req = new Request(`http://localhost${path}`, {
		method: options.method ?? "GET",
		headers: options.headers,
		body: options.body,
	}) as Request & { params?: Record<string, string> }
	req.params = params
	return handler(req)
}

const waitForJobRecord = async (
	routes: ReturnType<typeof createRoutes>,
	jobId: number,
) => {
	for (let index = 0; index < 50; index += 1) {
		const job = await routes.db.client.job.findUnique({
			where: { id: jobId },
		})
		if (job?.status === 3 || job?.status === 4) return job
		await Bun.sleep(20)
	}
	throw new Error(`Job ${jobId} did not finish`)
}

describe("Pupler API", () => {
	test("exposes the app version", async () => {
		const routes = createRoutes()

		const response = await request(routes, "/version")
		expect(response.status).toBe(200)
		expect(await response.json()).toEqual({
			version: "dev",
		})
	})

	test("creates, updates, lists, and deletes groups", async () => {
		const routes = createRoutes()

		const createResponse = await request(routes, "/api/groups", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: " Grocery ",
			}),
		})
		expect(createResponse.status).toBe(201)
		const created = await createResponse.json()
		expect(created.name).toBe("Grocery")

		const duplicateResponse = await request(routes, "/api/groups", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "grocery",
			}),
		})
		expect(duplicateResponse.status).toBe(409)

		const listResponse = await request(routes, "/api/groups?name=GROCERY")
		expect(listResponse.status).toBe(200)
		const listed = await listResponse.json()
		expect(listed).toHaveLength(1)
		expect(listed[0].id).toBe(created.id)

		const updateResponse = await request(
			routes,
			`/api/groups/${created.id}`,
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "My Business",
				}),
			},
			{ id: String(created.id) },
		)
		expect(updateResponse.status).toBe(200)
		const updated = await updateResponse.json()
		expect(updated.name).toBe("My Business")

		const deleteResponse = await request(
			routes,
			`/api/groups/${created.id}`,
			{ method: "DELETE" },
			{ id: String(created.id) },
		)
		expect(deleteResponse.status).toBe(204)

		const missingResponse = await request(
			routes,
			`/api/groups/${created.id}`,
			{},
			{ id: String(created.id) },
		)
		expect(missingResponse.status).toBe(404)
	})

	test("creates, updates, lists, and deletes users", async () => {
		const routes = createRoutes()

		const createResponse = await request(routes, "/api/users", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: " Alice ",
				username: " alice ",
				email: " alice@example.com ",
				password_hash: " hashed-password ",
				is_admin: true,
			}),
		})
		expect(createResponse.status).toBe(201)
		const created = await createResponse.json()
		expect(created.name).toBe("Alice")
		expect(created.username).toBe("alice")
		expect(created.email).toBe("alice@example.com")
		expect(created.is_admin).toBeTrue()
		expect(created.password_hash).toBeUndefined()

		const listResponse = await request(routes, "/api/users?username=alice")
		expect(listResponse.status).toBe(200)
		const listed = await listResponse.json()
		expect(listed).toHaveLength(1)
		expect(listed[0].id).toBe(created.id)
		expect(listed[0].is_admin).toBeTrue()
		expect(listed[0].password_hash).toBeUndefined()

		const updateResponse = await request(
			routes,
			`/api/users/${created.id}`,
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: null,
					password_hash: "replacement-hash",
					is_admin: false,
				}),
			},
			{ id: String(created.id) },
		)
		expect(updateResponse.status).toBe(200)
		const updated = await updateResponse.json()
		expect(updated.email).toBeNull()
		expect(updated.is_admin).toBeFalse()
		expect(updated.password_hash).toBeUndefined()

		const deleteResponse = await request(
			routes,
			`/api/users/${created.id}`,
			{ method: "DELETE" },
			{ id: String(created.id) },
		)
		expect(deleteResponse.status).toBe(204)

		const missingResponse = await request(
			routes,
			`/api/users/${created.id}`,
			{},
			{ id: String(created.id) },
		)
		expect(missingResponse.status).toBe(404)
	})

	test("authenticates users with server-managed cookie sessions", async () => {
		const routes = createRoutes()
		const createResponse = await request(routes, "/api/users", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Alice",
				username: "alice",
				password: "correct horse battery staple",
			}),
		})
		expect(createResponse.status).toBe(201)
		const created = await createResponse.json()

		const badLoginResponse = await request(routes, "/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: "alice",
				password: "wrong",
			}),
		})
		expect(badLoginResponse.status).toBe(401)

		const loginResponse = await request(routes, "/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: "alice",
				password: "correct horse battery staple",
			}),
		})
		expect(loginResponse.status).toBe(200)
		const cookie = loginResponse.headers.get("set-cookie")
		expect(cookie).toContain("pupler_session=")
		expect(cookie).toContain("HttpOnly")
		expect(cookie).toContain("SameSite=Lax")
		const loginBody = await loginResponse.json()
		expect(loginBody.user.id).toBe(created.id)
		expect(loginBody.user.username).toBe("alice")
		expect(loginBody.user.password_hash).toBeUndefined()

		const sessionCookie = cookie?.split(";")[0] ?? ""
		const sessionResponse = await request(routes, "/api/auth/session", {
			headers: { Cookie: sessionCookie },
		})
		expect(sessionResponse.status).toBe(200)
		const sessionBody = await sessionResponse.json()
		expect(sessionBody.user.id).toBe(created.id)

		const wrongPasswordChangeResponse = await request(
			routes,
			"/api/auth/password",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Cookie: sessionCookie,
				},
				body: JSON.stringify({
					current_password: "wrong",
					new_password: "new correct horse battery staple",
				}),
			},
		)
		expect(wrongPasswordChangeResponse.status).toBe(401)

		const passwordChangeResponse = await request(
			routes,
			"/api/auth/password",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Cookie: sessionCookie,
				},
				body: JSON.stringify({
					current_password: "correct horse battery staple",
					new_password: "new correct horse battery staple",
				}),
			},
		)
		expect(passwordChangeResponse.status).toBe(204)

		const oldPasswordLoginResponse = await request(
			routes,
			"/api/auth/login",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					username: "alice",
					password: "correct horse battery staple",
				}),
			},
		)
		expect(oldPasswordLoginResponse.status).toBe(401)

		const newPasswordLoginResponse = await request(
			routes,
			"/api/auth/login",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					username: "alice",
					password: "new correct horse battery staple",
				}),
			},
		)
		expect(newPasswordLoginResponse.status).toBe(200)

		const logoutResponse = await request(routes, "/api/auth/logout", {
			method: "POST",
			headers: { Cookie: sessionCookie },
		})
		expect(logoutResponse.status).toBe(204)
		expect(logoutResponse.headers.get("set-cookie")).toContain("Max-Age=0")

		const expiredSessionResponse = await request(
			routes,
			"/api/auth/session",
			{
				headers: { Cookie: sessionCookie },
			},
		)
		expect(expiredSessionResponse.status).toBe(401)
	})

	test("tracks time projects, timers, entries, and report totals", async () => {
		const routes = createRoutes()

		const userResponse = await request(routes, "/api/users", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Alice",
				email: "alice@example.com",
			}),
		})
		expect(userResponse.status).toBe(201)
		const user = await userResponse.json()

		const clientResponse = await request(routes, "/api/clients", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "OpenAI",
				color: "#6f5aa8",
				archived_at: null,
			}),
		})
		expect(clientResponse.status).toBe(201)
		const client = await clientResponse.json()
		expect(client.name).toBe("OpenAI")

		const projectResponse = await request(routes, "/api/projects", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				client_id: client.id,
				name: "Pupler",
				color: "#2d7c6f",
				archived_at: null,
			}),
		})
		expect(projectResponse.status).toBe(201)
		const project = await projectResponse.json()
		expect(project.name).toBe("Pupler")
		expect(project.client_id).toBe(client.id)
		expect(project.client.name).toBe("OpenAI")

		const manualEntryResponse = await request(routes, "/api/time-entries", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				user_id: user.id,
				project_id: project.id,
				description: "Planning",
				started_at: "2026-05-26T08:00:00.000Z",
				ended_at: "2026-05-26T09:30:00.000Z",
			}),
		})
		expect(manualEntryResponse.status).toBe(201)
		const manualEntry = await manualEntryResponse.json()
		expect(manualEntry.user).toEqual({
			id: user.id,
			name: "Alice",
			email: "alice@example.com",
		})
		expect(manualEntry.project.name).toBe("Pupler")

		const invalidEntryResponse = await request(
			routes,
			"/api/time-entries",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					project_id: project.id,
					started_at: "2026-05-26T10:00:00.000Z",
					ended_at: "2026-05-26T09:00:00.000Z",
				}),
			},
		)
		expect(invalidEntryResponse.status).toBe(400)

		const startResponse = await request(routes, "/api/time-entries/start", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				user_id: user.id,
				project_id: project.id,
				description: "Build",
				started_at: "2026-05-26T10:00:00.000Z",
			}),
		})
		expect(startResponse.status).toBe(201)
		const firstRunning = await startResponse.json()
		expect(firstRunning.ended_at).toBeNull()

		const restartResponse = await request(
			routes,
			"/api/time-entries/start",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					user_id: user.id,
					project_id: project.id,
					description: "Review",
					started_at: "2026-05-26T11:00:00.000Z",
				}),
			},
		)
		expect(restartResponse.status).toBe(201)
		const secondRunning = await restartResponse.json()
		expect(secondRunning.ended_at).toBeNull()

		const firstEntryResponse = await request(
			routes,
			`/api/time-entries/${firstRunning.id}`,
			{},
			{ id: String(firstRunning.id) },
		)
		const firstEntry = await firstEntryResponse.json()
		expect(firstEntry.ended_at).toBe("2026-05-26T11:00:00.000Z")

		const stopResponse = await request(
			routes,
			`/api/time-entries/${secondRunning.id}/stop`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					ended_at: "2026-05-26T12:00:00.000Z",
				}),
			},
			{ id: String(secondRunning.id) },
		)
		expect(stopResponse.status).toBe(200)
		const stopped = await stopResponse.json()
		expect(stopped.ended_at).toBe("2026-05-26T12:00:00.000Z")

		const secondStopResponse = await request(
			routes,
			`/api/time-entries/${secondRunning.id}/stop`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			},
			{ id: String(secondRunning.id) },
		)
		expect(secondStopResponse.status).toBe(400)

		const reportResponse = await request(
			routes,
			"/api/time-report?from=2026-05-26T00:00:00.000Z&to=2026-05-27T00:00:00.000Z",
		)
		expect(reportResponse.status).toBe(200)
		const report = await reportResponse.json()
		expect(report.total_seconds).toBe(12600)
		expect(report.project_totals).toHaveLength(1)
		expect(report.project_totals[0].project_id).toBe(project.id)
		expect(report.project_totals[0].client_id).toBe(client.id)
		expect(report.project_totals[0].entry_count).toBe(3)
		expect(report.client_totals).toHaveLength(1)
		expect(report.client_totals[0].client_id).toBe(client.id)
		expect(report.client_totals[0].client_name).toBe("OpenAI")
		expect(report.client_totals[0].project_count).toBe(1)
		expect(report.client_totals[0].entry_count).toBe(3)

		const userReportResponse = await request(
			routes,
			`/api/time-report?user_id=${user.id}&from=2026-05-26T00:00:00.000Z&to=2026-05-27T00:00:00.000Z`,
		)
		expect(userReportResponse.status).toBe(200)
		const userReport = await userReportResponse.json()
		expect(userReport.total_seconds).toBe(12600)
	})

	test("merges projects by moving time entries and archiving the source", async () => {
		const routes = createRoutes()

		const keeperResponse = await request(routes, "/api/projects", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "puppybot",
				color: "#2d7c6f",
				archived_at: null,
			}),
		})
		const keeper = await keeperResponse.json()

		const duplicateResponse = await request(routes, "/api/projects", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "puppybot",
				color: "#6f5aa8",
				archived_at: null,
			}),
		})
		const duplicate = await duplicateResponse.json()

		const keeperEntryResponse = await request(routes, "/api/time-entries", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				project_id: keeper.id,
				started_at: "2026-05-26T08:00:00.000Z",
				ended_at: "2026-05-26T09:00:00.000Z",
			}),
		})
		expect(keeperEntryResponse.status).toBe(201)

		const duplicateEntryResponse = await request(
			routes,
			"/api/time-entries",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					project_id: duplicate.id,
					started_at: "2026-05-26T09:00:00.000Z",
					ended_at: "2026-05-26T10:00:00.000Z",
				}),
			},
		)
		expect(duplicateEntryResponse.status).toBe(201)
		const duplicateEntry = await duplicateEntryResponse.json()

		const selfMergeResponse = await request(
			routes,
			`/api/projects/${keeper.id}/merge`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ source_id: keeper.id }),
			},
			{ id: String(keeper.id) },
		)
		expect(selfMergeResponse.status).toBe(400)

		const mergeResponse = await request(
			routes,
			`/api/projects/${keeper.id}/merge`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ source_id: duplicate.id }),
			},
			{ id: String(keeper.id) },
		)
		expect(mergeResponse.status).toBe(200)
		const merged = await mergeResponse.json()
		expect(merged.target.id).toBe(keeper.id)
		expect(merged.source.id).toBe(duplicate.id)
		expect(merged.moved_time_entry_count).toBe(1)
		expect(merged.source_deleted).toBe(false)
		expect(merged.source_archived).toBe(true)
		expect(merged.source.archived_at).not.toBeNull()

		const movedEntryResponse = await request(
			routes,
			`/api/time-entries/${duplicateEntry.id}`,
			{},
			{ id: String(duplicateEntry.id) },
		)
		const movedEntry = await movedEntryResponse.json()
		expect(movedEntry.project_id).toBe(keeper.id)
		expect(movedEntry.project.name).toBe("puppybot")

		const sourceResponse = await request(
			routes,
			`/api/projects/${duplicate.id}`,
			{},
			{ id: String(duplicate.id) },
		)
		expect(sourceResponse.status).toBe(200)
		const source = await sourceResponse.json()
		expect(source.archived_at).not.toBeNull()
	})

	test("reports unlabeled tracked time as a no-project bucket", async () => {
		const routes = createRoutes()

		const projectResponse = await request(routes, "/api/projects", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Admin",
				color: "#2d7c6f",
				archived_at: null,
			}),
		})
		const project = await projectResponse.json()

		const unknownStartResponse = await request(
			routes,
			"/api/time-entries/start",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					started_at: "2026-05-26T08:00:00.000Z",
				}),
			},
		)
		expect(unknownStartResponse.status).toBe(201)

		const noClientEntryResponse = await request(
			routes,
			"/api/time-entries",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					project_id: project.id,
					description: "Planning",
					started_at: "2026-05-26T08:30:00.000Z",
					ended_at: "2026-05-26T09:00:00.000Z",
				}),
			},
		)
		expect(noClientEntryResponse.status).toBe(201)

		const reportResponse = await request(
			routes,
			"/api/time-report?from=2026-05-26T08:00:00.000Z&to=2026-05-26T09:00:00.000Z",
		)
		expect(reportResponse.status).toBe(200)
		const report = await reportResponse.json()
		expect(report.total_seconds).toBe(5400)
		expect(report.project_totals).toEqual([
			expect.objectContaining({
				project_id: null,
				project_name: "No project",
				total_seconds: 3600,
				entry_count: 1,
			}),
			expect.objectContaining({
				project_id: project.id,
				project_name: "Admin",
				total_seconds: 1800,
				entry_count: 1,
			}),
		])
		expect(report.client_totals).toEqual([
			expect.objectContaining({
				client_id: null,
				client_name: "No project",
				total_seconds: 3600,
				entry_count: 1,
				project_count: 0,
			}),
			expect.objectContaining({
				client_id: null,
				client_name: "No client",
				total_seconds: 1800,
				entry_count: 1,
				project_count: 1,
			}),
		])
	})

	test("keeps running timers separate by user", async () => {
		const routes = createRoutes()

		const firstUserResponse = await request(routes, "/api/users", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "Alice" }),
		})
		const firstUser = await firstUserResponse.json()
		const secondUserResponse = await request(routes, "/api/users", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "Bob" }),
		})
		const secondUser = await secondUserResponse.json()

		const projectResponse = await request(routes, "/api/projects", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Pupler",
				color: "#2d7c6f",
				archived_at: null,
			}),
		})
		const project = await projectResponse.json()

		const firstStartResponse = await request(
			routes,
			"/api/time-entries/start",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					user_id: firstUser.id,
					project_id: project.id,
					started_at: "2026-05-26T10:00:00.000Z",
				}),
			},
		)
		const firstEntry = await firstStartResponse.json()

		const secondStartResponse = await request(
			routes,
			"/api/time-entries/start",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					user_id: secondUser.id,
					project_id: project.id,
					started_at: "2026-05-26T11:00:00.000Z",
				}),
			},
		)
		expect(secondStartResponse.status).toBe(201)

		const firstEntryResponse = await request(
			routes,
			`/api/time-entries/${firstEntry.id}`,
			{},
			{ id: String(firstEntry.id) },
		)
		const reloadedFirstEntry = await firstEntryResponse.json()
		expect(reloadedFirstEntry.ended_at).toBeNull()
	})

	test("starts timers without a project but requires one before stopping", async () => {
		const routes = createRoutes()

		const projectResponse = await request(routes, "/api/projects", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Assigned later",
				color: "#2d7c6f",
				archived_at: null,
			}),
		})
		const project = await projectResponse.json()

		const startResponse = await request(routes, "/api/time-entries/start", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				description: "Triage",
				started_at: "2026-05-26T13:00:00.000Z",
			}),
		})
		expect(startResponse.status).toBe(201)
		const running = await startResponse.json()
		expect(running.project_id).toBeNull()
		expect(running.project).toBeNull()

		const stopWithoutProjectResponse = await request(
			routes,
			`/api/time-entries/${running.id}/stop`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					ended_at: "2026-05-26T14:00:00.000Z",
				}),
			},
			{ id: String(running.id) },
		)
		expect(stopWithoutProjectResponse.status).toBe(400)

		const assignResponse = await request(
			routes,
			`/api/time-entries/${running.id}`,
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					project_id: project.id,
				}),
			},
			{ id: String(running.id) },
		)
		expect(assignResponse.status).toBe(200)
		const assigned = await assignResponse.json()
		expect(assigned.project_id).toBe(project.id)

		const stopResponse = await request(
			routes,
			`/api/time-entries/${running.id}/stop`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					ended_at: "2026-05-26T14:00:00.000Z",
				}),
			},
			{ id: String(running.id) },
		)
		expect(stopResponse.status).toBe(200)
		const stopped = await stopResponse.json()
		expect(stopped.ended_at).toBe("2026-05-26T14:00:00.000Z")
	})

	test("normalizes and initializes recurring import schedule times", async () => {
		const routes = createRoutes()
		const now = new Date().toISOString()
		const integration = await routes.db.client.externalIntegration.create({
			data: {
				provider: 1,
				name: "schedule-test",
				status: 1,
				config_json: "{}",
				credentials_encrypted_json: "{}",
				created_at: now,
				updated_at: now,
			},
		})
		const beforeCreate = Date.now()
		const recurringResponse = await request(
			routes,
			"/api/import-schedules",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					integration_id: integration.id,
					name: "Daily",
					cadence: 3,
					timezone: "Europe/Helsinki",
				}),
			},
		)
		expect(recurringResponse.status).toBe(201)
		const recurringSchedule = await recurringResponse.json()
		const firstRun = Date.parse(recurringSchedule.next_run_at)
		expect(firstRun).toBeGreaterThan(beforeCreate + 22 * 60 * 60 * 1000)
		expect(firstRun).toBeLessThan(Date.now() + 26 * 60 * 60 * 1000)

		const explicitResponse = await request(
			routes,
			"/api/import-schedules",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					integration_id: integration.id,
					name: "Explicit",
					cadence: 3,
					timezone: "Europe/Helsinki",
					next_run_at: "2026-07-20T09:00:00+03:00",
				}),
			},
		)
		expect(explicitResponse.status).toBe(201)
		expect((await explicitResponse.json()).next_run_at).toBe(
			"2026-07-20T06:00:00.000Z",
		)

		const invalidTimezoneResponse = await request(
			routes,
			"/api/import-schedules",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					integration_id: integration.id,
					name: "Invalid timezone",
					cadence: 3,
					timezone: "Mars/Olympus_Mons",
				}),
			},
		)
		expect(invalidTimezoneResponse.status).toBe(400)

		expect(
			nextScheduleRunAt("2026-03-28T07:00:00.000Z", 3, "Europe/Helsinki"),
		).toBe("2026-03-29T06:00:00.000Z")
		expect(
			nextScheduleRunAt("2026-10-24T06:00:00.000Z", 3, "Europe/Helsinki"),
		).toBe("2026-10-25T07:00:00.000Z")
	})

	test("does not enqueue or execute imports for disabled integrations", async () => {
		const routes = createRoutes()
		const now = new Date().toISOString()
		const integration = await routes.db.client.externalIntegration.create({
			data: {
				provider: 1,
				name: "disabled",
				status: 2,
				config_json: "{}",
				credentials_encrypted_json: "{}",
				created_at: now,
				updated_at: now,
			},
		})
		const schedule = await routes.db.client.importSchedule.create({
			data: {
				integration_id: integration.id,
				type: 1,
				status: 1,
				name: "Disabled daily",
				cadence: 3,
				timezone: "UTC",
				cursor_json: null,
				params_json: "{}",
				next_run_at: "2026-01-01T00:00:00.000Z",
				last_run_at: null,
				last_job_id: null,
				created_at: now,
				updated_at: now,
			},
		})

		wakeJobWorker(routes.db)
		await Bun.sleep(100)
		expect(await routes.db.client.job.count()).toBe(0)

		const pendingJob = await routes.db.client.job.create({
			data: {
				schedule_id: schedule.id,
				integration_id: integration.id,
				type: 1,
				status: 1,
				params_json: "{}",
				cursor_json: null,
				created_at: now,
				updated_at: now,
			},
		})
		wakeJobWorker(routes.db)
		const failedJob = await waitForJobRecord(routes, pendingJob.id)
		expect(failedJob.status).toBe(4)
		expect(failedJob.error_message).toBe(
			"External integration is not active",
		)
	})

	test("configures and runs Clockify imports through jobs and link tables", async () => {
		const routes = createRoutes()
		const originalKey = process.env.PUPLER_ENCRYPTION_KEY
		const originalFullHistoryStart =
			process.env.PUPLER_CLOCKIFY_FULL_HISTORY_START
		const originalFetch = globalThis.fetch
		process.env.PUPLER_ENCRYPTION_KEY = Buffer.from(
			"0123456789abcdef0123456789abcdef",
		).toString("base64")
		process.env.PUPLER_CLOCKIFY_FULL_HISTORY_START =
			"2026-07-01T00:00:00.000Z"

		let clockifyDescription = "Planning"
		const clockifyReportRequests: Array<{
			dateRangeStart?: string
			dateRangeEnd?: string
		}> = []
		globalThis.fetch = (async (_input, init) => {
			clockifyReportRequests.push(JSON.parse(String(init?.body ?? "{}")))
			return Response.json({
				timeentries: [
					{
						id: "entry-1",
						description: clockifyDescription,
						projectId: "project-1",
						projectName: "Pupler",
						clientId: "client-1",
						clientName: "OpenAI",
						userId: "user-1",
						userName: "Alice",
						userEmail: "alice@example.com",
						timeInterval: {
							start: "2026-05-26T08:00:00.000Z",
							end: "2026-05-26T09:00:00.000Z",
						},
					},
				],
			})
		}) as unknown as typeof fetch

		try {
			const integrationResponse = await request(
				routes,
				"/api/external-integrations/clockify",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						name: "default",
						workspace_id: "workspace-1",
						api_key: "clockify-secret",
						reports_base_url: "https://clockify.test",
					}),
				},
			)
			expect(integrationResponse.status).toBe(200)
			const integration = await integrationResponse.json()
			expect(integration.provider).toBe(1)
			expect(integration.credentials_encrypted_json).toBeUndefined()

			const targetClientResponse = await request(routes, "/api/clients", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Work",
				}),
			})
			expect(targetClientResponse.status).toBe(201)
			const targetClient = await targetClientResponse.json()

			const scheduleResponse = await request(
				routes,
				"/api/import-schedules",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						integration_id: integration.id,
						name: "Daily Clockify",
						cadence: 1,
						timezone: "UTC",
						lookback_days: 14,
						target_client_id: targetClient.id,
					}),
				},
			)
			expect(scheduleResponse.status).toBe(201)
			const schedule = await scheduleResponse.json()

			const runResponse = await request(
				routes,
				`/api/import-schedules/${schedule.id}/run`,
				{ method: "POST", body: JSON.stringify({}) },
				{ id: String(schedule.id) },
			)
			expect(runResponse.status).toBe(202)
			const job = await runResponse.json()

			let completedJob: {
				status: number
				result_json: string | null
			} | null = null
			for (let index = 0; index < 20; index += 1) {
				const jobResponse = await request(
					routes,
					`/api/jobs/${job.id}`,
					{},
					{ id: String(job.id) },
				)
				completedJob = await jobResponse.json()
				if (completedJob.status === 3 || completedJob.status === 4)
					break
				await Bun.sleep(25)
			}
			expect(completedJob?.status).toBe(3)
			if (!completedJob) {
				throw new Error("Clockify import job did not finish")
			}
			const firstResult = JSON.parse(completedJob.result_json ?? "{}")
			expect(firstResult.created.clients).toBe(0)
			expect(firstResult.created.time_entries).toBe(1)

			const projectLinks =
				await routes.db.client.clockifyProjectLink.findMany()
			const timeEntryLinks =
				await routes.db.client.clockifyTimeEntryLink.findMany()
			expect(projectLinks).toHaveLength(1)
			expect(timeEntryLinks).toHaveLength(1)
			const importedProject =
				await routes.db.client.project.findFirstOrThrow()
			expect(importedProject.client_id).toBe(targetClient.id)
			expect(
				await routes.db.client.client.findFirst({
					where: { name: "OpenAI" },
				}),
			).toBeNull()

			const optionsResponse = await request(
				routes,
				`/api/external-integrations/${integration.id}/clockify-options`,
				{},
				{ id: String(integration.id) },
			)
			expect(optionsResponse.status).toBe(200)
			const options = await optionsResponse.json()
			expect(options.projects[0].id).toBe("project-1")

			const updateScheduleResponse = await request(
				routes,
				`/api/import-schedules/${schedule.id}`,
				{
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						lookback_days: null,
						dry_run: false,
					}),
				},
				{ id: String(schedule.id) },
			)
			expect(updateScheduleResponse.status).toBe(200)
			const updatedSchedule = await updateScheduleResponse.json()
			expect(
				JSON.parse(updatedSchedule.params_json).lookback_days,
			).toBeNull()

			clockifyDescription = "Updated planning"
			const secondRunResponse = await request(
				routes,
				`/api/import-schedules/${schedule.id}/run`,
				{ method: "POST", body: JSON.stringify({}) },
				{ id: String(schedule.id) },
			)
			const secondJob = await secondRunResponse.json()
			for (let index = 0; index < 20; index += 1) {
				const jobResponse = await request(
					routes,
					`/api/jobs/${secondJob.id}`,
					{},
					{ id: String(secondJob.id) },
				)
				const current = await jobResponse.json()
				if (current.status === 3 || current.status === 4) break
				await Bun.sleep(25)
			}

			expect(await routes.db.client.timeEntry.count()).toBe(1)
			const updatedEntry =
				await routes.db.client.timeEntry.findFirstOrThrow()
			expect(updatedEntry.description).toBe("Updated planning")
			expect(await routes.db.client.clockifyTimeEntryLink.count()).toBe(1)
			expect(
				clockifyReportRequests.some(
					(request) =>
						request.dateRangeStart === "2026-07-01T00:00:00.000Z",
				),
			).toBeTrue()

			const filteredScheduleResponse = await request(
				routes,
				`/api/import-schedules/${schedule.id}`,
				{
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						project_ids: ["other-project"],
					}),
				},
				{ id: String(schedule.id) },
			)
			expect(filteredScheduleResponse.status).toBe(200)
			const filteredRunResponse = await request(
				routes,
				`/api/import-schedules/${schedule.id}/run`,
				{ method: "POST", body: JSON.stringify({}) },
				{ id: String(schedule.id) },
			)
			const filteredJob = await filteredRunResponse.json()
			let completedFilteredJob: {
				status: number
				result_json: string | null
			} | null = null
			for (let index = 0; index < 20; index += 1) {
				const jobResponse = await request(
					routes,
					`/api/jobs/${filteredJob.id}`,
					{},
					{ id: String(filteredJob.id) },
				)
				completedFilteredJob = await jobResponse.json()
				if (
					completedFilteredJob.status === 3 ||
					completedFilteredJob.status === 4
				)
					break
				await Bun.sleep(25)
			}
			expect(completedFilteredJob?.status).toBe(3)
			const filteredResult = JSON.parse(
				completedFilteredJob?.result_json ?? "{}",
			)
			expect(filteredResult.skipped.filtered_entries).toBeGreaterThanOrEqual(1)
			expect(await routes.db.client.timeEntry.count()).toBe(1)
		} finally {
			globalThis.fetch = originalFetch
			if (originalKey === undefined) {
				delete process.env.PUPLER_ENCRYPTION_KEY
			} else {
				process.env.PUPLER_ENCRYPTION_KEY = originalKey
			}
			if (originalFullHistoryStart === undefined) {
				delete process.env.PUPLER_CLOCKIFY_FULL_HISTORY_START
			} else {
				process.env.PUPLER_CLOCKIFY_FULL_HISTORY_START =
					originalFullHistoryStart
			}
		}
	})

	test("deduplicates dry-run client, user, and project counts", async () => {
		const routes = createRoutes()
		const originalKey = process.env.PUPLER_ENCRYPTION_KEY
		const originalFetch = globalThis.fetch
		process.env.PUPLER_ENCRYPTION_KEY = Buffer.from(
			"0123456789abcdef0123456789abcdef",
		).toString("base64")
		globalThis.fetch = (async () =>
			Response.json({
				timeentries: ["entry-1", "entry-2"].map((id, index) => ({
					id,
					description: `Dry run ${index + 1}`,
					projectId: "new-project",
					projectName: "New Project",
					clientId: "new-client",
					clientName: "New Client",
					userId: "new-user",
					userName: "New User",
					userEmail: "new-user@example.com",
					timeInterval: {
						start: `2026-07-15T0${8 + index}:00:00.000Z`,
						end: `2026-07-15T${10 + index}:00:00.000Z`,
					},
				})),
			})) as unknown as typeof fetch

		try {
			const integrationResponse = await request(
				routes,
				"/api/external-integrations/clockify",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						name: "dry-run",
						workspace_id: "workspace-dry-run",
						api_key: "clockify-secret",
						reports_base_url: "https://clockify.test",
					}),
				},
			)
			const integration = await integrationResponse.json()
			const scheduleResponse = await request(
				routes,
				"/api/import-schedules",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						integration_id: integration.id,
						name: "Dry run",
						cadence: 1,
						timezone: "UTC",
						dry_run: true,
					}),
				},
			)
			const schedule = await scheduleResponse.json()
			const runResponse = await request(
				routes,
				`/api/import-schedules/${schedule.id}/run`,
				{ method: "POST", body: JSON.stringify({}) },
				{ id: String(schedule.id) },
			)
			const queuedJob = await runResponse.json()
			const completedJob = await waitForJobRecord(routes, queuedJob.id)
			expect(completedJob.status).toBe(3)
			const result = JSON.parse(completedJob.result_json ?? "{}")
			expect(result.created.clients).toBe(1)
			expect(result.created.users).toBe(1)
			expect(result.created.projects).toBe(1)
			expect(result.created.project_links).toBe(1)
			expect(result.created.time_entries).toBe(2)
			expect(await routes.db.client.client.count()).toBe(0)
			expect(await routes.db.client.user.count()).toBe(0)
			expect(await routes.db.client.project.count()).toBe(0)
			expect(await routes.db.client.timeEntry.count()).toBe(0)
		} finally {
			globalThis.fetch = originalFetch
			if (originalKey === undefined) {
				delete process.env.PUPLER_ENCRYPTION_KEY
			} else {
				process.env.PUPLER_ENCRYPTION_KEY = originalKey
			}
		}
	})

	test("groups receipts and clears receipt links when a group is deleted", async () => {
		const routes = createRoutes()

		const groupResponse = await request(routes, "/api/groups", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Grocery",
			}),
		})
		const group = await groupResponse.json()

		const receiptResponse = await request(routes, "/api/receipts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				group_id: group.id,
				store_name: "Prisma",
				purchased_at: "2026-04-13T12:00:00.000Z",
				currency: "EUR",
				total_amount: 5.4,
			}),
		})
		expect(receiptResponse.status).toBe(201)
		const receipt = await receiptResponse.json()
		expect(receipt.group_id).toBe(group.id)
		expect(receipt.group).toEqual({
			id: group.id,
			name: "Grocery",
		})

		const filteredResponse = await request(
			routes,
			`/api/receipts?group_id=${group.id}`,
		)
		expect(filteredResponse.status).toBe(200)
		const filtered = await filteredResponse.json()
		expect(filtered).toHaveLength(1)
		expect(filtered[0].id).toBe(receipt.id)

		const ungroupedResponse = await request(
			routes,
			"/api/receipts?group_id=null",
		)
		expect(ungroupedResponse.status).toBe(200)
		expect(await ungroupedResponse.json()).toHaveLength(0)

		const missingGroupResponse = await request(routes, "/api/receipts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				group_id: 9999,
				store_name: "Missing",
				purchased_at: "2026-04-13T12:00:00.000Z",
				currency: "EUR",
				total_amount: null,
			}),
		})
		expect(missingGroupResponse.status).toBe(400)

		const clearResponse = await request(
			routes,
			`/api/receipts/${receipt.id}`,
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ group_id: null }),
			},
			{ id: String(receipt.id) },
		)
		expect(clearResponse.status).toBe(200)
		const cleared = await clearResponse.json()
		expect(cleared.group_id).toBeNull()
		expect(cleared.group).toBeNull()

		const relinkResponse = await request(
			routes,
			`/api/receipts/${receipt.id}`,
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ group_id: group.id }),
			},
			{ id: String(receipt.id) },
		)
		expect(relinkResponse.status).toBe(200)

		const deleteGroupResponse = await request(
			routes,
			`/api/groups/${group.id}`,
			{ method: "DELETE" },
			{ id: String(group.id) },
		)
		expect(deleteGroupResponse.status).toBe(204)

		const refreshedResponse = await request(
			routes,
			`/api/receipts/${receipt.id}`,
			{},
			{ id: String(receipt.id) },
		)
		expect(refreshedResponse.status).toBe(200)
		const refreshed = await refreshedResponse.json()
		expect(refreshed.group_id).toBeNull()
		expect(refreshed.group).toBeNull()
	})

	test("creates and looks up a product by barcode", async () => {
		const routes = createRoutes()

		const createResponse = await request(routes, "/api/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Milk",
				category: "food",
				barcode: "6414893400012",
				default_unit: "pcs",
				is_perishable: true,
			}),
		})

		expect(createResponse.status).toBe(201)
		const created = await createResponse.json()
		expect(created.barcode).toBe("6414893400012")
		expect(created.is_perishable).toBe(true)

		const listResponse = await request(
			routes,
			"/api/products?barcode=6414893400012",
		)
		expect(listResponse.status).toBe(200)
		const listed = await listResponse.json()
		expect(listed).toHaveLength(1)
		expect(listed[0].id).toBe(created.id)
	})

	test("looks up a product by name case-insensitively", async () => {
		const routes = createRoutes()

		const createResponse = await request(routes, "/api/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Greek Yogurt",
				category: "food",
				barcode: "741",
				default_unit: "cup",
				is_perishable: true,
			}),
		})

		expect(createResponse.status).toBe(201)
		const created = await createResponse.json()

		const listResponse = await request(
			routes,
			"/api/products?name=greek%20yogurt",
		)
		expect(listResponse.status).toBe(200)
		const listed = await listResponse.json()
		expect(listed).toHaveLength(1)
		expect(listed[0].id).toBe(created.id)
	})

	test("looks up a product by partial name case-insensitively", async () => {
		const routes = createRoutes()

		const createResponse = await request(routes, "/api/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Organic Greek Yogurt",
				category: "food",
				barcode: "743",
				default_unit: "cup",
				is_perishable: true,
			}),
		})

		expect(createResponse.status).toBe(201)
		const created = await createResponse.json()

		const listResponse = await request(
			routes,
			"/api/products?name_contains=greek",
		)
		expect(listResponse.status).toBe(200)
		const listed = await listResponse.json()
		expect(listed).toHaveLength(1)
		expect(listed[0].id).toBe(created.id)
	})

	test("summarizes product purchase and usage stats", async () => {
		const routes = createRoutes()

		const milkResponse = await request(routes, "/api/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Milk",
				category: "food",
				barcode: "stats-milk",
				default_unit: "l",
				is_perishable: true,
			}),
		})
		const milk = await milkResponse.json()

		const breadResponse = await request(routes, "/api/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Bread",
				category: "food",
				barcode: "stats-bread",
				default_unit: "pcs",
				is_perishable: true,
			}),
		})
		const bread = await breadResponse.json()

		const receiptResponse = await request(routes, "/api/receipts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				store_name: "Prisma",
				purchased_at: "2026-04-13T12:00:00.000Z",
				currency: "EUR",
				total_amount: 5.4,
			}),
		})
		const receipt = await receiptResponse.json()

		const milkLineResponse = await request(routes, "/api/receipt-items", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				receipt_id: receipt.id,
				product_id: milk.id,
				quantity: 2,
				unit: "l",
				unit_price: 1.2,
				line_total: 2.4,
			}),
		})
		const milkLine = await milkLineResponse.json()

		await request(routes, "/api/receipt-items", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				receipt_id: receipt.id,
				product_id: milk.id,
				quantity: 1,
				unit: "l",
				unit_price: 1.2,
				line_total: 1.2,
			}),
		})

		await request(routes, "/api/inventory-items", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Milk carton",
				ingredient_id: null,
				product_id: milk.id,
				receipt_item_id: milkLine.id,
				container_id: null,
				quantity: 1.5,
				unit: "l",
				purchased_at: null,
				expires_at: null,
				consumed_at: "2026-04-14T12:00:00.000Z",
				notes: null,
			}),
		})

		await request(routes, "/api/inventory-items", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Milk carton open",
				ingredient_id: null,
				product_id: milk.id,
				receipt_item_id: milkLine.id,
				container_id: null,
				quantity: 0.5,
				unit: "l",
				purchased_at: null,
				expires_at: null,
				consumed_at: null,
				notes: null,
			}),
		})

		const statsResponse = await request(routes, "/api/product-stats")
		expect(statsResponse.status).toBe(200)
		const stats = await statsResponse.json()

		const milkStats = stats.find(
			(row: { product_id: number }) => row.product_id === milk.id,
		)
		expect(milkStats).toMatchObject({
			product_id: milk.id,
			product_name: "Milk",
			category: "food",
			default_unit: "l",
			bought_count: 2,
			total_cost_sort: 3.6,
			used_count: 1,
			used_sort_quantity: 1.5,
		})
		expect(milkStats.bought_quantities).toEqual([
			{ unit: "l", quantity: 3 },
		])
		expect(milkStats.total_costs).toEqual([{ currency: "EUR", total: 3.6 }])
		expect(milkStats.used_quantities).toEqual([
			{ unit: "l", quantity: 1.5 },
		])

		const breadStats = stats.find(
			(row: { product_id: number }) => row.product_id === bread.id,
		)
		expect(breadStats).toMatchObject({
			product_id: bread.id,
			bought_count: 0,
			total_cost_sort: 0,
			used_count: 0,
			used_sort_quantity: 0,
		})
		expect(breadStats.total_costs).toEqual([])
		expect(breadStats.used_quantities).toEqual([])
	})

	test("creates and lists ingredients", async () => {
		const routes = createRoutes()

		const createResponse = await request(routes, "/api/ingredients", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Sausage",
				default_unit: "pcs",
			}),
		})

		expect(createResponse.status).toBe(201)
		const created = await createResponse.json()
		expect(created.name).toBe("Sausage")
		expect(created.default_unit).toBe("pcs")

		const listResponse = await request(
			routes,
			"/api/ingredients?name=sausage",
		)
		expect(listResponse.status).toBe(200)
		const listed = await listResponse.json()
		expect(listed).toHaveLength(1)
		expect(listed[0].id).toBe(created.id)
	})

	test("rejects deleting a referenced product", async () => {
		const routes = createRoutes()

		const productResponse = await request(routes, "/api/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Bread",
				category: "food",
				barcode: "12345",
				default_unit: "pcs",
				is_perishable: true,
			}),
		})
		const product = await productResponse.json()

		const linkResponse = await request(routes, "/api/product-links", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				product_id: product.id,
				label: "Store",
				url: "https://example.com/bread",
			}),
		})
		expect(linkResponse.status).toBe(201)

		const deleteResponse = await request(
			routes,
			`/api/products/${product.id}`,
			{ method: "DELETE" },
			{ id: String(product.id) },
		)
		expect(deleteResponse.status).toBe(409)
		const body = await deleteResponse.json()
		expect(body.error).toContain("referenced")
	})

	test("patches a product field and ingredient link", async () => {
		const routes = createRoutes()

		const ingredientResponse = await request(routes, "/api/ingredients", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Cheese",
				default_unit: "g",
			}),
		})
		expect(ingredientResponse.status).toBe(201)
		const ingredient = await ingredientResponse.json()

		const createResponse = await request(routes, "/api/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Cheese",
				category: "food",
				barcode: "98765",
				default_unit: "pcs",
				is_perishable: true,
			}),
		})
		const created = await createResponse.json()

		const patchResponse = await request(
			routes,
			`/api/products/${created.id}`,
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					default_unit: "g",
					ingredient_id: ingredient.id,
				}),
			},
			{ id: String(created.id) },
		)

		expect(patchResponse.status).toBe(200)
		const updated = await patchResponse.json()
		expect(updated.default_unit).toBe("g")
		expect(updated.ingredient_id).toBe(ingredient.id)
		expect(updated.ingredient.name).toBe("Cheese")

		const clearResponse = await request(
			routes,
			`/api/products/${created.id}`,
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ingredient_id: null }),
			},
			{ id: String(created.id) },
		)

		expect(clearResponse.status).toBe(200)
		const cleared = await clearResponse.json()
		expect(cleared.ingredient_id).toBeNull()
		expect(cleared.ingredient).toBeNull()
	})

	test("uploads and fetches a product picture", async () => {
		const routes = createRoutes()

		const createResponse = await request(routes, "/api/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Apple",
				category: "food",
				barcode: "111",
				default_unit: "pcs",
				is_perishable: true,
			}),
		})
		const created = await createResponse.json()

		const formData = new FormData()
		formData.set(
			"file",
			new File([new Uint8Array([1, 2, 3, 4])], "apple.png", {
				type: "image/png",
			}),
		)

		const uploadResponse = await request(
			routes,
			`/api/products/${created.id}/picture`,
			{
				method: "POST",
				body: formData,
			},
			{ id: String(created.id) },
		)
		expect(uploadResponse.status).toBe(200)
		const uploadBody = await uploadResponse.json()
		expect(uploadBody.content_type).toBe("image/png")
		const storedPicture = await routes.db.client.product.findUnique({
			where: { id: created.id },
			select: {
				picture_file: {
					select: { id: true, path: true },
				},
			},
		})
		expect(storedPicture?.picture_file?.path).toBeTruthy()
		const storedPicturePath = join(
			routes.filesPath,
			storedPicture?.picture_file?.path ?? "",
		)
		expect(existsSync(storedPicturePath)).toBe(true)

		const pictureResponse = await request(
			routes,
			`/api/products/${created.id}/picture`,
			{
				method: "GET",
			},
			{ id: String(created.id) },
		)
		expect(pictureResponse.status).toBe(200)
		expect(pictureResponse.headers.get("content-type")).toBe("image/png")
		const bytes = new Uint8Array(await pictureResponse.arrayBuffer())
		expect(Array.from(bytes)).toEqual([1, 2, 3, 4])

		const deleteResponse = await request(
			routes,
			`/api/products/${created.id}/picture`,
			{ method: "DELETE" },
			{ id: String(created.id) },
		)
		expect(deleteResponse.status).toBe(204)
		expect(existsSync(storedPicturePath)).toBe(false)
		expect(
			await routes.db.client.file.findUnique({
				where: { id: storedPicture!.picture_file!.id },
			}),
		).toBeNull()
	})

	test("uploads and fetches a purchase receipt picture", async () => {
		const routes = createRoutes()

		const createResponse = await request(routes, "/api/receipts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				store_name: "Alepa",
				purchased_at: "2026-04-13T10:30:00.000Z",
				currency: "EUR",
				total_amount: 12.4,
			}),
		})
		const created = await createResponse.json()

		const formData = new FormData()
		formData.set(
			"file",
			new File([new Uint8Array([5, 6, 7, 8])], "receipt.png", {
				type: "image/png",
			}),
		)

		const uploadResponse = await request(
			routes,
			`/api/receipts/${created.id}/picture`,
			{
				method: "POST",
				body: formData,
			},
			{ id: String(created.id) },
		)
		expect(uploadResponse.status).toBe(200)
		const uploadBody = await uploadResponse.json()
		expect(uploadBody.content_type).toBe("image/png")
		const storedPicture = await routes.db.client.receipt.findUnique({
			where: { id: created.id },
			select: {
				picture_file: {
					select: { id: true, path: true },
				},
			},
		})
		expect(storedPicture?.picture_file?.path).toBeTruthy()
		const storedPicturePath = join(
			routes.filesPath,
			storedPicture?.picture_file?.path ?? "",
		)
		expect(existsSync(storedPicturePath)).toBe(true)

		const pictureResponse = await request(
			routes,
			`/api/receipts/${created.id}/picture`,
			{
				method: "GET",
			},
			{ id: String(created.id) },
		)
		expect(pictureResponse.status).toBe(200)
		expect(pictureResponse.headers.get("content-type")).toBe("image/png")
		const bytes = new Uint8Array(await pictureResponse.arrayBuffer())
		expect(Array.from(bytes)).toEqual([5, 6, 7, 8])

		const deleteResponse = await request(
			routes,
			`/api/receipts/${created.id}/picture`,
			{ method: "DELETE" },
			{ id: String(created.id) },
		)
		expect(deleteResponse.status).toBe(204)
		expect(existsSync(storedPicturePath)).toBe(false)
		expect(
			await routes.db.client.file.findUnique({
				where: { id: storedPicture!.picture_file!.id },
			}),
		).toBeNull()
	})

	test("uploads and fetches multiple recipe images", async () => {
		const routes = createRoutes()

		const createResponse = await request(routes, "/api/recipes", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Tomato soup",
				description: null,
				instructions: null,
				servings: 4,
				is_active: true,
			}),
		})

		expect(createResponse.status).toBe(201)
		const created = (await createResponse.json()) as { id: number }

		const formData = new FormData()
		formData.append(
			"file",
			new File([new Uint8Array([7, 8, 9, 6])], "soup.png", {
				type: "image/png",
			}),
		)
		formData.append(
			"file",
			new File([new Uint8Array([1, 2, 3, 4])], "soup-2.png", {
				type: "image/png",
			}),
		)

		const uploadResponse = await request(
			routes,
			`/api/recipes/${created.id}/pictures`,
			{
				method: "POST",
				body: formData,
			},
			{ id: String(created.id) },
		)

		expect(uploadResponse.status).toBe(201)
		const uploaded = (await uploadResponse.json()) as Array<{
			id: number
			file_id: number
			file: {
				id: number
				filename: string | null
			}
		}>
		expect(uploaded).toHaveLength(2)
		expect(uploaded.map((image) => image.file.filename)).toEqual([
			"soup.png",
			"soup-2.png",
		])
		expect(uploaded.map((image) => image.file_id)).toEqual(
			uploaded.map((image) => image.file.id),
		)
		const storedImage = await routes.db.client.recipeImage.findUnique({
			where: { id: uploaded[0]!.id },
			select: { file: { select: { id: true, path: true } } },
		})
		expect(storedImage?.file.path).toBeTruthy()
		const storedImagePath = join(
			routes.filesPath,
			storedImage?.file.path ?? "",
		)
		expect(existsSync(storedImagePath)).toBe(true)

		const pictureResponse = await request(
			routes,
			`/api/recipes/${created.id}/pictures/${uploaded[0]!.id}`,
			{},
			{ id: String(created.id), pictureId: String(uploaded[0]!.id) },
		)

		expect(pictureResponse.status).toBe(200)
		expect(pictureResponse.headers.get("content-type")).toBe("image/png")
		const bytes = new Uint8Array(await pictureResponse.arrayBuffer())
		expect(Array.from(bytes)).toEqual([7, 8, 9, 6])

		const detailResponse = await request(
			routes,
			`/api/recipes/${created.id}`,
			{},
			{ id: String(created.id) },
		)
		const detail = (await detailResponse.json()) as {
			recipe_images: Array<{ id: number }>
		}
		expect(detail.recipe_images).toHaveLength(2)

		const deleteResponse = await request(
			routes,
			`/api/recipes/${created.id}/pictures/${uploaded[0]!.id}`,
			{ method: "DELETE" },
			{ id: String(created.id), pictureId: String(uploaded[0]!.id) },
		)
		expect(deleteResponse.status).toBe(204)
		expect(existsSync(storedImagePath)).toBe(false)
		expect(
			await routes.db.client.file.findUnique({
				where: { id: storedImage!.file.id },
			}),
		).toBeNull()
	})

	test("uploads and fetches multiple inventory item images", async () => {
		const routes = createRoutes()

		const createResponse = await request(routes, "/api/inventory-items", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Milk carton",
				quantity: 1,
				unit: "pcs",
			}),
		})

		expect(createResponse.status).toBe(201)
		const created = (await createResponse.json()) as { id: number }

		const formData = new FormData()
		formData.append(
			"file",
			new File([new Uint8Array([10, 11, 12, 13])], "milk-front.png", {
				type: "image/png",
			}),
		)
		formData.append(
			"file",
			new File([new Uint8Array([14, 15, 16, 17])], "milk-back.png", {
				type: "image/png",
			}),
		)

		const uploadResponse = await request(
			routes,
			`/api/inventory-items/${created.id}/pictures`,
			{
				method: "POST",
				body: formData,
			},
			{ id: String(created.id) },
		)

		expect(uploadResponse.status).toBe(201)
		const uploaded = (await uploadResponse.json()) as Array<{
			id: number
			inventory_item_id: number
			file_id: number
			file: {
				id: number
				filename: string | null
				size_bytes: number
			}
		}>
		expect(uploaded).toHaveLength(2)
		expect(uploaded.map((image) => image.file.filename)).toEqual([
			"milk-front.png",
			"milk-back.png",
		])
		expect(uploaded.map((image) => image.file_id)).toEqual(
			uploaded.map((image) => image.file.id),
		)
		expect(uploaded.map((image) => image.file.size_bytes)).toEqual([4, 4])
		expect(uploaded.map((image) => image.inventory_item_id)).toEqual([
			created.id,
			created.id,
		])

		const collectionResponse = await request(
			routes,
			`/api/inventory-items/${created.id}/pictures`,
			{},
			{ id: String(created.id) },
		)
		expect(collectionResponse.status).toBe(200)
		const collection = (await collectionResponse.json()) as Array<{
			id: number
		}>
		expect(collection).toHaveLength(2)

		const storedImages = await routes.db.client.inventoryItemImage.findMany(
			{
				where: { inventory_item_id: created.id },
				orderBy: { id: "asc" },
				select: {
					id: true,
					file: { select: { id: true, path: true } },
				},
			},
		)
		expect(storedImages).toHaveLength(2)
		const firstStoredImagePath = join(
			routes.filesPath,
			storedImages[0]?.file.path ?? "",
		)
		const secondStoredImagePath = join(
			routes.filesPath,
			storedImages[1]?.file.path ?? "",
		)
		expect(existsSync(firstStoredImagePath)).toBe(true)
		expect(existsSync(secondStoredImagePath)).toBe(true)

		const pictureResponse = await request(
			routes,
			`/api/inventory-items/${created.id}/pictures/${uploaded[0]!.id}`,
			{},
			{ id: String(created.id), pictureId: String(uploaded[0]!.id) },
		)

		expect(pictureResponse.status).toBe(200)
		expect(pictureResponse.headers.get("content-type")).toBe("image/png")
		const bytes = new Uint8Array(await pictureResponse.arrayBuffer())
		expect(Array.from(bytes)).toEqual([10, 11, 12, 13])

		const detailResponse = await request(
			routes,
			`/api/inventory-items/${created.id}`,
			{},
			{ id: String(created.id) },
		)
		const detail = (await detailResponse.json()) as {
			inventory_item_images: Array<{ id: number }>
		}
		expect(detail.inventory_item_images).toHaveLength(2)

		const deleteResponse = await request(
			routes,
			`/api/inventory-items/${created.id}/pictures/${uploaded[0]!.id}`,
			{ method: "DELETE" },
			{ id: String(created.id), pictureId: String(uploaded[0]!.id) },
		)
		expect(deleteResponse.status).toBe(204)
		expect(existsSync(firstStoredImagePath)).toBe(false)
		expect(
			await routes.db.client.file.findUnique({
				where: { id: storedImages[0]!.file.id },
			}),
		).toBeNull()

		const deleteItemResponse = await request(
			routes,
			`/api/inventory-items/${created.id}`,
			{ method: "DELETE" },
			{ id: String(created.id) },
		)
		expect(deleteItemResponse.status).toBe(204)
		expect(existsSync(secondStoredImagePath)).toBe(false)
		expect(
			await routes.db.client.file.findUnique({
				where: { id: storedImages[1]!.file.id },
			}),
		).toBeNull()
	})

	test("returns 404 when a stored product picture file is missing", async () => {
		const routes = createRoutes()

		const createResponse = await request(routes, "/api/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Pear",
				category: "food",
				barcode: "112",
				default_unit: "pcs",
				is_perishable: true,
			}),
		})
		const created = await createResponse.json()

		const formData = new FormData()
		formData.set(
			"file",
			new File([new Uint8Array([2, 4, 6, 8])], "pear.png", {
				type: "image/png",
			}),
		)

		const uploadResponse = await request(
			routes,
			`/api/products/${created.id}/picture`,
			{
				method: "POST",
				body: formData,
			},
			{ id: String(created.id) },
		)
		expect(uploadResponse.status).toBe(200)

		const storedPicture = await routes.db.client.product.findUnique({
			where: { id: created.id },
			select: {
				picture_file: {
					select: { path: true },
				},
			},
		})
		const storedPicturePath = join(
			routes.filesPath,
			storedPicture?.picture_file?.path ?? "",
		)
		rmSync(storedPicturePath, { force: true })

		const pictureResponse = await request(
			routes,
			`/api/products/${created.id}/picture`,
			{
				method: "GET",
			},
			{ id: String(created.id) },
		)
		expect(pictureResponse.status).toBe(404)
		const body = await pictureResponse.json()
		expect(body.error).toBe("Product picture not found")
	})

	test("resolves data directories from DATA_PATH and DB_PATH", () => {
		expect(
			resolveDatabasePath(undefined, { DATA_PATH: "/srv/pupler" }),
		).toBe("/srv/pupler/pupler.db")
		expect(
			resolveFilesPath("/custom/data.sqlite", {
				DATA_PATH: "/srv/pupler",
			}),
		).toBe("/srv/pupler/files")
		expect(
			resolveDatabasePath(undefined, {
				DATA_PATH: "/srv/pupler",
				DB_PATH: "/var/lib/pupler/custom.db",
			}),
		).toBe("/var/lib/pupler/custom.db")
		expect(resolveFilesPath("/var/lib/pupler/custom.db", {})).toBe(
			"/var/lib/pupler/files",
		)
	})

	test("returns standalone and linked recipe ingredients in recipe detail responses", async () => {
		const routes = createRoutes()

		const tomatoIngredientResponse = await request(
			routes,
			"/api/ingredients",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Tomato",
					default_unit: "pcs",
				}),
			},
		)
		expect(tomatoIngredientResponse.status).toBe(201)
		const tomatoIngredient = (await tomatoIngredientResponse.json()) as {
			id: number
		}

		const onionIngredientResponse = await request(
			routes,
			"/api/ingredients",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Onion",
					default_unit: "pcs",
				}),
			},
		)
		expect(onionIngredientResponse.status).toBe(201)
		const onionIngredient = (await onionIngredientResponse.json()) as {
			id: number
		}

		const tomatoProductResponse = await request(routes, "/api/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				ingredient_id: tomatoIngredient.id,
				name: "Cherry Tomato Pack",
				category: "food",
				barcode: "2001",
				default_unit: "pcs",
				is_perishable: true,
			}),
		})
		expect(tomatoProductResponse.status).toBe(201)
		const tomatoProduct = (await tomatoProductResponse.json()) as {
			id: number
		}

		const onionProductResponse = await request(routes, "/api/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				ingredient_id: onionIngredient.id,
				name: "Yellow Onion Net",
				category: "food",
				barcode: "2002",
				default_unit: "pcs",
				is_perishable: true,
			}),
		})
		expect(onionProductResponse.status).toBe(201)
		const onionProduct = (await onionProductResponse.json()) as {
			id: number
		}

		const recipeResponse = await request(routes, "/api/recipes", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Tomato salad",
				description: "Fresh salad",
				instructions: "Slice and season",
				servings: 2,
				is_active: true,
			}),
		})
		expect(recipeResponse.status).toBe(201)
		const recipe = (await recipeResponse.json()) as { id: number }

		const standaloneIngredientResponse = await request(
			routes,
			"/api/recipe-ingredients",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					recipe_id: recipe.id,
					ingredient_id: null,
					product_id: null,
					name: "Sea salt",
					quantity: 1,
					unit: "tsp",
					is_optional: false,
					notes: "to taste",
				}),
			},
		)
		expect(standaloneIngredientResponse.status).toBe(201)

		const ingredientResponse = await request(
			routes,
			"/api/recipe-ingredients",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					recipe_id: recipe.id,
					ingredient_id: tomatoIngredient.id,
					product_id: tomatoProduct.id,
					name: "Tomato",
					quantity: 2,
					unit: "pcs",
					is_optional: false,
					notes: "quartered",
				}),
			},
		)
		expect(ingredientResponse.status).toBe(201)
		const ingredient = (await ingredientResponse.json()) as { id: number }

		const detailResponse = await request(
			routes,
			`/api/recipes/${recipe.id}`,
			{},
			{ id: String(recipe.id) },
		)
		expect(detailResponse.status).toBe(200)
		const detail = (await detailResponse.json()) as {
			ingredients: Array<{
				name: string
				ingredient_id: number | null
				product_id: number | null
				quantity: number
				unit: string
				ingredient: { name: string; default_unit: string | null } | null
				product: { name: string; default_unit: string | null } | null
			}>
		}
		expect(detail.ingredients).toHaveLength(2)
		expect(detail.ingredients[0]).toMatchObject({
			name: "Sea salt",
			ingredient_id: null,
			product_id: null,
			quantity: 1,
			unit: "tsp",
		})
		expect(detail.ingredients[1]).toMatchObject({
			name: "Tomato",
			ingredient_id: tomatoIngredient.id,
			product_id: tomatoProduct.id,
			quantity: 2,
			unit: "pcs",
			ingredient: {
				name: "Tomato",
				default_unit: "pcs",
			},
			product: {
				name: "Cherry Tomato Pack",
				default_unit: "pcs",
			},
		})

		const ingredientPatchResponse = await request(
			routes,
			`/api/recipe-ingredients/${ingredient.id}`,
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Red onion",
					ingredient_id: onionIngredient.id,
					product_id: onionProduct.id,
					quantity: 1.5,
					unit: "pcs",
					is_optional: true,
					notes: "thinly sliced",
				}),
			},
			{ id: String(ingredient.id) },
		)
		expect(ingredientPatchResponse.status).toBe(200)

		const updatedDetailResponse = await request(
			routes,
			`/api/recipes/${recipe.id}`,
			{},
			{ id: String(recipe.id) },
		)
		expect(updatedDetailResponse.status).toBe(200)
		const updatedDetail = (await updatedDetailResponse.json()) as {
			ingredients: Array<{
				name: string
				ingredient_id: number | null
				product_id: number
				quantity: number
				unit: string
				is_optional: boolean
				notes: string | null
				ingredient: { name: string; default_unit: string | null } | null
				product: { name: string; default_unit: string | null }
			}>
		}
		expect(updatedDetail.ingredients).toHaveLength(2)
		expect(updatedDetail.ingredients[1]).toMatchObject({
			name: "Red onion",
			ingredient_id: onionIngredient.id,
			product_id: onionProduct.id,
			quantity: 1.5,
			unit: "pcs",
			is_optional: true,
			notes: "thinly sliced",
			ingredient: {
				name: "Onion",
				default_unit: "pcs",
			},
			product: {
				name: "Yellow Onion Net",
				default_unit: "pcs",
			},
		})

		const patchResponse = await request(
			routes,
			`/api/recipes/${recipe.id}`,
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ description: "Updated salad" }),
			},
			{ id: String(recipe.id) },
		)
		expect(patchResponse.status).toBe(200)
		const patched = (await patchResponse.json()) as {
			ingredients: Array<{ ingredient: { name: string } | null }>
		}
		expect(patched.ingredients).toHaveLength(2)
		expect(patched.ingredients[1]?.ingredient?.name).toBe("Onion")
	})

	test("rejects mismatched recipe ingredient product and ingredient links", async () => {
		const routes = createRoutes()

		const tomatoIngredientResponse = await request(
			routes,
			"/api/ingredients",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Tomato",
					default_unit: "pcs",
				}),
			},
		)
		const tomatoIngredient = (await tomatoIngredientResponse.json()) as {
			id: number
		}

		const onionIngredientResponse = await request(
			routes,
			"/api/ingredients",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Onion",
					default_unit: "pcs",
				}),
			},
		)
		const onionIngredient = (await onionIngredientResponse.json()) as {
			id: number
		}

		const tomatoProductResponse = await request(routes, "/api/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				ingredient_id: tomatoIngredient.id,
				name: "Plum Tomato Pack",
				category: "food",
				barcode: "2003",
				default_unit: "pcs",
				is_perishable: true,
			}),
		})
		const tomatoProduct = (await tomatoProductResponse.json()) as {
			id: number
		}

		const recipeResponse = await request(routes, "/api/recipes", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Tomato soup",
				description: null,
				instructions: null,
				servings: 4,
				is_active: true,
			}),
		})
		const recipe = (await recipeResponse.json()) as { id: number }

		const ingredientResponse = await request(
			routes,
			"/api/recipe-ingredients",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					recipe_id: recipe.id,
					ingredient_id: onionIngredient.id,
					product_id: tomatoProduct.id,
					name: "Wrong link",
					quantity: 1,
					unit: "pcs",
					is_optional: false,
					notes: null,
				}),
			},
		)
		expect(ingredientResponse.status).toBe(400)
		const body = await ingredientResponse.json()
		expect(body.error).toContain("different ingredient")
	})

	test("creates and lists receipt items", async () => {
		const routes = createRoutes()

		const productResponse = await request(routes, "/api/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Banana",
				category: "food",
				barcode: "444",
				default_unit: "pcs",
				is_perishable: true,
			}),
		})
		const product = await productResponse.json()

		const receiptResponse = await request(routes, "/api/receipts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				store_name: "Prisma",
				purchased_at: "2026-04-13T12:00:00.000Z",
				currency: "EUR",
				total_amount: 5.4,
			}),
		})
		const receipt = await receiptResponse.json()

		const createResponse = await request(routes, "/api/receipt-items", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				receipt_id: receipt.id,
				product_id: product.id,
				quantity: 6,
				unit: "pcs",
				unit_price: 0.9,
				line_total: 5.4,
			}),
		})
		expect(createResponse.status).toBe(201)
		const created = await createResponse.json()
		expect(created.receipt_id).toBe(receipt.id)

		const listResponse = await request(
			routes,
			`/api/receipt-items?receipt_id=${receipt.id}`,
		)
		expect(listResponse.status).toBe(200)
		const listed = await listResponse.json()
		expect(listed).toHaveLength(1)
		expect(listed[0].id).toBe(created.id)
		expect(listed[0].line_total).toBe(5.4)
	})

	test("summarizes spending by product category from receipt items", async () => {
		const routes = createRoutes()

		const foodResponse = await request(routes, "/api/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Milk",
				category: "food",
				barcode: "spend-1",
				default_unit: "pcs",
				is_perishable: true,
			}),
		})
		const foodProduct = await foodResponse.json()

		const householdResponse = await request(routes, "/api/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Soap",
				category: "household",
				barcode: "spend-2",
				default_unit: "pcs",
				is_perishable: false,
			}),
		})
		const householdProduct = await householdResponse.json()

		const recentReceiptResponse = await request(routes, "/api/receipts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				store_name: "Prisma",
				purchased_at: "2026-04-13T12:00:00.000Z",
				currency: "EUR",
				total_amount: 10.5,
			}),
		})
		const recentReceipt = await recentReceiptResponse.json()

		const usdReceiptResponse = await request(routes, "/api/receipts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				store_name: "Anomaly",
				purchased_at: "2026-04-14T12:00:00.000Z",
				currency: "USD",
				total_amount: 5,
			}),
		})
		const usdReceipt = await usdReceiptResponse.json()

		const oldReceiptResponse = await request(routes, "/api/receipts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				store_name: "Old Store",
				purchased_at: "2026-03-01T12:00:00.000Z",
				currency: "EUR",
				total_amount: 99,
			}),
		})
		const oldReceipt = await oldReceiptResponse.json()

		for (const item of [
			{
				receipt_id: recentReceipt.id,
				product_id: foodProduct.id,
				quantity: 2,
				unit: "pcs",
				unit_price: 1.25,
				line_total: null,
			},
			{
				receipt_id: recentReceipt.id,
				product_id: foodProduct.id,
				quantity: 1,
				unit: "pcs",
				unit_price: 2,
				line_total: 3,
			},
			{
				receipt_id: recentReceipt.id,
				product_id: householdProduct.id,
				quantity: 1,
				unit: "pcs",
				unit_price: null,
				line_total: null,
			},
			{
				receipt_id: usdReceipt.id,
				product_id: householdProduct.id,
				quantity: 1,
				unit: "month",
				unit_price: null,
				line_total: 5,
			},
			{
				receipt_id: oldReceipt.id,
				product_id: householdProduct.id,
				quantity: 1,
				unit: "pcs",
				unit_price: 99,
				line_total: 99,
			},
		]) {
			const response = await request(routes, "/api/receipt-items", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(item),
			})
			expect(response.status).toBe(201)
		}

		const breakdownResponse = await request(
			routes,
			"/api/spending?from=2026-04-01T00:00:00.000Z&to=2026-04-30T23:59:59.999Z",
		)
		expect(breakdownResponse.status).toBe(200)
		const breakdown = await breakdownResponse.json()
		expect(breakdown.item_count).toBe(4)
		expect(breakdown.missing_total_count).toBe(1)
		expect(breakdown.currency_totals).toEqual([
			{ currency: "EUR", total: 9.89 },
		])
		expect(breakdown.monthly_average_totals).toEqual([
			{ currency: "EUR", total: 16.72, day_count: 18 },
		])
		expect(breakdown.weekly_average_totals).toEqual([
			{ currency: "EUR", total: 3.84, day_count: 18 },
		])
		expect(breakdown.daily_average_totals).toEqual([
			{ currency: "EUR", total: 0.55, day_count: 18 },
		])
		expect(breakdown.current_month_totals).toEqual([
			{ currency: "EUR", total: 9.89 },
		])
		expect(breakdown.categories).toHaveLength(2)
		expect(breakdown.categories[0]).toMatchObject({
			category: "food",
			currency: "EUR",
			total: 5.5,
			item_count: 2,
			missing_total_count: 0,
		})
		expect(breakdown.categories[0].items).toHaveLength(2)
		expect(breakdown.categories[0].items[0]).toMatchObject({
			product_name: "Milk",
			store_name: "Prisma",
			receipt_id: recentReceipt.id,
			amount: 2.5,
		})
		expect(breakdown.categories[1]).toMatchObject({
			category: "household",
			currency: "EUR",
			total: 4.39,
			item_count: 2,
			missing_total_count: 1,
		})
		expect(breakdown.categories[1].items).toHaveLength(2)
		expect(
			breakdown.categories[1].items.find(
				(item: { amount: number | null }) => item.amount === null,
			),
		).toMatchObject({
			product_name: "Soap",
			amount: null,
		})
		expect(
			breakdown.categories[1].items.find(
				(item: { receipt_id: number }) =>
					item.receipt_id === usdReceipt.id,
			),
		).toMatchObject({
			product_name: "Soap",
			amount: 4.39,
		})

		const allTimeResponse = await request(
			routes,
			"/api/spending?range=all&to=2026-04-30T23:59:59.999Z",
		)
		expect(allTimeResponse.status).toBe(200)
		const allTimeBreakdown = await allTimeResponse.json()
		expect(allTimeBreakdown.period).toMatchObject({
			from: null,
			to: "2026-04-30T23:59:59.999Z",
			days: null,
			range: "all",
		})
		expect(allTimeBreakdown.item_count).toBe(5)
		expect(allTimeBreakdown.currency_totals).toEqual([
			{ currency: "EUR", total: 108.89 },
		])
		expect(allTimeBreakdown.monthly_average_totals).toEqual([
			{ currency: "EUR", total: 54.34, day_count: 61 },
		])
		expect(allTimeBreakdown.weekly_average_totals).toEqual([
			{ currency: "EUR", total: 12.5, day_count: 61 },
		])
		expect(allTimeBreakdown.daily_average_totals).toEqual([
			{ currency: "EUR", total: 1.79, day_count: 61 },
		])
		expect(allTimeBreakdown.current_month_totals).toEqual([
			{ currency: "EUR", total: 9.89 },
		])

		const mixedRangeResponse = await request(
			routes,
			"/api/spending?range=all&days=30",
		)
		expect(mixedRangeResponse.status).toBe(400)
	})

	test("updates receipt items, validates references, and unlinks inventory on delete", async () => {
		const routes = createRoutes()

		const productResponse = await request(routes, "/api/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Banana",
				category: "food",
				barcode: "4441",
				default_unit: "pcs",
				is_perishable: true,
			}),
		})
		const product = await productResponse.json()

		const replacementProductResponse = await request(
			routes,
			"/api/products",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Plantain",
					category: "food",
					barcode: "4442",
					default_unit: "pcs",
					is_perishable: true,
				}),
			},
		)
		const replacementProduct = await replacementProductResponse.json()

		const receiptResponse = await request(routes, "/api/receipts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				store_name: "Prisma",
				purchased_at: "2026-04-13T12:00:00.000Z",
				currency: "EUR",
				total_amount: 5.4,
			}),
		})
		const receipt = await receiptResponse.json()

		const itemResponse = await request(routes, "/api/receipt-items", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				receipt_id: receipt.id,
				product_id: product.id,
				quantity: 6,
				unit: "pcs",
				unit_price: 0.9,
				line_total: 5.4,
			}),
		})
		const item = await itemResponse.json()

		const inventoryResponse = await request(
			routes,
			"/api/inventory-items",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Banana stash",
					ingredient_id: null,
					product_id: product.id,
					receipt_item_id: item.id,
					container_id: null,
					quantity: 6,
					unit: "pcs",
					purchased_at: null,
					expires_at: null,
					consumed_at: null,
					notes: null,
				}),
			},
		)
		expect(inventoryResponse.status).toBe(201)
		const inventoryItem = await inventoryResponse.json()

		const patchResponse = await request(
			routes,
			`/api/receipt-items/${item.id}`,
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					product_id: replacementProduct.id,
					quantity: 3,
					line_total: 2.7,
				}),
			},
			{ id: String(item.id) },
		)
		expect(patchResponse.status).toBe(200)
		const patched = await patchResponse.json()
		expect(patched.product_id).toBe(replacementProduct.id)
		expect(patched.quantity).toBe(3)
		expect(patched.line_total).toBe(2.7)

		const invalidPatchResponse = await request(
			routes,
			`/api/receipt-items/${item.id}`,
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ product_id: 999999 }),
			},
			{ id: String(item.id) },
		)
		expect(invalidPatchResponse.status).toBe(400)
		expect((await invalidPatchResponse.json()).error).toContain(
			"missing product",
		)

		const deleteResponse = await request(
			routes,
			`/api/receipt-items/${item.id}`,
			{ method: "DELETE" },
			{ id: String(item.id) },
		)
		expect(deleteResponse.status).toBe(204)

		const refreshedInventoryResponse = await request(
			routes,
			`/api/inventory-items/${inventoryItem.id}`,
			{},
			{ id: String(inventoryItem.id) },
		)
		expect(refreshedInventoryResponse.status).toBe(200)
		expect(
			(await refreshedInventoryResponse.json()).receipt_item_id,
		).toBeNull()
	})

	test("deletes receipts with their items and unlinks inventory references", async () => {
		const routes = createRoutes()

		const productResponse = await request(routes, "/api/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Milk",
				category: "food",
				barcode: "4450",
				default_unit: "pcs",
				is_perishable: true,
			}),
		})
		const product = await productResponse.json()

		const receiptResponse = await request(routes, "/api/receipts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				store_name: "Prisma",
				purchased_at: "2026-04-13T12:00:00.000Z",
				currency: "EUR",
				total_amount: 5.4,
			}),
		})
		const receipt = await receiptResponse.json()

		const itemResponse = await request(routes, "/api/receipt-items", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				receipt_id: receipt.id,
				product_id: product.id,
				quantity: 2,
				unit: "pcs",
				unit_price: 2.7,
				line_total: 5.4,
			}),
		})
		const item = await itemResponse.json()

		const inventoryResponse = await request(
			routes,
			"/api/inventory-items",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Milk carton",
					ingredient_id: null,
					product_id: product.id,
					receipt_item_id: item.id,
					container_id: null,
					quantity: 1,
					unit: "pcs",
					purchased_at: null,
					expires_at: null,
					consumed_at: null,
					notes: null,
				}),
			},
		)
		const inventoryItem = await inventoryResponse.json()

		const deleteResponse = await request(
			routes,
			`/api/receipts/${receipt.id}`,
			{ method: "DELETE" },
			{ id: String(receipt.id) },
		)
		expect(deleteResponse.status).toBe(204)

		const receiptFetch = await request(
			routes,
			`/api/receipts/${receipt.id}`,
			{},
			{ id: String(receipt.id) },
		)
		expect(receiptFetch.status).toBe(404)

		const itemFetch = await request(
			routes,
			`/api/receipt-items/${item.id}`,
			{},
			{ id: String(item.id) },
		)
		expect(itemFetch.status).toBe(404)

		const refreshedInventoryResponse = await request(
			routes,
			`/api/inventory-items/${inventoryItem.id}`,
			{},
			{ id: String(inventoryItem.id) },
		)
		expect(refreshedInventoryResponse.status).toBe(200)
		expect(
			(await refreshedInventoryResponse.json()).receipt_item_id,
		).toBeNull()
	})

	test("creates nested inventory containers", async () => {
		const routes = createRoutes()

		const parentResponse = await request(
			routes,
			"/api/inventory-containers",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Room X",
					parent_container_id: null,
					notes: "Kitchen",
				}),
			},
		)
		expect(parentResponse.status).toBe(201)
		const parent = await parentResponse.json()
		expect(parent.name).toBe("Room X")

		const childResponse = await request(
			routes,
			"/api/inventory-containers",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Closet B",
					parent_container_id: parent.id,
					notes: null,
				}),
			},
		)
		expect(childResponse.status).toBe(201)
		const child = await childResponse.json()
		expect(child.parent_container_id).toBe(parent.id)

		const listResponse = await request(
			routes,
			`/api/inventory-containers?parent_container_id=${parent.id}`,
		)
		expect(listResponse.status).toBe(200)
		const listed = await listResponse.json()
		expect(listed).toHaveLength(1)
		expect(listed[0].id).toBe(child.id)
	})

	test("rejects moving a container into its own descendant", async () => {
		const routes = createRoutes()

		const parentResponse = await request(
			routes,
			"/api/inventory-containers",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Room X",
					parent_container_id: null,
					notes: null,
				}),
			},
		)
		const parent = await parentResponse.json()

		const childResponse = await request(
			routes,
			"/api/inventory-containers",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Closet B",
					parent_container_id: parent.id,
					notes: null,
				}),
			},
		)
		const child = await childResponse.json()

		const invalidPatchResponse = await request(
			routes,
			`/api/inventory-containers/${parent.id}`,
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ parent_container_id: child.id }),
			},
			{ id: String(parent.id) },
		)
		expect(invalidPatchResponse.status).toBe(400)
		const body = await invalidPatchResponse.json()
		expect(body.error).toContain("cycle")
	})

	test("unassigns inventory items and child containers when deleting a container", async () => {
		const routes = createRoutes()

		const productResponse = await request(routes, "/api/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Pasta",
				category: "food",
				barcode: "666",
				default_unit: "bag",
				is_perishable: false,
			}),
		})
		const product = await productResponse.json()

		const parentResponse = await request(
			routes,
			"/api/inventory-containers",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Pantry",
					parent_container_id: null,
					notes: null,
				}),
			},
		)
		const parent = await parentResponse.json()

		const childResponse = await request(
			routes,
			"/api/inventory-containers",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Shelf A",
					parent_container_id: parent.id,
					notes: null,
				}),
			},
		)
		const child = await childResponse.json()

		const itemResponse = await request(routes, "/api/inventory-items", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Oats",
				ingredient_id: null,
				product_id: product.id,
				receipt_item_id: null,
				container_id: parent.id,
				quantity: 2,
				unit: "bag",
				purchased_at: null,
				expires_at: null,
				consumed_at: null,
				notes: "Dry storage",
			}),
		})
		expect(itemResponse.status).toBe(201)
		const item = await itemResponse.json()
		expect(item.container_id).toBe(parent.id)

		const filterResponse = await request(
			routes,
			`/api/inventory-items?container_id=${parent.id}`,
		)
		expect(filterResponse.status).toBe(200)
		const filtered = await filterResponse.json()
		expect(filtered).toHaveLength(1)
		expect(filtered[0].id).toBe(item.id)

		const deleteResponse = await request(
			routes,
			`/api/inventory-containers/${parent.id}`,
			{ method: "DELETE" },
			{ id: String(parent.id) },
		)
		expect(deleteResponse.status).toBe(204)

		const updatedItemResponse = await request(
			routes,
			`/api/inventory-items/${item.id}`,
			{},
			{ id: String(item.id) },
		)
		expect(updatedItemResponse.status).toBe(200)
		const updatedItem = await updatedItemResponse.json()
		expect(updatedItem.container_id).toBeNull()

		const updatedChildResponse = await request(
			routes,
			`/api/inventory-containers/${child.id}`,
			{},
			{ id: String(child.id) },
		)
		expect(updatedChildResponse.status).toBe(200)
		const updatedChild = await updatedChildResponse.json()
		expect(updatedChild.parent_container_id).toBeNull()
	})

	test("creates inventory items with standalone and linked references and rejects mismatches", async () => {
		const routes = createRoutes()

		const sausageIngredientResponse = await request(
			routes,
			"/api/ingredients",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Sausage",
					default_unit: "pcs",
				}),
			},
		)
		const sausageIngredient = (await sausageIngredientResponse.json()) as {
			id: number
		}

		const cheeseIngredientResponse = await request(
			routes,
			"/api/ingredients",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Cheese",
					default_unit: "pcs",
				}),
			},
		)
		const cheeseIngredient = (await cheeseIngredientResponse.json()) as {
			id: number
		}

		const productResponse = await request(routes, "/api/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				ingredient_id: sausageIngredient.id,
				name: "Atria Grillimakkara",
				category: "food",
				barcode: "33331",
				default_unit: "pcs",
				is_perishable: true,
			}),
		})
		const product = (await productResponse.json()) as { id: number }

		const standaloneResponse = await request(
			routes,
			"/api/inventory-items",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Light bulb",
					ingredient_id: null,
					product_id: null,
					receipt_item_id: null,
					container_id: null,
					quantity: 2,
					unit: "pcs",
					purchased_at: null,
					expires_at: null,
					consumed_at: null,
					notes: "Hall closet",
				}),
			},
		)
		expect(standaloneResponse.status).toBe(201)

		const linkedResponse = await request(routes, "/api/inventory-items", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Frozen sausage",
				ingredient_id: sausageIngredient.id,
				product_id: product.id,
				receipt_item_id: null,
				container_id: null,
				quantity: 4,
				unit: "pcs",
				purchased_at: null,
				expires_at: null,
				consumed_at: null,
				notes: null,
			}),
		})
		expect(linkedResponse.status).toBe(201)
		const linked = await linkedResponse.json()
		expect(linked.ingredient.name).toBe("Sausage")
		expect(linked.product.name).toBe("Atria Grillimakkara")

		const mismatchResponse = await request(routes, "/api/inventory-items", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Wrong sausage",
				ingredient_id: cheeseIngredient.id,
				product_id: product.id,
				receipt_item_id: null,
				container_id: null,
				quantity: 1,
				unit: "pcs",
				purchased_at: null,
				expires_at: null,
				consumed_at: null,
				notes: null,
			}),
		})
		expect(mismatchResponse.status).toBe(400)
	})

	test("creates shoppinglist items without a parent shopping list", async () => {
		const routes = createRoutes()

		const createItemResponse = await request(
			routes,
			"/api/shopping-list-items",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Light bulb",
					ingredient_id: null,
					product_id: null,
					quantity: 6,
					unit: "pcs",
					done: false,
					source_recipe_id: null,
					notes: "for breakfast",
				}),
			},
		)

		expect(createItemResponse.status).toBe(201)
		const createdItem = await createItemResponse.json()
		expect(createdItem.name).toBe("Light bulb")
		expect(createdItem.done).toBe(false)

		const listResponse = await request(routes, "/api/shopping-list-items")
		expect(listResponse.status).toBe(200)
		const items = await listResponse.json()
		expect(items).toHaveLength(1)
		expect(items[0].notes).toBe("for breakfast")
	})

	test("creates shoppinglist items with ingredient and product links", async () => {
		const routes = createRoutes()

		const ingredientResponse = await request(routes, "/api/ingredients", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Sausage",
				default_unit: "pack",
			}),
		})
		const ingredient = (await ingredientResponse.json()) as { id: number }

		const productResponse = await request(routes, "/api/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				ingredient_id: ingredient.id,
				name: "Snellman Sausage Pack",
				category: "food",
				barcode: "5551",
				default_unit: "pack",
				is_perishable: true,
			}),
		})
		const product = (await productResponse.json()) as { id: number }

		const recipeResponse = await request(routes, "/api/recipes", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Sausage pasta",
				description: null,
				instructions: null,
				servings: 2,
				is_active: true,
			}),
		})
		const recipe = (await recipeResponse.json()) as { id: number }

		const createItemResponse = await request(
			routes,
			"/api/shopping-list-items",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Sausage",
					ingredient_id: ingredient.id,
					product_id: product.id,
					quantity: 2,
					unit: "pack",
					done: false,
					source_recipe_id: recipe.id,
					notes: "for dinner",
				}),
			},
		)

		expect(createItemResponse.status).toBe(201)
		const createdItem = await createItemResponse.json()
		expect(createdItem.ingredient.name).toBe("Sausage")
		expect(createdItem.product.name).toBe("Snellman Sausage Pack")
		expect(createdItem.source_recipe_id).toBe(recipe.id)
	})

	test("creates, completes, archives, and deletes todos", async () => {
		const routes = createRoutes()

		const createResponse = await request(routes, "/api/todos", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				title: "Take bins out",
				notes: "before evening",
				status: 1,
				due_at: "2026-05-25T18:00:00.000Z",
				completed_at: null,
			}),
		})
		expect(createResponse.status).toBe(201)
		const created = await createResponse.json()
		expect(created.title).toBe("Take bins out")
		expect(created.status).toBe(1)

		const completeResponse = await request(
			routes,
			`/api/todos/${created.id}`,
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					status: 2,
					completed_at: "2026-05-25T18:30:00.000Z",
				}),
			},
			{ id: String(created.id) },
		)
		expect(completeResponse.status).toBe(200)
		const completed = await completeResponse.json()
		expect(completed.status).toBe(2)
		expect(completed.completed_at).toBe("2026-05-25T18:30:00.000Z")

		const listDoneResponse = await request(routes, "/api/todos?status=2")
		expect(listDoneResponse.status).toBe(200)
		const doneTodos = await listDoneResponse.json()
		expect(doneTodos).toHaveLength(1)

		const archiveResponse = await request(
			routes,
			`/api/todos/${created.id}`,
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status: 3 }),
			},
			{ id: String(created.id) },
		)
		expect(archiveResponse.status).toBe(200)
		expect((await archiveResponse.json()).status).toBe(3)

		const invalidStatusResponse = await request(routes, "/api/todos", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				title: "Bad status",
				status: 9,
			}),
		})
		expect(invalidStatusResponse.status).toBe(400)

		const deleteResponse = await request(
			routes,
			`/api/todos/${created.id}`,
			{ method: "DELETE" },
			{ id: String(created.id) },
		)
		expect(deleteResponse.status).toBe(204)
	})
})
