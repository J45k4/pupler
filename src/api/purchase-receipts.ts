import type { BunRequest } from "bun";

import { db } from "../db";
import {
	assertKnownFields,
	empty,
	expectNullableDecimal,
	expectNullableInteger,
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
	type Database,
	type JsonObject,
} from "./core";
import {
	deleteStoredFileBestEffort,
	readStoredFile,
	writeUploadedFile,
} from "./file-storage";
import {
	ensureGroupExists,
	fileDetailSelect,
	receiptDetailSelect,
} from "./reference-details";

const MAX_PURCHASE_RECEIPT_PICTURE_BYTES = 10 * 1024 * 1024;
const SORT_FIELDS = new Set([
	"id",
	"group_id",
	"store_name",
	"purchased_at",
	"currency",
	"total_amount",
	"created_at",
	"updated_at",
]);
const WRITABLE_FIELDS = [
	"group_id",
	"store_name",
	"purchased_at",
	"currency",
	"total_amount",
];

const fetchReceipt = (db: Database, id: number) =>
	db.client.receipt.findUnique({ where: { id } });

const fetchReceiptDetail = (db: Database, id: number) =>
	db.client.receipt.findUnique({
		where: { id },
		select: receiptDetailSelect,
	});

const fetchReceiptPicture = (db: Database, receiptId: number) =>
	db.client.receipt.findUnique({
		where: { id: receiptId },
		select: {
			id: true,
			picture_file_id: true,
			picture_file: {
				select: {
					path: true,
					...fileDetailSelect,
				},
			},
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
			case "group_id":
				where.group_id =
					value === "null" ? null : parseIntegerQuery(key, value);
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
		group_id:
			readOptionalBodyField(body, "group_id", expectNullableInteger) ?? null,
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
		group_id:
			readOptionalBodyField(body, "group_id", expectNullableInteger) ?? null,
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
	const groupId = readOptionalBodyField(
		body,
		"group_id",
		expectNullableInteger,
	);
	const purchasedAt = readOptionalBodyField(body, "purchased_at", expectTimestamp);
	const currency = readOptionalBodyField(body, "currency", expectString);
	const totalAmount = readOptionalBodyField(
		body,
		"total_amount",
		expectNullableDecimal,
	);

	if (groupId !== undefined) values.group_id = groupId;
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

export const receiptsCollectionRoute = async (req: Request) => {
	if (req.method === "GET") {
		const url = new URL(req.url);
		return json(
			200,
			await db.client.receipt.findMany({
				where: parseFilters(url),
				orderBy: parseSort(url),
				select: receiptDetailSelect,
			}),
		);
	}

	if (req.method === "POST") {
		const values = parseCreateValues(await readJsonObject(req));
		await ensureGroupExists(db, values.group_id);
		const created = await db.client.receipt.create({
			data: values,
		});
		return json(
			201,
			await fetchReceiptDetail(db, created.id),
		);
	}

	throw new HttpError(405, "Method not allowed for this route");
};

export const receiptDetailRoute = async (req: BunRequest<string>) => {
	const id = parseIdParam(req.params.id);
	const existingRow = await fetchReceipt(db, id);
	if (!existingRow) {
		throw new HttpError(404, "Resource not found");
	}

	if (req.method === "GET") return json(200, await fetchReceiptDetail(db, id));
	if (req.method === "PUT") {
		const values = parseReplaceValues(await readJsonObject(req), existingRow);
		await ensureGroupExists(db, values.group_id);
		await db.client.receipt.update({
			where: { id },
			data: values,
		});
		return json(
			200,
			await fetchReceiptDetail(db, id),
		);
	}
	if (req.method === "PATCH") {
		const values = parsePatchValues(await readJsonObject(req));
		if ("group_id" in values) {
			await ensureGroupExists(db, values.group_id as number | null);
		}
		await db.client.receipt.update({
			where: { id },
			data: values,
		});
		return json(
			200,
			await fetchReceiptDetail(db, id),
		);
	}
	if (req.method === "DELETE") {
		const existingPicture = await fetchReceiptPicture(db, id);
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
		if (existingPicture?.picture_file) {
			await db.client.file.delete({
				where: { id: existingPicture.picture_file.id },
			});
			await deleteStoredFileBestEffort(db, existingPicture.picture_file.path);
		}
		return empty(204);
	}
	throw new HttpError(405, "Method not allowed for this route");
};

export const receiptPictureRoute = async (req: BunRequest<string>) => {
	const receiptId = parseIdParam(req.params.id);
	const receipt = await fetchReceipt(db, receiptId);
	if (!receipt) {
		throw new HttpError(404, "Resource not found");
	}

	if (req.method === "GET") {
		const row = await fetchReceiptPicture(db, receiptId);
		if (!row?.picture_file) {
			throw new HttpError(404, "Receipt picture not found");
		}
		return new Response(
			await readStoredFile(
				db,
				row.picture_file.path,
				"Receipt picture not found",
			),
			{
				status: 200,
				headers: {
					"Content-Type": row.picture_file.content_type,
					"Cache-Control": "no-store",
					...(row.picture_file.filename
						? {
								"Content-Disposition": `inline; filename="${row.picture_file.filename}"`,
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
				picture_file_id: null,
			},
		});
		if (existingPicture?.picture_file) {
			await db.client.file.delete({
				where: { id: existingPicture.picture_file.id },
			});
			await deleteStoredFileBestEffort(db, existingPicture.picture_file.path);
		}
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
					picture_file: {
						create: {
							path: storedFile.relativePath,
							content_type: uploaded.type,
							filename: uploaded.name || null,
							size_bytes: uploaded.size,
							created_at: utcNow(),
						},
					},
				},
			});
		} catch (error) {
			await deleteStoredFileBestEffort(db, storedFile.relativePath);
			throw error;
		}

		if (previousPicture?.picture_file) {
			await db.client.file.delete({
				where: { id: previousPicture.picture_file.id },
			});
			await deleteStoredFileBestEffort(db, previousPicture.picture_file.path);
		}

		return json(200, {
			receipt_id: receiptId,
			content_type: uploaded.type,
			filename: uploaded.name || null,
			size: uploaded.size,
		});
	}

	throw new HttpError(405, "Method not allowed for this route");
};
