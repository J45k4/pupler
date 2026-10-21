import { createHash } from "node:crypto"
import { db } from "../db"
import type { PrismaClient } from "../generated/prisma/client"
import { requireAuthenticatedUser } from "./auth"
import {
	assertKnownFields,
	expectBoolean,
	expectString,
	HttpError,
	json,
	readJsonObject,
	requireBodyField,
	utcNow,
	type Database,
	type JsonObject,
	type JsonValue,
} from "./core"
import { applyOfflineTimeMutation } from "./time-entries"
import { applyOfflineShoppingItemMutation } from "./shopping-list-items"
import { requireShoppingListMember } from "./shopping-lists"
import { OfflineReceipts, unconfirmedOfflineChange } from "./offline-receipts"

const receiptStores = new WeakMap<Database, OfflineReceipts>()

const uuid = (value: unknown) => {
	if (typeof value !== "string" || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value))
		throw new HttpError(400, "Invalid offline operation identifier")
	return value
}

export const offlineSyncRoute = async (req: Request) => {
	const user = await requireAuthenticatedUser(req)
	const database = db
	let receipts = receiptStores.get(database)
	if (!receipts) {
		receipts = new OfflineReceipts()
		receiptStores.set(database, receipts)
	}
	const store = receipts
	if (req.method === "GET") return store.run(async () => json(200, { sync_session: store.prepare() }))
	if (req.method !== "POST") throw new HttpError(405, "Method not allowed")
	const body = await readJsonObject(req)
	assertKnownFields(body, ["user_id", "client_id", "sync_session", "operations"])
	if (body.user_id !== user.id) throw new HttpError(401, "Sign in to the account that saved these changes before syncing")
	const clientId = uuid(body.client_id)
	const session = uuid(body.sync_session)
	if (
		!Array.isArray(body.operations) ||
		body.operations.length < 1 ||
		body.operations.length > 50 ||
		JSON.stringify(body).length > 256_000
	)
		throw new HttpError(400, "Provide between 1 and 50 offline changes")
	const operations = body.operations
	return store.run(async () => {
		const results = []
		for (const raw of operations) {
			let id = ""
			try {
				if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new HttpError(400, "Invalid offline change")
				const operation = raw as JsonObject
				assertKnownFields(operation, [
					"id",
					"path",
					"method",
					"body",
					"local_id",
					"expected_running_id",
					"expected_updated_at",
					"base_operation_id",
				])
				id = uuid(operation.id)
				if (session !== store.session) throw new HttpError(409, unconfirmedOfflineChange)
				const path = requireBodyField(operation, "path", expectString)
				const method = requireBodyField(operation, "method", expectString)
				if (!/^\/api\/(?:time-entries|shopping-list-items|shopping-lists)(?:\/|$)/.test(path))
					throw new HttpError(400, "This action needs an internet connection")
				if (!operation.body || typeof operation.body !== "object" || Array.isArray(operation.body))
					throw new HttpError(400, "Invalid offline payload")
				const localId = operation.local_id ?? null
				if (localId !== null && (!Number.isInteger(localId) || (localId as number) >= 0 || (localId as number) < -2147483647))
					throw new HttpError(400, "Invalid local identifier")
				const hash = createHash("sha256").update(JSON.stringify(operation)).digest("hex")
				const previous = store.entries.get(id)
				if (previous) {
					if (previous.user_id !== user.id || previous.client_id !== clientId || previous.request_hash !== hash)
						throw new HttpError(409, "Offline operation identifier was already used")
					if (!previous.result_json) throw new HttpError(409, unconfirmedOfflineChange)
					results.push({ id, status: 200, result: JSON.parse(previous.result_json) })
					continue
				}
				store.reserve(id, { user_id: user.id, client_id: clientId, local_id: localId as number | null, request_hash: hash })
				let result: JsonValue
				try {
					result = await (database.client as PrismaClient).$transaction(async (tx) => {
						const transaction: Database = { ...database, client: tx }
						const resolveId = async (value: unknown): Promise<number | null> => {
							if (value === null || value === undefined) return null
							if (typeof value !== "number" || !Number.isSafeInteger(value) || value === 0)
								throw new HttpError(400, "Invalid resource identifier")
							if (value > 0) return value
							const parent = store.findLocal(user.id, clientId, value)
							if (!parent?.result_json) throw new HttpError(409, "An earlier offline change needs to sync first")
							return JSON.parse(parent.result_json).id as number
						}
						let resolvedPath = path
						const local = path.match(/\/(-\d+)(?=\/|$)/)
						if (local) resolvedPath = path.replace(local[1]!, String(await resolveId(Number(local[1]))))
						const payload = { ...(operation.body as JsonObject) }
						if (typeof payload.shopping_list_id === "number")
							payload.shopping_list_id = await resolveId(payload.shopping_list_id)
						let expectedUpdatedAt = typeof operation.expected_updated_at === "string" ? operation.expected_updated_at : null
						if (operation.base_operation_id) {
							const parent = store.entries.get(uuid(operation.base_operation_id))
							if (!parent?.result_json || parent.user_id !== user.id || parent.client_id !== clientId)
								throw new HttpError(409, "An earlier timer change needs to sync first")
							expectedUpdatedAt = JSON.parse(parent.result_json).updated_at ?? null
						}
						let value: unknown
						if (resolvedPath.startsWith("/api/time-entries"))
							value = await applyOfflineTimeMutation(
								transaction,
								user,
								resolvedPath,
								method,
								payload,
								await resolveId(operation.expected_running_id),
								expectedUpdatedAt,
							)
						else if (resolvedPath.startsWith("/api/shopping-list-items"))
							value = await applyOfflineShoppingItemMutation(transaction, user, resolvedPath, method, payload)
						else if (resolvedPath === "/api/shopping-lists" && method === "POST") {
							assertKnownFields(payload, ["name"])
							const name = requireBodyField(payload, "name", expectString).trim()
							if (!name) throw new HttpError(400, "List name is required")
							const now = utcNow()
							value = {
								...(await tx.shoppingList.create({
									data: {
										name,
										created_at: now,
										updated_at: now,
										members: { create: { user_id: user.id, role: "editor", created_at: now } },
									},
								})),
								role: "editor",
								hidden: false,
							}
						} else {
							const match = resolvedPath.match(/^\/api\/shopping-lists\/(\d+)$/)
							if (!match || !["PATCH", "DELETE"].includes(method))
								throw new HttpError(400, "This action needs an internet connection")
							const listId = Number(match[1])
							const member = await requireShoppingListMember(
								transaction,
								user.id,
								listId,
								method === "DELETE" || "name" in payload,
							)
							if (method === "DELETE") {
								await tx.shoppingListItem.deleteMany({ where: { shopping_list_id: listId } })
								await tx.shoppingList.delete({ where: { id: listId } })
								value = { id: listId, deleted: true }
							} else {
								assertKnownFields(payload, ["name", "hidden"])
								if (!Object.keys(payload).length) throw new HttpError(400, "Provide changes")
								if ("name" in payload) {
									const name = requireBodyField(payload, "name", expectString).trim()
									if (!name) throw new HttpError(400, "List name is required")
									await tx.shoppingList.update({ where: { id: listId }, data: { name, updated_at: utcNow() } })
								}
								if ("hidden" in payload)
									await tx.shoppingListMember.update({
										where: { shopping_list_id_user_id: { shopping_list_id: listId, user_id: user.id } },
										data: { hidden: requireBodyField(payload, "hidden", expectBoolean) },
									})
								value = {
									...(await tx.shoppingList.findUnique({ where: { id: listId } })),
									role: member.role,
									hidden: payload.hidden ?? member.hidden,
								}
							}
						}
						return value as JsonValue
					})
				} catch (error) {
					// Validation failures have rolled back. An unexpected database error
					// leaves an uncertain receipt so a retry cannot duplicate a commit.
					if (error instanceof HttpError) store.entries.delete(id)
					throw error
				}
				store.confirm(id, result)
				results.push({ id, status: 200, result })
			} catch (error) {
				results.push({
					id,
					status: error instanceof HttpError ? error.status : 500,
					error: error instanceof HttpError ? error.message : "Could not sync this change. It is still saved on this device.",
				})
			}
		}
		return json(200, { results })
	})
}
