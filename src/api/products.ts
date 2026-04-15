import type { BunRequest } from "bun";

import {
	assertKnownFields,
	empty,
	expectBoolean,
	expectNullableString,
	expectString,
	HttpError,
	json,
	parseBooleanQuery,
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

const DEFAULT_SORT = [{ name: "asc" }, { id: "asc" }] as const;
const SORT_FIELDS = new Set([
	"id",
	"name",
	"category",
	"barcode",
	"default_unit",
	"is_perishable",
	"created_at",
	"updated_at",
]);
const WRITABLE_FIELDS = [
	"name",
	"category",
	"barcode",
	"default_unit",
	"is_perishable",
];
const MAX_PRODUCT_PICTURE_BYTES = 10 * 1024 * 1024;

const fetchProduct = (db: Database, id: number) =>
	db.client.product.findUnique({ where: { id } });

const parseProductSort = (url: URL) => {
	const sort = url.searchParams.get("sort");
	if (!sort) {
		return DEFAULT_SORT;
	}
	if (!SORT_FIELDS.has(sort)) {
		throw new HttpError(400, `Unknown sort field \`${sort}\``);
	}
	return [{ [sort]: parseSortOrder(url) }];
};

const parseProductFilters = (url: URL) => {
	const where: Record<string, unknown> = {};
	let nameExact: string | null | undefined;
	let nameContains: string | null | undefined;

	for (const [key, value] of url.searchParams.entries()) {
		if (key === "sort" || key === "order") {
			continue;
		}

		switch (key) {
			case "id":
				where.id = parseIntegerQuery(key, value);
				break;
			case "name":
				nameExact = value === "null" ? null : value;
				break;
			case "name_contains":
				nameContains = value === "null" ? null : value;
				break;
			case "category":
			case "barcode":
			case "default_unit":
			case "created_at":
			case "updated_at":
				where[key] = value === "null" ? null : value;
				break;
			case "is_perishable":
				where.is_perishable = parseBooleanQuery(key, value);
				break;
			default:
				throw new HttpError(400, `Unknown query parameter \`${key}\``);
		}
	}

	return { where, nameExact, nameContains };
};

const filterProductsByName = (
	rows: Array<{ name: string | null }>,
	nameExact: string | null | undefined,
	nameContains: string | null | undefined,
) =>
	rows.filter((row) => {
		if (nameExact !== undefined) {
			if (nameExact === null) {
				return row.name === null;
			}
			if (row.name?.toLowerCase() !== nameExact.toLowerCase()) {
				return false;
			}
		}

		if (nameContains !== undefined) {
			if (nameContains === null) {
				return row.name === null;
			}
			if (!row.name?.toLowerCase().includes(nameContains.toLowerCase())) {
				return false;
			}
		}

		return true;
	});

const parseCreateValues = (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	const now = utcNow();

	return {
		name: requireBodyField(body, "name", expectString),
		category: requireBodyField(body, "category", expectString),
		barcode:
			readOptionalBodyField(body, "barcode", expectNullableString) ?? null,
		default_unit:
			readOptionalBodyField(body, "default_unit", expectNullableString) ?? null,
		is_perishable: requireBodyField(body, "is_perishable", expectBoolean),
		created_at: now,
		updated_at: now,
	};
};

const parseReplaceValues = (
	body: JsonObject,
	existingRow: Awaited<ReturnType<typeof fetchProduct>>,
) => {
	assertKnownFields(body, WRITABLE_FIELDS);

	return {
		name: requireBodyField(body, "name", expectString),
		category: requireBodyField(body, "category", expectString),
		barcode:
			readOptionalBodyField(body, "barcode", expectNullableString) ?? null,
		default_unit:
			readOptionalBodyField(body, "default_unit", expectNullableString) ?? null,
		is_perishable: requireBodyField(body, "is_perishable", expectBoolean),
		created_at: existingRow?.created_at ?? utcNow(),
		updated_at: utcNow(),
	};
};

const parsePatchValues = (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS);

	const values: Record<string, unknown> = {};
	const name = readOptionalBodyField(body, "name", expectString);
	const category = readOptionalBodyField(body, "category", expectString);
	const barcode = readOptionalBodyField(body, "barcode", expectNullableString);
	const defaultUnit = readOptionalBodyField(
		body,
		"default_unit",
		expectNullableString,
	);
	const isPerishable = readOptionalBodyField(
		body,
		"is_perishable",
		expectBoolean,
	);

	if (name !== undefined) values.name = name;
	if (category !== undefined) values.category = category;
	if (barcode !== undefined) values.barcode = barcode;
	if (defaultUnit !== undefined) values.default_unit = defaultUnit;
	if (isPerishable !== undefined) values.is_perishable = isPerishable;

	if (Object.keys(values).length === 0) {
		throw new HttpError(400, "PATCH request must contain at least one writable field");
	}

	values.updated_at = utcNow();
	return values;
};

export const productsCollectionRoute = (db: Database) =>
	withErrorHandling(async (req: Request) => {
		if (req.method === "GET") {
			const url = new URL(req.url);
			const { where, nameExact, nameContains } = parseProductFilters(url);
			const rows = await db.client.product.findMany({
				where,
				orderBy: parseProductSort(url),
			});
			return json(200, filterProductsByName(rows, nameExact, nameContains));
		}

		if (req.method === "POST") {
			return json(
				201,
				await db.client.product.create({
					data: parseCreateValues(await readJsonObject(req)),
				}),
			);
		}

		throw new HttpError(405, "Method not allowed for this route");
	});

export const productDetailRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		const id = parseIdParam(req.params.id);
		const existingRow = await fetchProduct(db, id);
		if (!existingRow) {
			throw new HttpError(404, "Resource not found");
		}

		if (req.method === "GET") {
			return json(200, existingRow);
		}

		if (req.method === "PUT") {
			return json(
				200,
				await db.client.product.update({
					where: { id },
					data: parseReplaceValues(await readJsonObject(req), existingRow),
				}),
			);
		}

		if (req.method === "PATCH") {
			return json(
				200,
				await db.client.product.update({
					where: { id },
					data: parsePatchValues(await readJsonObject(req)),
				}),
			);
		}

		if (req.method === "DELETE") {
			await db.client.product.delete({ where: { id } });
			return empty(204);
		}

		throw new HttpError(405, "Method not allowed for this route");
	});

const fetchProductPicture = (db: Database, productId: number) =>
	db.client.product.findUnique({
		where: { id: productId },
		select: {
			id: true,
			picture_blob: true,
			picture_content_type: true,
			picture_filename: true,
			picture_uploaded_at: true,
		},
	});

export const productPictureRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		const productId = parseIdParam(req.params.id);
		const product = await fetchProduct(db, productId);
		if (!product) {
			throw new HttpError(404, "Resource not found");
		}

		if (req.method === "GET") {
			const row = await fetchProductPicture(db, productId);
			if (!row?.picture_blob || !row.picture_content_type) {
				throw new HttpError(404, "Product picture not found");
			}
			return new Response(row.picture_blob, {
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
			});
		}

		if (req.method === "DELETE") {
			await db.client.product.update({
				where: { id: productId },
				data: {
					picture_blob: null,
					picture_content_type: null,
					picture_filename: null,
					picture_uploaded_at: null,
				},
			});
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
			if (uploaded.size > MAX_PRODUCT_PICTURE_BYTES) {
				throw new HttpError(413, "Uploaded file exceeds the 10 MB limit");
			}

			const buffer = new Uint8Array(await uploaded.arrayBuffer());
			await db.client.product.update({
				where: { id: productId },
				data: {
					picture_blob: buffer,
					picture_content_type: uploaded.type,
					picture_filename: uploaded.name || null,
					picture_uploaded_at: utcNow(),
				},
			});

			return json(200, {
				product_id: productId,
				content_type: uploaded.type,
				filename: uploaded.name || null,
				size: uploaded.size,
			});
		}

		throw new HttpError(405, "Method not allowed for this route");
	});
