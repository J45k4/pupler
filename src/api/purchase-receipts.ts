import type { BunRequest } from "bun";

import {
	assertKnownFields,
	empty,
	expectNullableDecimal,
	expectString,
	expectTimestamp,
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
import {
	deleteStoredFileBestEffort,
	readStoredFile,
	writeUploadedFile,
} from "./file-storage";

const MAX_PURCHASE_RECEIPT_PICTURE_BYTES = 10 * 1024 * 1024;
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

const fetchReceipt = (db: Database, id: number) =>
	db.client.receipt.findUnique({ where: { id } });

const fetchReceiptPicture = (db: Database, receiptId: number) =>
	db.client.receipt.findUnique({
		where: { id: receiptId },
		select: {
			id: true,
			picture_path: true,
			picture_content_type: true,
			picture_filename: true,
			picture_uploaded_at: true,
		},
	});

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
				where.id = parseIntegerQuery(key, value);
				break;
			case "store_name":
			case "currency":
			case "created_at":
			case "updated_at":
				where[key] = value === "null" ? null : value;
				break;
			case "purchased_at":
				where.purchased_at = parseTimestampQuery(key, value);
				break;
			case "total_amount":
				where.total_amount =
					value === "null" ? null : parseDecimalQuery(key, value);
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
		store_name: requireBodyField(body, "store_name", expectString),
		purchased_at: requireBodyField(body, "purchased_at", expectTimestamp),
		currency: requireBodyField(body, "currency", expectString),
		total_amount:
			readOptionalBodyField(body, "total_amount", expectNullableDecimal) ?? null,
		created_at: now,
		updated_at: now,
	};
};

const parseReplaceValues = (
	body: JsonObject,
	existingRow: Awaited<ReturnType<typeof fetchReceipt>>,
) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	return {
		store_name: requireBodyField(body, "store_name", expectString),
		purchased_at: requireBodyField(body, "purchased_at", expectTimestamp),
		currency: requireBodyField(body, "currency", expectString),
		total_amount:
			readOptionalBodyField(body, "total_amount", expectNullableDecimal) ?? null,
		created_at: existingRow?.created_at ?? utcNow(),
		updated_at: utcNow(),
	};
};

const parsePatchValues = (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	const values: Record<string, unknown> = {};

	const storeName = readOptionalBodyField(body, "store_name", expectString);
	const purchasedAt = readOptionalBodyField(body, "purchased_at", expectTimestamp);
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
		throw new HttpError(400, "PATCH request must contain at least one writable field");
	}

	values.updated_at = utcNow();
	return values;
};

export const receiptsCollectionRoute = (db: Database) =>
	withErrorHandling(async (req: Request) => {
		if (req.method === "GET") {
			const url = new URL(req.url);
			return json(
				200,
				await db.client.receipt.findMany({
					where: parseFilters(url),
					orderBy: parseSort(url),
				}),
			);
		}

		if (req.method === "POST") {
			return json(
				201,
				await db.client.receipt.create({
					data: parseCreateValues(await readJsonObject(req)),
				}),
			);
		}

		throw new HttpError(405, "Method not allowed for this route");
	});

export const receiptDetailRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		const id = parseIdParam(req.params.id);
		const existingRow = await fetchReceipt(db, id);
		if (!existingRow) {
			throw new HttpError(404, "Resource not found");
		}

		if (req.method === "GET") return json(200, existingRow);
		if (req.method === "PUT") {
			return json(
				200,
				await db.client.receipt.update({
					where: { id },
					data: parseReplaceValues(await readJsonObject(req), existingRow),
				}),
			);
		}
		if (req.method === "PATCH") {
			return json(
				200,
				await db.client.receipt.update({
					where: { id },
					data: parsePatchValues(await readJsonObject(req)),
				}),
			);
		}
		if (req.method === "DELETE") {
			await db.client.$transaction(async (tx) => {
				const receiptItems = await tx.receiptItem.findMany({
					where: { receipt_id: id },
					select: { id: true },
				});

				if (receiptItems.length > 0) {
					await tx.inventoryItem.updateMany({
						where: {
							receipt_item_id: {
								in: receiptItems.map((item) => item.id),
							},
						},
						data: {
							receipt_item_id: null,
							updated_at: utcNow(),
						},
					});

					await tx.receiptItem.deleteMany({
						where: { receipt_id: id },
					});
				}

				await tx.receipt.delete({ where: { id } });
			});
			return empty(204);
		}
		throw new HttpError(405, "Method not allowed for this route");
	});

export const receiptPictureRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		const receiptId = parseIdParam(req.params.id);
		const receipt = await fetchReceipt(db, receiptId);
		if (!receipt) {
			throw new HttpError(404, "Resource not found");
		}

		if (req.method === "GET") {
			const row = await fetchReceiptPicture(db, receiptId);
			if (!row?.picture_path || !row.picture_content_type) {
				throw new HttpError(404, "Receipt picture not found");
			}
			return new Response(
				await readStoredFile(db, row.picture_path, "Receipt picture not found"),
				{
					status: 200,
					headers: {
						"Content-Type": row.picture_content_type,
						"Cache-Control": "no-store",
						...(row.picture_filename
							? {
									"Content-Disposition": `inline; filename="${row.picture_filename}"`,
								}
							: {}),
					},
				},
			);
		}

		if (req.method === "DELETE") {
			const existingPicture = await fetchReceiptPicture(db, receiptId);
			await db.client.receipt.update({
				where: { id: receiptId },
				data: {
					picture_path: null,
					picture_content_type: null,
					picture_filename: null,
					picture_uploaded_at: null,
				},
			});
			await deleteStoredFileBestEffort(db, existingPicture?.picture_path);
			return empty(204);
		}

		if (req.method === "POST") {
			const formData = await req.formData();
			const uploaded = formData.get("file");
			if (!(uploaded instanceof File)) {
				throw new HttpError(400, "Multipart form-data must include a `file` field");
			}
			if (!uploaded.type.startsWith("image/")) {
				throw new HttpError(400, "Uploaded file must be an image");
			}
			if (uploaded.size === 0) {
				throw new HttpError(400, "Uploaded file may not be empty");
			}
			if (uploaded.size > MAX_PURCHASE_RECEIPT_PICTURE_BYTES) {
				throw new HttpError(413, "Uploaded file exceeds the 10 MB limit");
			}

			const previousPicture = await fetchReceiptPicture(db, receiptId);
			const storedFile = await writeUploadedFile(db, {
				assetType: "receipt-pictures",
				file: uploaded,
				resourceId: receiptId,
			});

			try {
				await db.client.receipt.update({
					where: { id: receiptId },
					data: {
						picture_path: storedFile.relativePath,
						picture_content_type: uploaded.type,
						picture_filename: uploaded.name || null,
						picture_uploaded_at: utcNow(),
					},
				});
			} catch (error) {
				await deleteStoredFileBestEffort(db, storedFile.relativePath);
				throw error;
			}

			await deleteStoredFileBestEffort(db, previousPicture?.picture_path);

			return json(200, {
				receipt_id: receiptId,
				content_type: uploaded.type,
				filename: uploaded.name || null,
				size: uploaded.size,
			});
		}

		throw new HttpError(405, "Method not allowed for this route");
	});
