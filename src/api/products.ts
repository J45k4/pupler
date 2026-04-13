import type { BunRequest } from "bun";
import { Database } from "bun:sqlite";

import {
	assertKnownFields,
	empty,
	expectBoolean,
	expectNullableString,
	expectString,
	handleError,
	HttpError,
	insertRow,
	json,
	parseBooleanQuery,
	parseIdParam,
	parseIntegerQuery,
	parseSortOrder,
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

const TABLE = "products";
const DEFAULT_SORT = "name ASC, id ASC";
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

const serializeProduct = (row: Record<string, unknown> | null) =>
	serializeBooleanFields(row, ["is_perishable"]);

const fetchProduct = (db: Database, id: number) =>
	serializeProduct(queryRow(db, `SELECT * FROM ${TABLE} WHERE id = ?1`, id));

const parseProductSort = (url: URL) => {
	const sort = url.searchParams.get("sort");
	if (!sort) {
		return DEFAULT_SORT;
	}
	if (!SORT_FIELDS.has(sort)) {
		throw new HttpError(400, `Unknown sort field \`${sort}\``);
	}
	return `${sort} ${parseSortOrder(url)}`;
};

const parseProductFilters = (url: URL) => {
	const filters: string[] = [];
	const params: Array<string | number> = [];

	for (const [key, value] of url.searchParams.entries()) {
		if (key === "sort" || key === "order") {
			continue;
		}

		switch (key) {
			case "id":
				filters.push("id = ?");
				params.push(parseIntegerQuery(key, value));
				break;
			case "name":
			case "category":
			case "barcode":
			case "default_unit":
			case "created_at":
			case "updated_at":
				if (value === "null") {
					filters.push(`${key} IS NULL`);
				} else {
					filters.push(`${key} = ?`);
					params.push(value);
				}
				break;
			case "is_perishable":
				filters.push("is_perishable = ?");
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
		name: requireBodyField(body, "name", expectString),
		category: requireBodyField(body, "category", expectString),
		barcode:
			readOptionalBodyField(body, "barcode", expectNullableString) ??
			null,
		default_unit:
			readOptionalBodyField(body, "default_unit", expectNullableString) ??
			null,
		is_perishable: requireBodyField(body, "is_perishable", expectBoolean),
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
		name: requireBodyField(body, "name", expectString),
		category: requireBodyField(body, "category", expectString),
		barcode:
			readOptionalBodyField(body, "barcode", expectNullableString) ??
			null,
		default_unit:
			readOptionalBodyField(body, "default_unit", expectNullableString) ??
			null,
		is_perishable: requireBodyField(body, "is_perishable", expectBoolean),
		created_at: String(existingRow.created_at),
		updated_at: utcNow(),
	};
};

const parsePatchValues = (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS);

	const values: RowValues = {};
	const name = readOptionalBodyField(body, "name", expectString);
	const category = readOptionalBodyField(body, "category", expectString);
	const barcode = readOptionalBodyField(
		body,
		"barcode",
		expectNullableString,
	);
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
		throw new HttpError(
			400,
			"PATCH request must contain at least one writable field",
		);
	}

	values.updated_at = utcNow();
	return values;
};

export const productsCollectionRoute = (db: Database) =>
	withErrorHandling(async (req: Request) => {
		if (req.method === "GET") {
			const url = new URL(req.url);
			const { filters, params } = parseProductFilters(url);
			const whereClause =
				filters.length > 0 ? ` WHERE ${filters.join(" AND ")}` : "";
			const rows = queryRows(
				db,
				`SELECT * FROM ${TABLE}${whereClause} ORDER BY ${parseProductSort(url)}`,
				...params,
			);
			return json(
				200,
				rows.map((row) => serializeProduct(row) ?? {}),
			);
		}

		if (req.method === "POST") {
			const body = await readJsonObject(req);
			const id = insertRow(db, TABLE, parseCreateValues(body));
			return json(201, serializeProduct(fetchProduct(db, id)) ?? {});
		}

		throw new HttpError(405, "Method not allowed for this route");
	});

export const productDetailRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		const id = parseIdParam(req.params.id);
		const existingRow = queryRow(
			db,
			`SELECT * FROM ${TABLE} WHERE id = ?1`,
			id,
		);
		if (!existingRow) {
			throw new HttpError(404, "Resource not found");
		}

		if (req.method === "GET") {
			return json(200, serializeProduct(existingRow) ?? {});
		}

		if (req.method === "PUT") {
			const body = await readJsonObject(req);
			updateRowById(db, TABLE, id, parseReplaceValues(body, existingRow));
			return json(200, fetchProduct(db, id) ?? {});
		}

		if (req.method === "PATCH") {
			const body = await readJsonObject(req);
			updateRowById(db, TABLE, id, parsePatchValues(body));
			return json(200, fetchProduct(db, id) ?? {});
		}

		if (req.method === "DELETE") {
			db.prepare(`DELETE FROM ${TABLE} WHERE id = ?1`).run(id);
			return empty(204);
		}

		throw new HttpError(405, "Method not allowed for this route");
	});

const fetchProductPicture = (db: Database, productId: number) =>
	queryRow(
		db,
		`
			SELECT id, picture_blob, picture_content_type, picture_filename, picture_uploaded_at
			FROM products
			WHERE id = ?1
		`,
		productId,
	) as {
		id: number;
		picture_blob: Uint8Array | null;
		picture_content_type: string | null;
		picture_filename: string | null;
		picture_uploaded_at: string | null;
	} | null;

export const productPictureRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		const productId = parseIdParam(req.params.id);
		const product = queryRow(
			db,
			`SELECT * FROM ${TABLE} WHERE id = ?1`,
			productId,
		);
		if (!product) {
			throw new HttpError(404, "Resource not found");
		}

		if (req.method === "GET") {
			const row = fetchProductPicture(db, productId);
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
			db.prepare(
				`
					UPDATE products
					SET picture_blob = NULL,
						picture_content_type = NULL,
						picture_filename = NULL,
						picture_uploaded_at = NULL
					WHERE id = ?1
				`,
			).run(productId);
			return empty(204);
		}

		if (req.method === "POST") {
			const formData = await req.formData();
			const uploaded = formData.get("file");
			if (!(uploaded instanceof File)) {
				throw new HttpError(
					400,
					"Multipart form-data must include a `file` field",
				);
			}
			if (!uploaded.type.startsWith("image/")) {
				throw new HttpError(400, "Uploaded file must be an image");
			}
			if (uploaded.size === 0) {
				throw new HttpError(400, "Uploaded file may not be empty");
			}
			if (uploaded.size > MAX_PRODUCT_PICTURE_BYTES) {
				throw new HttpError(
					413,
					"Uploaded file exceeds the 10 MB limit",
				);
			}

			const buffer = new Uint8Array(await uploaded.arrayBuffer());
			db.prepare(
				`
					UPDATE products
					SET picture_blob = ?1,
						picture_content_type = ?2,
						picture_filename = ?3,
						picture_uploaded_at = ?4
					WHERE id = ?5
				`,
			).run(
				buffer,
				uploaded.type,
				uploaded.name || null,
				utcNow(),
				productId,
			);

			return json(200, {
				product_id: productId,
				content_type: uploaded.type,
				filename: uploaded.name || null,
				size: uploaded.size,
			});
		}

		throw new HttpError(405, "Method not allowed for this route");
	});
