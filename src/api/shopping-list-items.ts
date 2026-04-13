import type { BunRequest } from "bun";
import { Database } from "bun:sqlite";

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
	insertRow,
	json,
	parseBooleanQuery,
	parseDecimalQuery,
	parseIntegerQuery,
	parseSortOrder,
	parseIdParam,
	queryRow,
	queryRows,
	readJsonObject,
	readOptionalBodyField,
	requireBodyField,
	serializeBooleanFields,
	updateRowById,
	utcNow,
	withErrorHandling,
	type JsonObject,
	type RowValues,
} from "./core";

const TABLE = "shopping_list_items";
const DEFAULT_SORT = "created_at DESC, id DESC";
const SORT_FIELDS = new Set([
	"id",
	"product_id",
	"quantity",
	"unit",
	"done",
	"source_recipe_id",
	"notes",
	"created_at",
	"updated_at",
]);
const WRITABLE_FIELDS = [
	"product_id",
	"quantity",
	"unit",
	"done",
	"source_recipe_id",
	"notes",
];

const serializeShoppingListItem = (row: Record<string, unknown> | null) =>
	serializeBooleanFields(row, ["done"]);

const fetchShoppingListItem = (db: Database, id: number) =>
	serializeShoppingListItem(
		queryRow(db, `SELECT * FROM ${TABLE} WHERE id = ?1`, id),
	);

const parseSort = (url: URL) => {
	const sort = url.searchParams.get("sort");
	if (!sort) return DEFAULT_SORT;
	if (!SORT_FIELDS.has(sort))
		throw new HttpError(400, `Unknown sort field \`${sort}\``);
	return `${sort} ${parseSortOrder(url)}`;
};

const parseFilters = (url: URL) => {
	const filters: string[] = [];
	const params: Array<string | number> = [];
	for (const [key, value] of url.searchParams.entries()) {
		if (key === "sort" || key === "order") continue;
		switch (key) {
			case "id":
			case "product_id":
			case "source_recipe_id":
				if (value === "null") {
					filters.push(`${key} IS NULL`);
				} else {
					filters.push(`${key} = ?`);
					params.push(parseIntegerQuery(key, value));
				}
				break;
			case "quantity":
				filters.push("quantity = ?");
				params.push(parseDecimalQuery(key, value));
				break;
			case "unit":
			case "notes":
			case "created_at":
			case "updated_at":
				if (value === "null") {
					filters.push(`${key} IS NULL`);
				} else {
					filters.push(`${key} = ?`);
					params.push(value);
				}
				break;
			case "done":
				filters.push("done = ?");
				params.push(parseBooleanQuery(key, value));
				break;
			default:
				throw new HttpError(400, `Unknown query parameter \`${key}\``);
		}
	}
	return { filters, params };
};

const parseCreateValues = (body: JsonObject): RowValues => {
	assertKnownFields(body, WRITABLE_FIELDS);
	const now = utcNow();
	return {
		product_id: requireBodyField(body, "product_id", expectInteger),
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
	};
};

const parseReplaceValues = (
	body: JsonObject,
	existingRow: Record<string, unknown>,
): RowValues => {
	assertKnownFields(body, WRITABLE_FIELDS);
	return {
		product_id: requireBodyField(body, "product_id", expectInteger),
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
		created_at: String(existingRow.created_at),
		updated_at: utcNow(),
	};
};

const parsePatchValues = (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	const values: RowValues = {};
	const productId = readOptionalBodyField(body, "product_id", expectInteger);
	const quantity = readOptionalBodyField(body, "quantity", expectDecimal);
	const unit = readOptionalBodyField(body, "unit", expectString);
	const done = readOptionalBodyField(body, "done", expectBoolean);
	const sourceRecipeId = readOptionalBodyField(
		body,
		"source_recipe_id",
		expectNullableInteger,
	);
	const notes = readOptionalBodyField(body, "notes", expectNullableString);

	if (productId !== undefined) values.product_id = productId;
	if (quantity !== undefined) values.quantity = quantity;
	if (unit !== undefined) values.unit = unit;
	if (done !== undefined) values.done = done;
	if (sourceRecipeId !== undefined) values.source_recipe_id = sourceRecipeId;
	if (notes !== undefined) values.notes = notes;

	if (Object.keys(values).length === 0) {
		throw new HttpError(
			400,
			"PATCH request must contain at least one writable field",
		);
	}

	values.updated_at = utcNow();
	return values;
};

export const shoppingListItemsCollectionRoute = (db: Database) =>
	withErrorHandling(async (req: Request) => {
		if (req.method === "GET") {
			const url = new URL(req.url);
			const { filters, params } = parseFilters(url);
			const whereClause =
				filters.length > 0 ? ` WHERE ${filters.join(" AND ")}` : "";
			const rows = queryRows(
				db,
				`SELECT * FROM ${TABLE}${whereClause} ORDER BY ${parseSort(url)}`,
				...params,
			);
			return json(
				200,
				rows.map((row) => serializeShoppingListItem(row) ?? {}),
			);
		}
		if (req.method === "POST") {
			const id = insertRow(
				db,
				TABLE,
				parseCreateValues(await readJsonObject(req)),
			);
			return json(201, fetchShoppingListItem(db, id) ?? {});
		}
		throw new HttpError(405, "Method not allowed for this route");
	});

export const shoppingListItemDetailRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		const id = parseIdParam(req.params.id);
		const existingRow = queryRow(
			db,
			`SELECT * FROM ${TABLE} WHERE id = ?1`,
			id,
		);
		if (!existingRow) throw new HttpError(404, "Resource not found");

		if (req.method === "GET") {
			return json(200, serializeShoppingListItem(existingRow) ?? {});
		}
		if (req.method === "PUT") {
			updateRowById(
				db,
				TABLE,
				id,
				parseReplaceValues(await readJsonObject(req), existingRow),
			);
			return json(200, fetchShoppingListItem(db, id) ?? {});
		}
		if (req.method === "PATCH") {
			updateRowById(
				db,
				TABLE,
				id,
				parsePatchValues(await readJsonObject(req)),
			);
			return json(200, fetchShoppingListItem(db, id) ?? {});
		}
		if (req.method === "DELETE") {
			db.prepare(`DELETE FROM ${TABLE} WHERE id = ?1`).run(id);
			return empty(204);
		}
		throw new HttpError(405, "Method not allowed for this route");
	});
