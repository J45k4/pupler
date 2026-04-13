import type { BunRequest } from "bun";
import { Database } from "bun:sqlite";

import {
	assertKnownFields,
	empty,
	expectDecimal,
	expectInteger,
	expectNullableInteger,
	expectNullableString,
	expectNullableTimestamp,
	expectString,
	HttpError,
	insertRow,
	json,
	parseBooleanQuery,
	parseDecimalQuery,
	parseIntegerQuery,
	parseSortOrder,
	parseTimestampQuery,
	parseIdParam,
	queryRow,
	queryRows,
	readJsonObject,
	readOptionalBodyField,
	requireBodyField,
	updateRowById,
	utcNow,
	withErrorHandling,
	type JsonObject,
	type RowValues,
} from "./core";

const TABLE = "inventory_items";
const SORT_FIELDS = new Set([
	"id",
	"product_id",
	"receipt_item_id",
	"quantity",
	"unit",
	"purchased_at",
	"expires_at",
	"consumed_at",
	"notes",
	"created_at",
	"updated_at",
]);
const WRITABLE_FIELDS = [
	"product_id",
	"receipt_item_id",
	"quantity",
	"unit",
	"purchased_at",
	"expires_at",
	"consumed_at",
	"notes",
];

const fetchInventoryItem = (db: Database, id: number) =>
	queryRow(db, `SELECT * FROM ${TABLE} WHERE id = ?1`, id);

const parseSort = (url: URL) => {
	const sort = url.searchParams.get("sort");
	if (!sort) return "id ASC";
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
			case "receipt_item_id":
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
			case "purchased_at":
			case "expires_at":
			case "consumed_at":
				if (value === "null") {
					filters.push(`${key} IS NULL`);
				} else {
					filters.push(`${key} = ?`);
					params.push(parseTimestampQuery(key, value));
				}
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
		receipt_item_id:
			readOptionalBodyField(
				body,
				"receipt_item_id",
				expectNullableInteger,
			) ?? null,
		quantity: requireBodyField(body, "quantity", expectDecimal),
		unit: requireBodyField(body, "unit", expectString),
		purchased_at:
			readOptionalBodyField(
				body,
				"purchased_at",
				expectNullableTimestamp,
			) ?? null,
		expires_at:
			readOptionalBodyField(
				body,
				"expires_at",
				expectNullableTimestamp,
			) ?? null,
		consumed_at:
			readOptionalBodyField(
				body,
				"consumed_at",
				expectNullableTimestamp,
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
		receipt_item_id:
			readOptionalBodyField(
				body,
				"receipt_item_id",
				expectNullableInteger,
			) ?? null,
		quantity: requireBodyField(body, "quantity", expectDecimal),
		unit: requireBodyField(body, "unit", expectString),
		purchased_at:
			readOptionalBodyField(
				body,
				"purchased_at",
				expectNullableTimestamp,
			) ?? null,
		expires_at:
			readOptionalBodyField(
				body,
				"expires_at",
				expectNullableTimestamp,
			) ?? null,
		consumed_at:
			readOptionalBodyField(
				body,
				"consumed_at",
				expectNullableTimestamp,
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
	const receiptItemId = readOptionalBodyField(
		body,
		"receipt_item_id",
		expectNullableInteger,
	);
	const quantity = readOptionalBodyField(body, "quantity", expectDecimal);
	const unit = readOptionalBodyField(body, "unit", expectString);
	const purchasedAt = readOptionalBodyField(
		body,
		"purchased_at",
		expectNullableTimestamp,
	);
	const expiresAt = readOptionalBodyField(
		body,
		"expires_at",
		expectNullableTimestamp,
	);
	const consumedAt = readOptionalBodyField(
		body,
		"consumed_at",
		expectNullableTimestamp,
	);
	const notes = readOptionalBodyField(body, "notes", expectNullableString);

	if (productId !== undefined) values.product_id = productId;
	if (receiptItemId !== undefined) values.receipt_item_id = receiptItemId;
	if (quantity !== undefined) values.quantity = quantity;
	if (unit !== undefined) values.unit = unit;
	if (purchasedAt !== undefined) values.purchased_at = purchasedAt;
	if (expiresAt !== undefined) values.expires_at = expiresAt;
	if (consumedAt !== undefined) values.consumed_at = consumedAt;
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

export const inventoryItemsCollectionRoute = (db: Database) =>
	withErrorHandling(async (req: Request) => {
		if (req.method === "GET") {
			const url = new URL(req.url);
			const { filters, params } = parseFilters(url);
			const whereClause =
				filters.length > 0 ? ` WHERE ${filters.join(" AND ")}` : "";
			return json(
				200,
				queryRows(
					db,
					`SELECT * FROM ${TABLE}${whereClause} ORDER BY ${parseSort(url)}`,
					...params,
				),
			);
		}
		if (req.method === "POST") {
			const id = insertRow(
				db,
				TABLE,
				parseCreateValues(await readJsonObject(req)),
			);
			return json(201, fetchInventoryItem(db, id) ?? {});
		}
		throw new HttpError(405, "Method not allowed for this route");
	});

export const inventoryItemDetailRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		const id = parseIdParam(req.params.id);
		const existingRow = fetchInventoryItem(db, id);
		if (!existingRow) throw new HttpError(404, "Resource not found");

		if (req.method === "GET") return json(200, existingRow);
		if (req.method === "PUT") {
			updateRowById(
				db,
				TABLE,
				id,
				parseReplaceValues(await readJsonObject(req), existingRow),
			);
			return json(200, fetchInventoryItem(db, id) ?? {});
		}
		if (req.method === "PATCH") {
			updateRowById(
				db,
				TABLE,
				id,
				parsePatchValues(await readJsonObject(req)),
			);
			return json(200, fetchInventoryItem(db, id) ?? {});
		}
		if (req.method === "DELETE") {
			db.prepare(`DELETE FROM ${TABLE} WHERE id = ?1`).run(id);
			return empty(204);
		}
		throw new HttpError(405, "Method not allowed for this route");
	});
