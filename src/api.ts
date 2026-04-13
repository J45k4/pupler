import type { BunRequest } from "bun";
import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

type FieldKind =
	| "string"
	| "integer"
	| "decimal"
	| "boolean"
	| "date"
	| "timestamp";

type JsonValue =
	| null
	| boolean
	| number
	| string
	| JsonValue[]
	| { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

type FieldDefinition = {
	name: string;
	kind: FieldKind;
	required?: boolean;
	nullable?: boolean;
	serverGenerated?: boolean;
};

type ResourceDefinition = {
	path: string;
	table: string;
	fields: FieldDefinition[];
	defaultSort?: string;
};

const defineField = (
	name: string,
	kind: FieldKind,
	options: Omit<FieldDefinition, "name" | "kind"> = {},
): FieldDefinition => ({
	name,
	kind,
	required: options.required ?? false,
	nullable: options.nullable ?? true,
	serverGenerated: options.serverGenerated ?? false,
});

const RESOURCES: ResourceDefinition[] = [
	{
		path: "products",
		table: "products",
		defaultSort: "name ASC, id ASC",
		fields: [
			defineField("id", "integer", { serverGenerated: true }),
			defineField("name", "string", { required: true, nullable: false }),
			defineField("category", "string", {
				required: true,
				nullable: false,
			}),
			defineField("barcode", "string"),
			defineField("default_unit", "string"),
			defineField("is_perishable", "boolean", {
				required: true,
				nullable: false,
			}),
			defineField("created_at", "timestamp", { serverGenerated: true }),
			defineField("updated_at", "timestamp", { serverGenerated: true }),
		],
	},
	{
		path: "product-links",
		table: "product_links",
		fields: [
			defineField("id", "integer", { serverGenerated: true }),
			defineField("product_id", "integer", {
				required: true,
				nullable: false,
			}),
			defineField("label", "string", { required: true, nullable: false }),
			defineField("url", "string", { required: true, nullable: false }),
			defineField("created_at", "timestamp", { serverGenerated: true }),
		],
	},
	{
		path: "purchase-receipts",
		table: "purchase_receipts",
		fields: [
			defineField("id", "integer", { serverGenerated: true }),
			defineField("store_name", "string", {
				required: true,
				nullable: false,
			}),
			defineField("purchased_at", "timestamp", {
				required: true,
				nullable: false,
			}),
			defineField("currency", "string", {
				required: true,
				nullable: false,
			}),
			defineField("total_amount", "decimal"),
			defineField("created_at", "timestamp", { serverGenerated: true }),
			defineField("updated_at", "timestamp", { serverGenerated: true }),
		],
	},
	{
		path: "purchase-receipt-items",
		table: "purchase_receipt_items",
		fields: [
			defineField("id", "integer", { serverGenerated: true }),
			defineField("receipt_id", "integer", {
				required: true,
				nullable: false,
			}),
			defineField("product_id", "integer", {
				required: true,
				nullable: false,
			}),
			defineField("quantity", "decimal", {
				required: true,
				nullable: false,
			}),
			defineField("unit", "string", { required: true, nullable: false }),
			defineField("unit_price", "decimal"),
			defineField("line_total", "decimal"),
			defineField("created_at", "timestamp", { serverGenerated: true }),
		],
	},
	{
		path: "inventory-items",
		table: "inventory_items",
		fields: [
			defineField("id", "integer", { serverGenerated: true }),
			defineField("product_id", "integer", {
				required: true,
				nullable: false,
			}),
			defineField("receipt_item_id", "integer"),
			defineField("quantity", "decimal", {
				required: true,
				nullable: false,
			}),
			defineField("unit", "string", { required: true, nullable: false }),
			defineField("purchased_at", "timestamp"),
			defineField("expires_at", "timestamp"),
			defineField("consumed_at", "timestamp"),
			defineField("notes", "string"),
			defineField("created_at", "timestamp", { serverGenerated: true }),
			defineField("updated_at", "timestamp", { serverGenerated: true }),
		],
	},
	{
		path: "recipes",
		table: "recipes",
		fields: [
			defineField("id", "integer", { serverGenerated: true }),
			defineField("name", "string", { required: true, nullable: false }),
			defineField("description", "string"),
			defineField("instructions", "string"),
			defineField("servings", "integer"),
			defineField("is_active", "boolean", {
				required: true,
				nullable: false,
			}),
			defineField("created_at", "timestamp", { serverGenerated: true }),
			defineField("updated_at", "timestamp", { serverGenerated: true }),
		],
	},
	{
		path: "recipe-ingredients",
		table: "recipe_ingredients",
		fields: [
			defineField("id", "integer", { serverGenerated: true }),
			defineField("recipe_id", "integer", {
				required: true,
				nullable: false,
			}),
			defineField("product_id", "integer", {
				required: true,
				nullable: false,
			}),
			defineField("quantity", "decimal", {
				required: true,
				nullable: false,
			}),
			defineField("unit", "string", { required: true, nullable: false }),
			defineField("is_optional", "boolean", {
				required: true,
				nullable: false,
			}),
			defineField("notes", "string"),
			defineField("created_at", "timestamp", { serverGenerated: true }),
		],
	},
	{
		path: "meal-plan-items",
		table: "meal_plan_items",
		fields: [
			defineField("id", "integer", { serverGenerated: true }),
			defineField("recipe_id", "integer", {
				required: true,
				nullable: false,
			}),
			defineField("planned_date", "date", {
				required: true,
				nullable: false,
			}),
			defineField("meal_type", "string", {
				required: true,
				nullable: false,
			}),
			defineField("servings", "integer", {
				required: true,
				nullable: false,
			}),
			defineField("status", "string", {
				required: true,
				nullable: false,
			}),
			defineField("created_at", "timestamp", { serverGenerated: true }),
			defineField("updated_at", "timestamp", { serverGenerated: true }),
		],
	},
	{
		path: "shopping-list-items",
		table: "shopping_list_items",
		defaultSort: "created_at DESC, id DESC",
		fields: [
			defineField("id", "integer", { serverGenerated: true }),
			defineField("product_id", "integer", {
				required: true,
				nullable: false,
			}),
			defineField("quantity", "decimal", {
				required: true,
				nullable: false,
			}),
			defineField("unit", "string", { required: true, nullable: false }),
			defineField("done", "boolean", { required: true, nullable: false }),
			defineField("source_recipe_id", "integer"),
			defineField("notes", "string"),
			defineField("created_at", "timestamp", { serverGenerated: true }),
			defineField("updated_at", "timestamp", { serverGenerated: true }),
		],
	},
];

const RESOURCE_MAP = new Map(
	RESOURCES.map((resource) => [resource.path, resource]),
);

const MAX_PRODUCT_PICTURE_BYTES = 10 * 1024 * 1024;

class HttpError extends Error {
	status: number;

	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

const utcNow = () => new Date().toISOString();

const json = (status: number, payload: JsonValue | JsonObject | JsonObject[]) =>
	Response.json(payload, { status });

const empty = (status: number) => new Response(null, { status });

const normalizeTimestamp = (value: string) => value.replace(/Z$/, "+00:00");

const coerceValue = (
	field: FieldDefinition,
	value: JsonValue,
): string | number | null => {
	if (value === null) {
		if (!field.nullable) {
			throw new HttpError(400, `Field \`${field.name}\` may not be null`);
		}
		return null;
	}

	if (field.kind === "string") {
		if (typeof value !== "string") {
			throw new HttpError(
				400,
				`Field \`${field.name}\` must be a string`,
			);
		}
		return value;
	}

	if (field.kind === "boolean") {
		if (typeof value !== "boolean") {
			throw new HttpError(
				400,
				`Field \`${field.name}\` must be a boolean`,
			);
		}
		return value ? 1 : 0;
	}

	if (field.kind === "integer") {
		if (typeof value !== "number" || !Number.isInteger(value)) {
			throw new HttpError(
				400,
				`Field \`${field.name}\` must be an integer`,
			);
		}
		return value;
	}

	if (field.kind === "decimal") {
		if (typeof value !== "number" || !Number.isFinite(value)) {
			throw new HttpError(400, `Field \`${field.name}\` must be numeric`);
		}
		return value;
	}

	if (field.kind === "date") {
		if (
			typeof value !== "string" ||
			Number.isNaN(Date.parse(`${value}T00:00:00Z`))
		) {
			throw new HttpError(
				400,
				`Field \`${field.name}\` must be an ISO date string`,
			);
		}
		return value;
	}

	if (field.kind === "timestamp") {
		if (
			typeof value !== "string" ||
			Number.isNaN(Date.parse(normalizeTimestamp(value)))
		) {
			throw new HttpError(
				400,
				`Field \`${field.name}\` must be an ISO timestamp string`,
			);
		}
		return value;
	}

	throw new HttpError(400, `Unsupported field type for \`${field.name}\``);
};

const parseQueryValue = (
	field: FieldDefinition,
	rawValue: string,
): string | number | null => {
	if (rawValue === "null") {
		return null;
	}

	if (field.kind === "boolean") {
		const normalized = rawValue.trim().toLowerCase();
		if (["true", "1", "yes"].includes(normalized)) {
			return 1;
		}
		if (["false", "0", "no"].includes(normalized)) {
			return 0;
		}
		throw new HttpError(
			400,
			`Query parameter \`${field.name}\` must be boolean-like`,
		);
	}

	if (field.kind === "integer") {
		const parsed = Number.parseInt(rawValue, 10);
		if (!Number.isInteger(parsed)) {
			throw new HttpError(
				400,
				`Query parameter \`${field.name}\` must be an integer`,
			);
		}
		return parsed;
	}

	if (field.kind === "decimal") {
		const parsed = Number.parseFloat(rawValue);
		if (!Number.isFinite(parsed)) {
			throw new HttpError(
				400,
				`Query parameter \`${field.name}\` must be numeric`,
			);
		}
		return parsed;
	}

	if (field.kind === "date") {
		if (Number.isNaN(Date.parse(`${rawValue}T00:00:00Z`))) {
			throw new HttpError(
				400,
				`Query parameter \`${field.name}\` must be an ISO date string`,
			);
		}
		return rawValue;
	}

	if (field.kind === "timestamp") {
		if (Number.isNaN(Date.parse(normalizeTimestamp(rawValue)))) {
			throw new HttpError(
				400,
				`Query parameter \`${field.name}\` must be an ISO timestamp string`,
			);
		}
		return rawValue;
	}

	return rawValue;
};

const serializeRow = (
	resource: ResourceDefinition,
	row: Record<string, unknown>,
) => {
	const result: Record<string, unknown> = {};
	for (const field of resource.fields) {
		if (field.name in row) {
			result[field.name] = row[field.name];
		}
	}
	for (const field of resource.fields) {
		if (
			field.kind === "boolean" &&
			field.name in result &&
			result[field.name] !== null
		) {
			result[field.name] = Boolean(result[field.name]);
		}
	}
	return result;
};

const initMigrationTable = (db: Database) => {
	db.exec("PRAGMA foreign_keys = ON;");
	db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      executed_at TEXT NOT NULL
    )
  `);
};

const runMigrations = (db: Database, migrationsDir = "migrations") => {
	initMigrationTable(db);

	const executedRows = db
		.query("SELECT name FROM migrations ORDER BY name ASC")
		.as(Object)
		.all() as Array<{ name: string }>;
	const executed = new Set(executedRows.map((row) => row.name));

	const files = readdirSync(migrationsDir)
		.filter((name) => /^\d{10}_.+\.sql$/.test(name))
		.sort((left, right) => left.localeCompare(right));

	for (const file of files) {
		if (executed.has(file)) {
			continue;
		}

		const sql = readFileSync(join(migrationsDir, file), "utf8");
		db.transaction(() => {
			db.exec(sql);
			db.prepare(
				"INSERT INTO migrations (name, executed_at) VALUES (?1, ?2)",
			).run(file, utcNow());
		})();
	}
};

const getFieldMap = (resource: ResourceDefinition) =>
	new Map(resource.fields.map((field) => [field.name, field]));

const getWritableFields = (resource: ResourceDefinition) =>
	resource.fields.filter((field) => !field.serverGenerated);

const fetchRow = (db: Database, resource: ResourceDefinition, id: number) =>
	db
		.query(`SELECT * FROM ${resource.table} WHERE id = ?1`)
		.as(Object)
		.get(id) as Record<string, unknown> | null;

const prepareWriteValues = (
	resource: ResourceDefinition,
	payload: JsonValue,
	mode: "create" | "replace" | "patch",
	existingRow?: Record<string, unknown> | null,
) => {
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
		throw new HttpError(400, "JSON body must be an object");
	}

	const body = payload as JsonObject;
	const fieldMap = getFieldMap(resource);
	const writableFields = getWritableFields(resource);
	const values: Record<string, string | number | null> = {};

	for (const key of Object.keys(body)) {
		const field = fieldMap.get(key);
		if (!field) {
			throw new HttpError(400, `Unknown field \`${key}\``);
		}
		if (field.serverGenerated) {
			throw new HttpError(
				400,
				`Field \`${key}\` is server generated and cannot be written`,
			);
		}
	}

	for (const field of writableFields) {
		if (mode === "patch") {
			if (!(field.name in body)) {
				continue;
			}
			values[field.name] = coerceValue(field, body[field.name] ?? null);
			continue;
		}

		if (field.name in body) {
			values[field.name] = coerceValue(field, body[field.name] ?? null);
			continue;
		}

		if (field.required) {
			throw new HttpError(
				400,
				`Missing required field \`${field.name}\``,
			);
		}
		values[field.name] = null;
	}

	const now = utcNow();
	const hasCreatedAt = fieldMap.has("created_at");
	const hasUpdatedAt = fieldMap.has("updated_at");

	if (mode === "create") {
		if (hasCreatedAt) values.created_at = now;
		if (hasUpdatedAt) values.updated_at = now;
	}

	if (mode === "replace") {
		if (!existingRow) {
			throw new HttpError(500, "Replace requires an existing row");
		}
		if (hasCreatedAt) values.created_at = String(existingRow.created_at);
		if (hasUpdatedAt) values.updated_at = now;
	}

	if (mode === "patch") {
		if (Object.keys(values).length === 0) {
			throw new HttpError(
				400,
				"PATCH request must contain at least one writable field",
			);
		}
		if (hasUpdatedAt) values.updated_at = now;
	}

	return values;
};

const buildCollectionHandler = (db: Database, resource: ResourceDefinition) => {
	return async (req: Request) => {
		if (req.method === "GET") {
			const url = new URL(req.url);
			const fieldMap = getFieldMap(resource);
			const filters: string[] = [];
			const params: Array<string | number> = [];
			let orderBy = resource.defaultSort ?? "id ASC";

			for (const [key, value] of url.searchParams.entries()) {
				if (key === "sort" || key === "order") {
					continue;
				}
				const field = fieldMap.get(key);
				if (!field) {
					throw new HttpError(
						400,
						`Unknown query parameter \`${key}\``,
					);
				}
				const parsed = parseQueryValue(field, value);
				if (parsed === null) {
					filters.push(`${field.name} IS NULL`);
				} else {
					filters.push(`${field.name} = ?`);
					params.push(parsed);
				}
			}

			const sort = url.searchParams.get("sort");
			const order = (
				url.searchParams.get("order") ?? "asc"
			).toUpperCase();
			if (!["ASC", "DESC"].includes(order)) {
				throw new HttpError(
					400,
					"Query parameter `order` must be `asc` or `desc`",
				);
			}
			if (sort) {
				const sortField = fieldMap.get(sort);
				if (!sortField) {
					throw new HttpError(400, `Unknown sort field \`${sort}\``);
				}
				orderBy = `${sortField.name} ${order}`;
			}

			const whereClause =
				filters.length > 0 ? ` WHERE ${filters.join(" AND ")}` : "";
			const query = db
				.query(
					`SELECT * FROM ${resource.table}${whereClause} ORDER BY ${orderBy}`,
				)
				.as(Object);
			const rows = query.all(...params) as Record<string, unknown>[];
			return json(
				200,
				rows.map((row) => serializeRow(resource, row)),
			);
		}

		if (req.method === "POST") {
			const payload = (await req.json()) as JsonValue;
			const values = prepareWriteValues(resource, payload, "create");
			const columns = Object.keys(values);
			const placeholders = columns.map(() => "?").join(", ");
			const sql = `INSERT INTO ${resource.table} (${columns.join(", ")}) VALUES (${placeholders})`;
			const result = db
				.prepare(sql)
				.run(...columns.map((column) => values[column]));
			const row = fetchRow(db, resource, Number(result.lastInsertRowid));
			return json(201, serializeRow(resource, row ?? {}));
		}

		throw new HttpError(405, "Method not allowed for this route");
	};
};

const buildDetailHandler = (db: Database, resource: ResourceDefinition) => {
	return async (req: BunRequest<string>) => {
		const id = Number.parseInt(req.params.id, 10);
		if (!Number.isInteger(id)) {
			throw new HttpError(400, "Resource id must be an integer");
		}

		const existingRow = fetchRow(db, resource, id);
		if (!existingRow) {
			throw new HttpError(404, "Resource not found");
		}

		if (req.method === "GET") {
			return json(200, serializeRow(resource, existingRow));
		}

		if (req.method === "PUT") {
			const payload = (await req.json()) as JsonValue;
			const values = prepareWriteValues(
				resource,
				payload,
				"replace",
				existingRow,
			);
			const columns = Object.keys(values);
			const assignments = columns
				.map((column) => `${column} = ?`)
				.join(", ");
			db.prepare(
				`UPDATE ${resource.table} SET ${assignments} WHERE id = ?`,
			).run(...columns.map((column) => values[column]), id);
			return json(
				200,
				serializeRow(resource, fetchRow(db, resource, id) ?? {}),
			);
		}

		if (req.method === "PATCH") {
			const payload = (await req.json()) as JsonValue;
			const values = prepareWriteValues(
				resource,
				payload,
				"patch",
				existingRow,
			);
			const columns = Object.keys(values);
			const assignments = columns
				.map((column) => `${column} = ?`)
				.join(", ");
			db.prepare(
				`UPDATE ${resource.table} SET ${assignments} WHERE id = ?`,
			).run(...columns.map((column) => values[column]), id);
			return json(
				200,
				serializeRow(resource, fetchRow(db, resource, id) ?? {}),
			);
		}

		if (req.method === "DELETE") {
			db.prepare(`DELETE FROM ${resource.table} WHERE id = ?1`).run(id);
			return empty(204);
		}

		throw new HttpError(405, "Method not allowed for this route");
	};
};

export const handleError = (error: unknown) => {
	if (error instanceof HttpError) {
		return json(error.status, { error: error.message });
	}

	if (error instanceof Error) {
		if (error.message.includes("UNIQUE constraint failed")) {
			return json(409, { error: error.message });
		}
		if (error.message.includes("FOREIGN KEY constraint failed")) {
			return json(409, {
				error: "Resource is still referenced by another record",
			});
		}
		if (error.message.includes("NOT NULL constraint failed")) {
			return json(400, { error: error.message });
		}
		return json(500, { error: error.message });
	}

	return json(500, { error: "Unknown server error" });
};

export const openDatabase = (
	dbPath = "pupler.db",
	migrationsDir = "migrations",
) => {
	const db = new Database(dbPath, { create: true, strict: true });
	runMigrations(db, migrationsDir);
	return db;
};

export const closeDatabase = (db: Database) => {
	db.close();
};

const getResourceOrThrow = (path: string) => {
	const resource = RESOURCE_MAP.get(path);
	if (!resource) {
		throw new Error(`Unknown resource path: ${path}`);
	}
	return resource;
};

export const createCollectionRoute = (db: Database, path: string) => {
	const resource = getResourceOrThrow(path);
	const handler = buildCollectionHandler(db, resource);
	return (req: Request) => handler(req).catch(handleError);
};

export const createDetailRoute = (db: Database, path: string) => {
	const resource = getResourceOrThrow(path);
	const handler = buildDetailHandler(db, resource);
	return (req: Request) =>
		handler(req as BunRequest<string>).catch(handleError);
};

const parseIdParam = (value: string) => {
	const id = Number.parseInt(value, 10);
	if (!Number.isInteger(id)) {
		throw new HttpError(400, "Resource id must be an integer");
	}
	return id;
};

const fetchProductPicture = (db: Database, productId: number) =>
	db
		.query(
			`
			SELECT id, picture_blob, picture_content_type, picture_filename, picture_uploaded_at
			FROM products
			WHERE id = ?1
		`,
		)
		.as(Object)
		.get(productId) as {
		id: number;
		picture_blob: Uint8Array | null;
		picture_content_type: string | null;
		picture_filename: string | null;
		picture_uploaded_at: string | null;
	} | null;

export const createProductPictureRoute = (db: Database) => {
	return async (req: Request) => {
		try {
			const request = req as BunRequest<string>;
			const productId = parseIdParam(request.params.id);
			const product = fetchRow(
				db,
				getResourceOrThrow("products"),
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
		} catch (error) {
			return handleError(error);
		}
	};
};

export const handleFallback = (req: Request) => {
	const url = new URL(req.url);
	if (url.pathname === "/health") {
		return new Response("ok");
	}
	return json(404, { error: "Route not found" });
};

export const getResourceDefinition = (path: string) =>
	RESOURCE_MAP.get(path) ?? null;
