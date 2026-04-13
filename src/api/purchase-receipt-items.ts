import type { BunRequest } from "bun";
import { Database } from "bun:sqlite";

import {
	assertKnownFields,
	empty,
	expectInteger,
	expectNullableDecimal,
	expectDecimal,
	expectString,
	HttpError,
	insertRow,
	json,
	parseDecimalQuery,
	parseIntegerQuery,
	parseSortOrder,
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

const TABLE = "purchase_receipt_items";
const SORT_FIELDS = new Set([
	"id",
	"receipt_id",
	"product_id",
	"quantity",
	"unit",
	"unit_price",
	"line_total",
	"created_at",
]);
const WRITABLE_FIELDS = [
	"receipt_id",
	"product_id",
	"quantity",
	"unit",
	"unit_price",
	"line_total",
];

const fetchPurchaseReceiptItem = (db: Database, id: number) =>
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
			case "receipt_id":
			case "product_id":
				filters.push(`${key} = ?`);
				params.push(parseIntegerQuery(key, value));
				break;
			case "quantity":
			case "unit_price":
			case "line_total":
				if (value === "null") {
					filters.push(`${key} IS NULL`);
				} else {
					filters.push(`${key} = ?`);
					params.push(parseDecimalQuery(key, value));
				}
				break;
			case "unit":
			case "created_at":
				if (value === "null") {
					filters.push(`${key} IS NULL`);
				} else {
					filters.push(`${key} = ?`);
					params.push(value);
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
	return {
		receipt_id: requireBodyField(body, "receipt_id", expectInteger),
		product_id: requireBodyField(body, "product_id", expectInteger),
		quantity: requireBodyField(body, "quantity", expectDecimal),
		unit: requireBodyField(body, "unit", expectString),
		unit_price:
			readOptionalBodyField(body, "unit_price", expectNullableDecimal) ??
			null,
		line_total:
			readOptionalBodyField(body, "line_total", expectNullableDecimal) ??
			null,
		created_at: utcNow(),
	};
};

const parseReplaceValues = (
	body: JsonObject,
	existingRow: Record<string, unknown>,
): RowValues => {
	assertKnownFields(body, WRITABLE_FIELDS);
	return {
		receipt_id: requireBodyField(body, "receipt_id", expectInteger),
		product_id: requireBodyField(body, "product_id", expectInteger),
		quantity: requireBodyField(body, "quantity", expectDecimal),
		unit: requireBodyField(body, "unit", expectString),
		unit_price:
			readOptionalBodyField(body, "unit_price", expectNullableDecimal) ??
			null,
		line_total:
			readOptionalBodyField(body, "line_total", expectNullableDecimal) ??
			null,
		created_at: String(existingRow.created_at),
	};
};

const parsePatchValues = (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	const values: RowValues = {};

	const receiptId = readOptionalBodyField(body, "receipt_id", expectInteger);
	const productId = readOptionalBodyField(body, "product_id", expectInteger);
	const quantity = readOptionalBodyField(body, "quantity", expectDecimal);
	const unit = readOptionalBodyField(body, "unit", expectString);
	const unitPrice = readOptionalBodyField(
		body,
		"unit_price",
		expectNullableDecimal,
	);
	const lineTotal = readOptionalBodyField(
		body,
		"line_total",
		expectNullableDecimal,
	);

	if (receiptId !== undefined) values.receipt_id = receiptId;
	if (productId !== undefined) values.product_id = productId;
	if (quantity !== undefined) values.quantity = quantity;
	if (unit !== undefined) values.unit = unit;
	if (unitPrice !== undefined) values.unit_price = unitPrice;
	if (lineTotal !== undefined) values.line_total = lineTotal;

	if (Object.keys(values).length === 0) {
		throw new HttpError(
			400,
			"PATCH request must contain at least one writable field",
		);
	}

	return values;
};

export const purchaseReceiptItemsCollectionRoute = (db: Database) =>
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
			return json(201, fetchPurchaseReceiptItem(db, id) ?? {});
		}

		throw new HttpError(405, "Method not allowed for this route");
	});

export const purchaseReceiptItemDetailRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		const id = parseIdParam(req.params.id);
		const existingRow = fetchPurchaseReceiptItem(db, id);
		if (!existingRow) {
			throw new HttpError(404, "Resource not found");
		}

		if (req.method === "GET") return json(200, existingRow);
		if (req.method === "PUT") {
			updateRowById(
				db,
				TABLE,
				id,
				parseReplaceValues(await readJsonObject(req), existingRow),
			);
			return json(200, fetchPurchaseReceiptItem(db, id) ?? {});
		}
		if (req.method === "PATCH") {
			updateRowById(
				db,
				TABLE,
				id,
				parsePatchValues(await readJsonObject(req)),
			);
			return json(200, fetchPurchaseReceiptItem(db, id) ?? {});
		}
		if (req.method === "DELETE") {
			db.prepare(`DELETE FROM ${TABLE} WHERE id = ?1`).run(id);
			return empty(204);
		}
		throw new HttpError(405, "Method not allowed for this route");
	});
