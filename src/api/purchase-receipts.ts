import type { BunRequest } from "bun";
import { Database } from "bun:sqlite";

import {
	assertKnownFields,
	empty,
	expectNullableDecimal,
	expectString,
	expectTimestamp,
	HttpError,
	insertRow,
	json,
	parseDecimalQuery,
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

const TABLE = "purchase_receipts";
const SORT_FIELDS = new Set([
	"id",
	"store_name",
	"purchased_at",
	"currency",
	"total_amount",
	"created_at",
	"updated_at",
]);
const WRITABLE_FIELDS = [
	"store_name",
	"purchased_at",
	"currency",
	"total_amount",
];

const fetchPurchaseReceipt = (db: Database, id: number) =>
	queryRow(db, `SELECT * FROM ${TABLE} WHERE id = ?1`, id);

const parseSort = (url: URL) => {
	const sort = url.searchParams.get("sort");
	if (!sort) return "id ASC";
	if (!SORT_FIELDS.has(sort)) {
		throw new HttpError(400, `Unknown sort field \`${sort}\``);
	}
	return `${sort} ${parseSortOrder(url)}`;
};

const parseFilters = (url: URL) => {
	const filters: string[] = [];
	const params: Array<string | number> = [];

	for (const [key, value] of url.searchParams.entries()) {
		if (key === "sort" || key === "order") continue;
		switch (key) {
			case "id":
				filters.push("id = ?");
				params.push(Number.parseInt(value, 10));
				break;
			case "store_name":
			case "currency":
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
				filters.push("purchased_at = ?");
				params.push(parseTimestampQuery(key, value));
				break;
			case "total_amount":
				if (value === "null") {
					filters.push("total_amount IS NULL");
				} else {
					filters.push("total_amount = ?");
					params.push(parseDecimalQuery(key, value));
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
		store_name: requireBodyField(body, "store_name", expectString),
		purchased_at: requireBodyField(body, "purchased_at", expectTimestamp),
		currency: requireBodyField(body, "currency", expectString),
		total_amount:
			readOptionalBodyField(
				body,
				"total_amount",
				expectNullableDecimal,
			) ?? null,
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
		store_name: requireBodyField(body, "store_name", expectString),
		purchased_at: requireBodyField(body, "purchased_at", expectTimestamp),
		currency: requireBodyField(body, "currency", expectString),
		total_amount:
			readOptionalBodyField(
				body,
				"total_amount",
				expectNullableDecimal,
			) ?? null,
		created_at: String(existingRow.created_at),
		updated_at: utcNow(),
	};
};

const parsePatchValues = (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	const values: RowValues = {};

	const storeName = readOptionalBodyField(body, "store_name", expectString);
	const purchasedAt = readOptionalBodyField(
		body,
		"purchased_at",
		expectTimestamp,
	);
	const currency = readOptionalBodyField(body, "currency", expectString);
	const totalAmount = readOptionalBodyField(
		body,
		"total_amount",
		expectNullableDecimal,
	);

	if (storeName !== undefined) values.store_name = storeName;
	if (purchasedAt !== undefined) values.purchased_at = purchasedAt;
	if (currency !== undefined) values.currency = currency;
	if (totalAmount !== undefined) values.total_amount = totalAmount;

	if (Object.keys(values).length === 0) {
		throw new HttpError(
			400,
			"PATCH request must contain at least one writable field",
		);
	}

	values.updated_at = utcNow();
	return values;
};

export const purchaseReceiptsCollectionRoute = (db: Database) =>
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
			return json(201, fetchPurchaseReceipt(db, id) ?? {});
		}

		throw new HttpError(405, "Method not allowed for this route");
	});

export const purchaseReceiptDetailRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		const id = parseIdParam(req.params.id);
		const existingRow = fetchPurchaseReceipt(db, id);
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
			return json(200, fetchPurchaseReceipt(db, id) ?? {});
		}
		if (req.method === "PATCH") {
			updateRowById(
				db,
				TABLE,
				id,
				parsePatchValues(await readJsonObject(req)),
			);
			return json(200, fetchPurchaseReceipt(db, id) ?? {});
		}
		if (req.method === "DELETE") {
			db.prepare(`DELETE FROM ${TABLE} WHERE id = ?1`).run(id);
			return empty(204);
		}
		throw new HttpError(405, "Method not allowed for this route");
	});
