import type { BunRequest } from "bun";

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
	json,
	parseDecimalQuery,
	parseIdParam,
	parseIntegerQuery,
	parseSortOrder,
	parseTimestampQuery,
	readJsonObject,
	readOptionalBodyField,
	requireBodyField,
	utcNow,
	withErrorHandling,
	type Database,
	type JsonObject,
} from "./core";

const SORT_FIELDS = new Set([
	"id",
	"product_id",
	"receipt_item_id",
	"container_id",
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
	"container_id",
	"quantity",
	"unit",
	"purchased_at",
	"expires_at",
	"consumed_at",
	"notes",
];

const fetchInventoryItem = (db: Database, id: number) =>
	db.client.inventoryItem.findUnique({ where: { id } });

const parseSort = (url: URL) => {
	const sort = url.searchParams.get("sort");
	if (!sort) return [{ id: "asc" }] as const;
	if (!SORT_FIELDS.has(sort)) {
		throw new HttpError(400, `Unknown sort field \`${sort}\``);
	}
	return [{ [sort]: parseSortOrder(url) }];
};

const parseFilters = (url: URL) => {
	const where: Record<string, unknown> = {};
	for (const [key, value] of url.searchParams.entries()) {
		if (key === "sort" || key === "order") continue;
		switch (key) {
			case "id":
			case "product_id":
			case "receipt_item_id":
			case "container_id":
				where[key] = value === "null" ? null : parseIntegerQuery(key, value);
				break;
			case "quantity":
				where.quantity = parseDecimalQuery(key, value);
				break;
			case "unit":
			case "notes":
			case "created_at":
			case "updated_at":
				where[key] = value === "null" ? null : value;
				break;
			case "purchased_at":
			case "expires_at":
			case "consumed_at":
				where[key] = value === "null" ? null : parseTimestampQuery(key, value);
				break;
			default:
				throw new HttpError(400, `Unknown query parameter \`${key}\``);
		}
	}
	return where;
};

const parseCreateValues = (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	const now = utcNow();
	return {
		product_id: requireBodyField(body, "product_id", expectInteger),
		receipt_item_id:
			readOptionalBodyField(body, "receipt_item_id", expectNullableInteger) ?? null,
		container_id:
			readOptionalBodyField(body, "container_id", expectNullableInteger) ?? null,
		quantity: requireBodyField(body, "quantity", expectDecimal),
		unit: requireBodyField(body, "unit", expectString),
		purchased_at:
			readOptionalBodyField(body, "purchased_at", expectNullableTimestamp) ?? null,
		expires_at:
			readOptionalBodyField(body, "expires_at", expectNullableTimestamp) ?? null,
		consumed_at:
			readOptionalBodyField(body, "consumed_at", expectNullableTimestamp) ?? null,
		notes: readOptionalBodyField(body, "notes", expectNullableString) ?? null,
		created_at: now,
		updated_at: now,
	};
};

const parseReplaceValues = (
	body: JsonObject,
	existingRow: Awaited<ReturnType<typeof fetchInventoryItem>>,
) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	return {
		product_id: requireBodyField(body, "product_id", expectInteger),
		receipt_item_id:
			readOptionalBodyField(body, "receipt_item_id", expectNullableInteger) ?? null,
		container_id:
			readOptionalBodyField(body, "container_id", expectNullableInteger) ?? null,
		quantity: requireBodyField(body, "quantity", expectDecimal),
		unit: requireBodyField(body, "unit", expectString),
		purchased_at:
			readOptionalBodyField(body, "purchased_at", expectNullableTimestamp) ?? null,
		expires_at:
			readOptionalBodyField(body, "expires_at", expectNullableTimestamp) ?? null,
		consumed_at:
			readOptionalBodyField(body, "consumed_at", expectNullableTimestamp) ?? null,
		notes: readOptionalBodyField(body, "notes", expectNullableString) ?? null,
		created_at: existingRow?.created_at ?? utcNow(),
		updated_at: utcNow(),
	};
};

const parsePatchValues = (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	const values: Record<string, unknown> = {};

	const productId = readOptionalBodyField(body, "product_id", expectInteger);
	const receiptItemId = readOptionalBodyField(
		body,
		"receipt_item_id",
		expectNullableInteger,
	);
	const containerId = readOptionalBodyField(
		body,
		"container_id",
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
	if (containerId !== undefined) values.container_id = containerId;
	if (quantity !== undefined) values.quantity = quantity;
	if (unit !== undefined) values.unit = unit;
	if (purchasedAt !== undefined) values.purchased_at = purchasedAt;
	if (expiresAt !== undefined) values.expires_at = expiresAt;
	if (consumedAt !== undefined) values.consumed_at = consumedAt;
	if (notes !== undefined) values.notes = notes;

	if (Object.keys(values).length === 0) {
		throw new HttpError(400, "PATCH request must contain at least one writable field");
	}

	values.updated_at = utcNow();
	return values;
};

export const inventoryItemsCollectionRoute = (db: Database) =>
	withErrorHandling(async (req: Request) => {
		if (req.method === "GET") {
			const url = new URL(req.url);
			return json(
				200,
				await db.client.inventoryItem.findMany({
					where: parseFilters(url),
					orderBy: parseSort(url),
				}),
			);
		}
		if (req.method === "POST") {
			return json(
				201,
				await db.client.inventoryItem.create({
					data: parseCreateValues(await readJsonObject(req)),
				}),
			);
		}
		throw new HttpError(405, "Method not allowed for this route");
	});

export const inventoryItemDetailRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		const id = parseIdParam(req.params.id);
		const existingRow = await fetchInventoryItem(db, id);
		if (!existingRow) throw new HttpError(404, "Resource not found");

		if (req.method === "GET") return json(200, existingRow);
		if (req.method === "PUT") {
			return json(
				200,
				await db.client.inventoryItem.update({
					where: { id },
					data: parseReplaceValues(await readJsonObject(req), existingRow),
				}),
			);
		}
		if (req.method === "PATCH") {
			return json(
				200,
				await db.client.inventoryItem.update({
					where: { id },
					data: parsePatchValues(await readJsonObject(req)),
				}),
			);
		}
		if (req.method === "DELETE") {
			await db.client.inventoryItem.delete({ where: { id } });
			return empty(204);
		}
		throw new HttpError(405, "Method not allowed for this route");
	});
