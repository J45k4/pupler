import type { BunRequest } from "bun"

import { db } from "../db"
import { requireAuthenticatedUser } from "./auth"
import type { TimeUser } from "./time-ownership"
import { requireShoppingListMember } from "./shopping-lists"
import {
	assertKnownFields,
	empty,
	expectBoolean,
	expectDecimal,
	expectInteger,
	expectNullableInteger,
	expectNullableString,
	expectString,
	HttpError,
	json,
	parseBooleanQuery,
	parseDecimalQuery,
	parseIdParam,
	parseIntegerQuery,
	parseSortOrder,
	readJsonObject,
	readOptionalBodyField,
	requireBodyField,
	utcNow,
	type Database,
	type JsonObject,
} from "./core"
import {
	shoppingListItemDetailSelect,
	validateIngredientProductRefs,
} from "./reference-details"

const DEFAULT_SORT = [{ created_at: "desc" as const }, { id: "desc" as const }]
const SORT_FIELDS = new Set([
	"id",
	"ingredient_id",
	"product_id",
	"name",
	"quantity",
	"unit",
	"done",
	"source_recipe_id",
	"notes",
	"created_at",
	"updated_at",
])
const WRITABLE_FIELDS = [
	"removed",
	"name",
	"ingredient_id",
	"product_id",
	"quantity",
	"unit",
	"done",
	"source_recipe_id",
	"notes",
]

const fetchShoppingListItem = (db: Database, id: number) =>
	db.client.shoppingListItem.findUnique({ where: { id } })

const fetchShoppingListItemDetail = (db: Database, id: number) =>
	db.client.shoppingListItem.findUnique({
		where: { id },
		select: shoppingListItemDetailSelect,
	})

const parseSort = (url: URL) => {
	const sort = url.searchParams.get("sort")
	if (!sort) return DEFAULT_SORT
	if (!SORT_FIELDS.has(sort)) {
		throw new HttpError(400, `Unknown sort field \`${sort}\``)
	}
	return [{ [sort]: parseSortOrder(url) }]
}

const parseFilters = (url: URL) => {
	const where: Record<string, unknown> = { removed_at: null }
	for (const [key, value] of url.searchParams.entries()) {
		if (key === "sort" || key === "order") continue
		switch (key) {
			case "id":
			case "shopping_list_id":
			case "ingredient_id":
			case "product_id":
			case "source_recipe_id":
				where[key] =
					value === "null" ? null : parseIntegerQuery(key, value)
				break
			case "name":
				where.name = value === "null" ? null : value
				break
			case "quantity":
				where.quantity = parseDecimalQuery(key, value)
				break
			case "unit":
			case "notes":
			case "created_at":
			case "updated_at":
				where[key] = value === "null" ? null : value
				break
			case "removed":
				if (value === "all") delete where.removed_at
				else where.removed_at = parseBooleanQuery(key, value) ? { not: null } : null
				break
			case "done":
				where.done = parseBooleanQuery(key, value)
				break
			default:
				throw new HttpError(400, `Unknown query parameter \`${key}\``)
		}
	}
	return where
}

const removalValues = (body: JsonObject, existing?: { done: boolean; removed_at: string | null } | null) => {
	const removed = readOptionalBodyField(body, "removed", expectBoolean)
	const done = readOptionalBodyField(body, "done", expectBoolean)
	if (removed === true && done === true) throw new HttpError(400, "An item cannot be both done and removed")
	if (removed === true) return { removed_at: existing?.removed_at ?? utcNow(), done: false }
	if (removed === false || done === true) return { removed_at: null }
	return {}
}

const parseCreateValues = (body: JsonObject) => {
	assertKnownFields(body, [...WRITABLE_FIELDS, "shopping_list_id"])
	const now = utcNow()
	return {
		shopping_list_id: readOptionalBodyField(body, "shopping_list_id", expectInteger) ?? 1,
		name: requireBodyField(body, "name", expectString),
		ingredient_id:
			readOptionalBodyField(
				body,
				"ingredient_id",
				expectNullableInteger,
			) ?? null,
		product_id:
			readOptionalBodyField(body, "product_id", expectNullableInteger) ??
			null,
		quantity: requireBodyField(body, "quantity", expectDecimal),
		unit: requireBodyField(body, "unit", expectString),
		done: requireBodyField(body, "done", expectBoolean),
		source_recipe_id:
			readOptionalBodyField(
				body,
				"source_recipe_id",
				expectNullableInteger,
			) ?? null,
		notes:
			readOptionalBodyField(body, "notes", expectNullableString) ?? null,
		created_at: now,
		updated_at: now,
	}
}

const parseReplaceValues = (
	body: JsonObject,
	existingRow: Awaited<ReturnType<typeof fetchShoppingListItem>>,
) => {
	assertKnownFields(body, WRITABLE_FIELDS)
	return {
		name: requireBodyField(body, "name", expectString),
		ingredient_id:
			readOptionalBodyField(
				body,
				"ingredient_id",
				expectNullableInteger,
			) ?? null,
		product_id:
			readOptionalBodyField(body, "product_id", expectNullableInteger) ??
			null,
		quantity: requireBodyField(body, "quantity", expectDecimal),
		unit: requireBodyField(body, "unit", expectString),
		done: requireBodyField(body, "done", expectBoolean),
		source_recipe_id:
			readOptionalBodyField(
				body,
				"source_recipe_id",
				expectNullableInteger,
			) ?? null,
		notes:
			readOptionalBodyField(body, "notes", expectNullableString) ?? null,
		created_at: existingRow?.created_at ?? utcNow(),
		updated_at: utcNow(),
	}
}

const parsePatchValues = (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS)
	const values: Record<string, unknown> = {}
	const name = readOptionalBodyField(body, "name", expectString)
	const ingredientId = readOptionalBodyField(
		body,
		"ingredient_id",
		expectNullableInteger,
	)
	const productId = readOptionalBodyField(
		body,
		"product_id",
		expectNullableInteger,
	)
	const quantity = readOptionalBodyField(body, "quantity", expectDecimal)
	const unit = readOptionalBodyField(body, "unit", expectString)
	const done = readOptionalBodyField(body, "done", expectBoolean)
	const sourceRecipeId = readOptionalBodyField(
		body,
		"source_recipe_id",
		expectNullableInteger,
	)
	const notes = readOptionalBodyField(body, "notes", expectNullableString)

	if (name !== undefined) values.name = name
	if (ingredientId !== undefined) values.ingredient_id = ingredientId
	if (productId !== undefined) values.product_id = productId
	if (quantity !== undefined) values.quantity = quantity
	if (unit !== undefined) values.unit = unit
	if (done !== undefined) values.done = done
	if (sourceRecipeId !== undefined) values.source_recipe_id = sourceRecipeId
	if (notes !== undefined) values.notes = notes

	if (Object.keys(values).length === 0 && body.removed === undefined) {
		throw new HttpError(
			400,
			"PATCH request must contain at least one writable field",
		)
	}

	values.updated_at = utcNow()
	return values
}

export const shoppingListItemsCollectionRoute = async (req: Request) => {
	const user = await requireAuthenticatedUser(req)
	if (req.method === "GET") {
		const url = new URL(req.url)
		if (url.searchParams.get("view") === "board") {
			if ([...url.searchParams.keys()].some(key => key !== "view")) throw new HttpError(400, "Board does not accept item filters")
			const membership = { shopping_list: { members: { some: { user_id: user.id } } } }
			const [items, removed] = await Promise.all([
				db.client.shoppingListItem.findMany({ where: { ...membership, removed_at: null }, orderBy: [...DEFAULT_SORT], select: shoppingListItemDetailSelect }),
				db.client.shoppingListItem.groupBy({ by: ["shopping_list_id"], where: { ...membership, removed_at: { not: null } }, _count: { _all: true } }),
			])
			return json(200, { items, removed_counts: Object.fromEntries(removed.map(row => [row.shopping_list_id, row._count._all])) })
		}
		if (url.searchParams.get("view") === "overview") {
			if ([...url.searchParams.keys()].some(key => key !== "view")) throw new HttpError(400, "Overview does not accept item filters")
			const where = { done: false, removed_at: null, shopping_list: { members: { some: { user_id: user.id } } } }
			const [items, total] = await Promise.all([
				db.client.shoppingListItem.findMany({ where, orderBy: [{ created_at: "asc" }, { id: "asc" }], take: 8, select: { id: true, name: true, quantity: true, unit: true } }),
				db.client.shoppingListItem.count({ where }),
			])
			return json(200, { items, total })
		}
		const where = { ...parseFilters(url), shopping_list: { members: { some: { user_id: user.id } } } }
		return json(
			200,
			await db.client.shoppingListItem.findMany({
				where,
				orderBy: parseSort(url),
				select: shoppingListItemDetailSelect,
			}),
		)
	}
	if (req.method === "POST") {
		const body = await readJsonObject(req)
		const values = parseCreateValues(body)
		await requireShoppingListMember(db, user.id, values.shopping_list_id, true)
		await validateIngredientProductRefs(db, values)
		const created = await db.client.shoppingListItem.create({
			data: { ...values, ...removalValues(body) },
		})
		return json(201, await fetchShoppingListItemDetail(db, created.id))
	}
	throw new HttpError(405, "Method not allowed for this route")
}

export const shoppingListItemDetailRoute = async (req: BunRequest<string>) => {
	const user = await requireAuthenticatedUser(req)
	const id = parseIdParam(req.params.id ?? "")
	const existingRow = await fetchShoppingListItem(db, id)
	if (!existingRow) throw new HttpError(404, "Resource not found")
	await requireShoppingListMember(db, user.id, existingRow.shopping_list_id, req.method !== "GET")

	if (req.method === "GET") {
		return json(200, await fetchShoppingListItemDetail(db, id))
	}
	if (req.method === "PUT") {
		const body = await readJsonObject(req)
		const values = parseReplaceValues(
			body,
			existingRow,
		)
		await validateIngredientProductRefs(db, values)
		await db.client.shoppingListItem.update({
			where: { id },
			data: { ...values, ...removalValues(body, existingRow) },
		})
		return json(200, await fetchShoppingListItemDetail(db, id))
	}
	if (req.method === "PATCH") {
		const body = await readJsonObject(req)
		const values = parsePatchValues(body)
		await validateIngredientProductRefs(db, {
			ingredient_id:
				(values.ingredient_id as number | null | undefined) ??
				existingRow.ingredient_id,
			product_id:
				(values.product_id as number | null | undefined) ??
				existingRow.product_id,
		})
		await db.client.shoppingListItem.update({
			where: { id },
			data: { ...values, ...removalValues(body, existingRow) },
		})
		return json(200, await fetchShoppingListItemDetail(db, id))
	}
	if (req.method === "DELETE") {
		await db.client.shoppingListItem.update({ where: { id }, data: { removed_at: existingRow.removed_at ?? utcNow(), done: false, updated_at: utcNow() } })
		return empty(204)
	}
	throw new HttpError(405, "Method not allowed for this route")
}

export const applyOfflineShoppingItemMutation = async (database: Database, user: TimeUser, path: string, method: string, body: JsonObject) => {
	if (path === "/api/shopping-list-items" && method === "POST") {
		const values = parseCreateValues(body)
		await requireShoppingListMember(database, user.id, values.shopping_list_id, true)
		await validateIngredientProductRefs(database, values)
		const created = await database.client.shoppingListItem.create({ data: { ...values, ...removalValues(body) } })
		return fetchShoppingListItemDetail(database, created.id)
	}
	const match = path.match(/^\/api\/shopping-list-items\/(\d+)$/)
	if (!match || !["PATCH", "DELETE"].includes(method)) throw new HttpError(400, "Unsupported offline shopping action")
	const id = parseIdParam(match[1]!)
	const existing = await fetchShoppingListItem(database, id)
	if (!existing) throw new HttpError(404, "Shopping item not found")
	await requireShoppingListMember(database, user.id, existing.shopping_list_id, true)
	const values = method === "DELETE" ? { done: false, updated_at: utcNow() } : parsePatchValues(body)
	await validateIngredientProductRefs(database, { ingredient_id: (values.ingredient_id as number | null | undefined) ?? existing.ingredient_id, product_id: (values.product_id as number | null | undefined) ?? existing.product_id })
	await database.client.shoppingListItem.update({ where: { id }, data: { ...values, ...removalValues(method === "DELETE" ? { removed: true } : body, existing) } })
	return fetchShoppingListItemDetail(database, id)
}
