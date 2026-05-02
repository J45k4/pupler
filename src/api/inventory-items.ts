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
import {
	deleteStoredFileBestEffort,
	readStoredFile,
	writeUploadedFile,
} from "./file-storage";
import {
	inventoryItemDetailSelect,
	validateIngredientProductRefs,
} from "./reference-details";

const MAX_INVENTORY_ITEM_IMAGE_BYTES = 10 * 1024 * 1024;
const SORT_FIELDS = new Set([
	"id",
	"ingredient_id",
	"product_id",
	"receipt_item_id",
	"container_id",
	"name",
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
	"name",
	"ingredient_id",
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

const fetchInventoryItemDetail = (db: Database, id: number) =>
	db.client.inventoryItem.findUnique({
		where: { id },
		select: inventoryItemDetailSelect,
	});

const inventoryItemImageSelect = {
	id: true,
	inventory_item_id: true,
	file_id: true,
	created_at: true,
	file: {
		select: {
			id: true,
			content_type: true,
			filename: true,
			size_bytes: true,
			created_at: true,
		},
	},
} as const;

const fetchInventoryItemImage = (
	db: Database,
	inventoryItemId: number,
	pictureId: number,
) =>
	db.client.inventoryItemImage.findFirst({
		where: { id: pictureId, inventory_item_id: inventoryItemId },
		include: { file: true },
	});

const fetchInventoryItemImages = (db: Database, inventoryItemId: number) =>
	db.client.inventoryItemImage.findMany({
		where: { inventory_item_id: inventoryItemId },
		select: inventoryItemImageSelect,
		orderBy: [{ created_at: "desc" }, { id: "desc" }],
	});

const ensureInventoryItemExists = async (
	db: Database,
	inventoryItemId: number,
) => {
	const item = await fetchInventoryItem(db, inventoryItemId);
	if (!item) {
		throw new HttpError(404, "Resource not found");
	}
	return item;
};

const parseUploadedInventoryItemImages = (files: Array<File | string>) =>
	files.map((entry) => {
		if (!(entry instanceof File)) {
			throw new HttpError(400, "Multipart form-data must include one or more `file` fields");
		}
		if (!entry.type.startsWith("image/")) {
			throw new HttpError(400, "Uploaded file must be an image");
		}
		if (entry.size === 0) {
			throw new HttpError(400, "Uploaded file may not be empty");
		}
		if (entry.size > MAX_INVENTORY_ITEM_IMAGE_BYTES) {
			throw new HttpError(413, "Uploaded file exceeds the 10 MB limit");
		}
		return entry;
	});

const createInventoryItemImages = async (
	db: Database,
	inventoryItemId: number,
	files: File[],
) => {
	const writtenFiles: Array<{
		createdAt: string;
		file: File;
		relativePath: string;
	}> = [];

	try {
		for (const file of files) {
			const storedFile = await writeUploadedFile(db, {
				assetType: "inventory-item-images",
				file,
				resourceId: inventoryItemId,
			});
			writtenFiles.push({
				createdAt: utcNow(),
				file,
				relativePath: storedFile.relativePath,
			});
		}
	} catch (error) {
		await Promise.all(
			writtenFiles.map(({ relativePath }) =>
				deleteStoredFileBestEffort(db, relativePath),
			),
		);
		throw error;
	}

	try {
		return await db.client.$transaction(
			writtenFiles.map(({ createdAt, file, relativePath }) =>
				db.client.inventoryItemImage.create({
					data: {
						created_at: createdAt,
						inventory_item: {
							connect: { id: inventoryItemId },
						},
						file: {
							create: {
								path: relativePath,
								content_type: file.type,
								filename: file.name || null,
								size_bytes: file.size,
								created_at: createdAt,
							},
						},
					},
					select: inventoryItemImageSelect,
				}),
			),
		);
	} catch (error) {
		await Promise.all(
			writtenFiles.map(({ relativePath }) =>
				deleteStoredFileBestEffort(db, relativePath),
			),
		);
		throw error;
	}
};

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
			case "ingredient_id":
			case "product_id":
			case "receipt_item_id":
			case "container_id":
				where[key] = value === "null" ? null : parseIntegerQuery(key, value);
				break;
			case "name":
				where.name = value === "null" ? null : value;
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
		name: requireBodyField(body, "name", expectString),
		ingredient_id:
			readOptionalBodyField(body, "ingredient_id", expectNullableInteger) ?? null,
		product_id:
			readOptionalBodyField(body, "product_id", expectNullableInteger) ?? null,
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
		name: requireBodyField(body, "name", expectString),
		ingredient_id:
			readOptionalBodyField(body, "ingredient_id", expectNullableInteger) ?? null,
		product_id:
			readOptionalBodyField(body, "product_id", expectNullableInteger) ?? null,
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

	const name = readOptionalBodyField(body, "name", expectString);
	const ingredientId = readOptionalBodyField(
		body,
		"ingredient_id",
		expectNullableInteger,
	);
	const productId = readOptionalBodyField(
		body,
		"product_id",
		expectNullableInteger,
	);
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

	if (name !== undefined) values.name = name;
	if (ingredientId !== undefined) values.ingredient_id = ingredientId;
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
					select: inventoryItemDetailSelect,
				}),
			);
		}
		if (req.method === "POST") {
			const values = parseCreateValues(await readJsonObject(req));
			await validateIngredientProductRefs(db, values);
			const created = await db.client.inventoryItem.create({
				data: values,
			});
			return json(
				201,
				await fetchInventoryItemDetail(db, created.id),
			);
		}
		throw new HttpError(405, "Method not allowed for this route");
	});

export const inventoryItemDetailRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		const id = parseIdParam(req.params.id);
		const existingRow = await fetchInventoryItem(db, id);
		if (!existingRow) throw new HttpError(404, "Resource not found");

		if (req.method === "GET") {
			return json(200, await fetchInventoryItemDetail(db, id));
		}
		if (req.method === "PUT") {
			const values = parseReplaceValues(
				await readJsonObject(req),
				existingRow,
			);
			await validateIngredientProductRefs(db, values);
			await db.client.inventoryItem.update({
				where: { id },
				data: values,
			});
			return json(
				200,
				await fetchInventoryItemDetail(db, id),
			);
		}
		if (req.method === "PATCH") {
			const values = parsePatchValues(await readJsonObject(req));
			await validateIngredientProductRefs(db, {
				ingredient_id:
					(values.ingredient_id as number | null | undefined) ??
					existingRow.ingredient_id,
				product_id:
					(values.product_id as number | null | undefined) ??
					existingRow.product_id,
			});
			await db.client.inventoryItem.update({
				where: { id },
				data: values,
			});
			return json(
				200,
				await fetchInventoryItemDetail(db, id),
			);
		}
		if (req.method === "DELETE") {
			const images = await db.client.inventoryItemImage.findMany({
				where: { inventory_item_id: id },
				select: { file: { select: { id: true, path: true } } },
			});
			await db.client.inventoryItem.delete({ where: { id } });
			await db.client.file.deleteMany({
				where: {
					id: {
						in: images.map((image) => image.file.id),
					},
				},
			});
			await Promise.all(
				images.map((image) =>
					deleteStoredFileBestEffort(db, image.file.path),
				),
			);
			return empty(204);
		}
		throw new HttpError(405, "Method not allowed for this route");
	});

export const inventoryItemImagesCollectionRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		const inventoryItemId = parseIdParam(req.params.id);
		await ensureInventoryItemExists(db, inventoryItemId);

		if (req.method === "GET") {
			return json(200, await fetchInventoryItemImages(db, inventoryItemId));
		}

		if (req.method === "POST") {
			const formData = await req.formData();
			const uploaded = parseUploadedInventoryItemImages(formData.getAll("file"));
			if (uploaded.length === 0) {
				throw new HttpError(400, "Multipart form-data must include one or more `file` fields");
			}

			return json(
				201,
				await createInventoryItemImages(db, inventoryItemId, uploaded),
			);
		}

		throw new HttpError(405, "Method not allowed for this route");
	});

export const inventoryItemImageDetailRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		const inventoryItemId = parseIdParam(req.params.id);
		const pictureId = parseIdParam(req.params.pictureId);
		await ensureInventoryItemExists(db, inventoryItemId);
		const image = await fetchInventoryItemImage(
			db,
			inventoryItemId,
			pictureId,
		);
		if (!image) {
			throw new HttpError(404, "Inventory item image not found");
		}

		if (req.method === "GET") {
			return new Response(
				await readStoredFile(
					db,
					image.file.path,
					"Inventory item image not found",
				),
				{
					status: 200,
					headers: {
						"Content-Type": image.file.content_type,
						"Cache-Control": "no-store",
						...(image.file.filename
							? {
									"Content-Disposition": `inline; filename="${image.file.filename}"`,
								}
							: {}),
					},
				},
			);
		}

		if (req.method === "DELETE") {
			await db.client.inventoryItemImage.delete({
				where: { id: pictureId },
			});
			await db.client.file.delete({ where: { id: image.file.id } });
			await deleteStoredFileBestEffort(db, image.file.path);
			return empty(204);
		}

		throw new HttpError(405, "Method not allowed for this route");
	});
