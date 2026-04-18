import type { BunRequest } from "bun";

import {
	assertKnownFields,
	empty,
	expectDecimal,
	expectInteger,
	expectNullableDecimal,
	expectString,
	HttpError,
	json,
	parseDecimalQuery,
	parseIdParam,
	parseIntegerQuery,
	parseSortOrder,
	readJsonObject,
	readOptionalBodyField,
	requireBodyField,
	utcNow,
	withErrorHandling,
	type Database,
	type JsonObject,
} from "./core";
import {
	ensureProductExists,
	ensureReceiptExists,
} from "./reference-details";

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

const fetchReceiptItem = (db: Database, id: number) =>
	db.client.receiptItem.findUnique({ where: { id } });

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
			case "receipt_id":
			case "product_id":
				where[key] = parseIntegerQuery(key, value);
				break;
			case "quantity":
			case "unit_price":
			case "line_total":
				where[key] = value === "null" ? null : parseDecimalQuery(key, value);
				break;
			case "unit":
			case "created_at":
				where[key] = value === "null" ? null : value;
				break;
			default:
				throw new HttpError(400, `Unknown query parameter \`${key}\``);
		}
	}

	return where;
};

const parseCreateValues = (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	return {
		receipt_id: requireBodyField(body, "receipt_id", expectInteger),
		product_id: requireBodyField(body, "product_id", expectInteger),
		quantity: requireBodyField(body, "quantity", expectDecimal),
		unit: requireBodyField(body, "unit", expectString),
		unit_price:
			readOptionalBodyField(body, "unit_price", expectNullableDecimal) ?? null,
		line_total:
			readOptionalBodyField(body, "line_total", expectNullableDecimal) ?? null,
		created_at: utcNow(),
	};
};

const parseReplaceValues = (
	body: JsonObject,
	existingRow: Awaited<ReturnType<typeof fetchReceiptItem>>,
) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	return {
		receipt_id: requireBodyField(body, "receipt_id", expectInteger),
		product_id: requireBodyField(body, "product_id", expectInteger),
		quantity: requireBodyField(body, "quantity", expectDecimal),
		unit: requireBodyField(body, "unit", expectString),
		unit_price:
			readOptionalBodyField(body, "unit_price", expectNullableDecimal) ?? null,
		line_total:
			readOptionalBodyField(body, "line_total", expectNullableDecimal) ?? null,
		created_at: existingRow?.created_at ?? utcNow(),
	};
};

const parsePatchValues = (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	const values: Record<string, unknown> = {};

	const receiptId = readOptionalBodyField(body, "receipt_id", expectInteger);
	const productId = readOptionalBodyField(body, "product_id", expectInteger);
	const quantity = readOptionalBodyField(body, "quantity", expectDecimal);
	const unit = readOptionalBodyField(body, "unit", expectString);
	const unitPrice = readOptionalBodyField(body, "unit_price", expectNullableDecimal);
	const lineTotal = readOptionalBodyField(body, "line_total", expectNullableDecimal);

	if (receiptId !== undefined) values.receipt_id = receiptId;
	if (productId !== undefined) values.product_id = productId;
	if (quantity !== undefined) values.quantity = quantity;
	if (unit !== undefined) values.unit = unit;
	if (unitPrice !== undefined) values.unit_price = unitPrice;
	if (lineTotal !== undefined) values.line_total = lineTotal;

	if (Object.keys(values).length === 0) {
		throw new HttpError(400, "PATCH request must contain at least one writable field");
	}

	return values;
};

export const receiptItemsCollectionRoute = (db: Database) =>
	withErrorHandling(async (req: Request) => {
		if (req.method === "GET") {
			const url = new URL(req.url);
			return json(
				200,
				await db.client.receiptItem.findMany({
					where: parseFilters(url),
					orderBy: parseSort(url),
				}),
			);
		}

		if (req.method === "POST") {
			const values = parseCreateValues(await readJsonObject(req));
			await ensureReceiptExists(db, values.receipt_id);
			await ensureProductExists(db, values.product_id);
			return json(
				201,
				await db.client.receiptItem.create({
					data: values,
				}),
			);
		}

		throw new HttpError(405, "Method not allowed for this route");
	});

export const receiptItemDetailRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		const id = parseIdParam(req.params.id);
		const existingRow = await fetchReceiptItem(db, id);
		if (!existingRow) {
			throw new HttpError(404, "Resource not found");
		}

		if (req.method === "GET") return json(200, existingRow);
		if (req.method === "PUT") {
			const values = parseReplaceValues(await readJsonObject(req), existingRow);
			await ensureReceiptExists(db, values.receipt_id);
			await ensureProductExists(db, values.product_id);
			return json(
				200,
				await db.client.receiptItem.update({
					where: { id },
					data: values,
				}),
			);
		}
		if (req.method === "PATCH") {
			const values = parsePatchValues(await readJsonObject(req));
			await ensureReceiptExists(
				db,
				(values.receipt_id as number | undefined) ?? existingRow.receipt_id,
			);
			await ensureProductExists(
				db,
				(values.product_id as number | undefined) ?? existingRow.product_id,
			);
			return json(
				200,
				await db.client.receiptItem.update({
					where: { id },
					data: values,
				}),
			);
		}
		if (req.method === "DELETE") {
			await db.client.$transaction([
				db.client.inventoryItem.updateMany({
					where: { receipt_item_id: id },
					data: {
						receipt_item_id: null,
						updated_at: utcNow(),
					},
				}),
				db.client.receiptItem.delete({ where: { id } }),
			]);
			return empty(204);
		}
		throw new HttpError(405, "Method not allowed for this route");
	});
