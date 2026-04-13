import type { BunRequest } from "bun";
import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type FieldKind =
	| "string"
	| "integer"
	| "decimal"
	| "boolean"
	| "date"
	| "timestamp";

export type JsonValue =
	| null
	| boolean
	| number
	| string
	| JsonValue[]
	| { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };
export type Row = Record<string, unknown>;
export type RowValue = string | number | Uint8Array | null;
export type RowValues = Record<string, RowValue>;

export class HttpError extends Error {
	status: number;

	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

export const utcNow = () => new Date().toISOString();

export const json = (
	status: number,
	payload: JsonValue | JsonObject | JsonObject[],
) => Response.json(payload, { status });

export const empty = (status: number) => new Response(null, { status });

const normalizeTimestamp = (value: string) => value.replace(/Z$/, "+00:00");

export const hasOwn = (body: JsonObject, key: string) =>
	Object.prototype.hasOwnProperty.call(body, key);

export const readJsonObject = async (req: Request) => {
	const payload = (await req.json()) as JsonValue;
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
		throw new HttpError(400, "JSON body must be an object");
	}
	return payload as JsonObject;
};

export const assertKnownFields = (
	body: JsonObject,
	allowedFields: string[],
) => {
	for (const key of Object.keys(body)) {
		if (!allowedFields.includes(key)) {
			throw new HttpError(400, `Unknown field \`${key}\``);
		}
	}
};

export const requireBodyField = <T>(
	body: JsonObject,
	key: string,
	parser: (value: JsonValue, field: string) => T,
) => {
	if (!hasOwn(body, key)) {
		throw new HttpError(400, `Missing required field \`${key}\``);
	}
	return parser(body[key] ?? null, key);
};

export const readOptionalBodyField = <T>(
	body: JsonObject,
	key: string,
	parser: (value: JsonValue, field: string) => T,
) => {
	if (!hasOwn(body, key)) {
		return undefined;
	}
	return parser(body[key] ?? null, key);
};

export const expectString = (value: JsonValue, field: string) => {
	if (typeof value !== "string") {
		throw new HttpError(400, `Field \`${field}\` must be a string`);
	}
	return value;
};

export const expectNullableString = (value: JsonValue, field: string) => {
	if (value === null) {
		return null;
	}
	return expectString(value, field);
};

export const expectBoolean = (value: JsonValue, field: string) => {
	if (typeof value !== "boolean") {
		throw new HttpError(400, `Field \`${field}\` must be a boolean`);
	}
	return value ? 1 : 0;
};

export const expectNullableBoolean = (value: JsonValue, field: string) => {
	if (value === null) {
		return null;
	}
	return expectBoolean(value, field);
};

export const expectInteger = (value: JsonValue, field: string) => {
	if (typeof value !== "number" || !Number.isInteger(value)) {
		throw new HttpError(400, `Field \`${field}\` must be an integer`);
	}
	return value;
};

export const expectNullableInteger = (value: JsonValue, field: string) => {
	if (value === null) {
		return null;
	}
	return expectInteger(value, field);
};

export const expectDecimal = (value: JsonValue, field: string) => {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		throw new HttpError(400, `Field \`${field}\` must be numeric`);
	}
	return value;
};

export const expectNullableDecimal = (value: JsonValue, field: string) => {
	if (value === null) {
		return null;
	}
	return expectDecimal(value, field);
};

export const expectDate = (value: JsonValue, field: string) => {
	if (
		typeof value !== "string" ||
		Number.isNaN(Date.parse(`${value}T00:00:00Z`))
	) {
		throw new HttpError(
			400,
			`Field \`${field}\` must be an ISO date string`,
		);
	}
	return value;
};

export const expectNullableDate = (value: JsonValue, field: string) => {
	if (value === null) {
		return null;
	}
	return expectDate(value, field);
};

export const expectTimestamp = (value: JsonValue, field: string) => {
	if (
		typeof value !== "string" ||
		Number.isNaN(Date.parse(normalizeTimestamp(value)))
	) {
		throw new HttpError(
			400,
			`Field \`${field}\` must be an ISO timestamp string`,
		);
	}
	return value;
};

export const expectNullableTimestamp = (value: JsonValue, field: string) => {
	if (value === null) {
		return null;
	}
	return expectTimestamp(value, field);
};

export const parseBooleanQuery = (field: string, rawValue: string) => {
	const normalized = rawValue.trim().toLowerCase();
	if (["true", "1", "yes"].includes(normalized)) {
		return 1;
	}
	if (["false", "0", "no"].includes(normalized)) {
		return 0;
	}
	throw new HttpError(
		400,
		`Query parameter \`${field}\` must be boolean-like`,
	);
};

export const parseIntegerQuery = (field: string, rawValue: string) => {
	const parsed = Number.parseInt(rawValue, 10);
	if (!Number.isInteger(parsed)) {
		throw new HttpError(
			400,
			`Query parameter \`${field}\` must be an integer`,
		);
	}
	return parsed;
};

export const parseDecimalQuery = (field: string, rawValue: string) => {
	const parsed = Number.parseFloat(rawValue);
	if (!Number.isFinite(parsed)) {
		throw new HttpError(
			400,
			`Query parameter \`${field}\` must be numeric`,
		);
	}
	return parsed;
};

export const parseDateQuery = (field: string, rawValue: string) => {
	if (Number.isNaN(Date.parse(`${rawValue}T00:00:00Z`))) {
		throw new HttpError(
			400,
			`Query parameter \`${field}\` must be an ISO date string`,
		);
	}
	return rawValue;
};

export const parseTimestampQuery = (field: string, rawValue: string) => {
	if (Number.isNaN(Date.parse(normalizeTimestamp(rawValue)))) {
		throw new HttpError(
			400,
			`Query parameter \`${field}\` must be an ISO timestamp string`,
		);
	}
	return rawValue;
};

export const parseSortOrder = (url: URL) => {
	const order = (url.searchParams.get("order") ?? "asc").toUpperCase();
	if (!["ASC", "DESC"].includes(order)) {
		throw new HttpError(
			400,
			"Query parameter `order` must be `asc` or `desc`",
		);
	}
	return order;
};

export const parseIdParam = (value: string) => {
	const id = Number.parseInt(value, 10);
	if (!Number.isInteger(id)) {
		throw new HttpError(400, "Resource id must be an integer");
	}
	return id;
};

export const serializeBooleanFields = (row: Row | null, fields: string[]) => {
	if (!row) {
		return null;
	}

	const result: Row = { ...row };
	for (const field of fields) {
		if (field in result && result[field] !== null) {
			result[field] = Boolean(result[field]);
		}
	}

	return result;
};

export const queryRow = (db: Database, sql: string, ...params: RowValue[]) =>
	db
		.query(sql)
		.as(Object)
		.get(...params) as Row | null;

export const queryRows = (db: Database, sql: string, ...params: RowValue[]) =>
	db
		.query(sql)
		.as(Object)
		.all(...params) as Row[];

export const insertRow = (db: Database, table: string, values: RowValues) => {
	const columns = Object.keys(values);
	const placeholders = columns.map(() => "?").join(", ");
	const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;
	const result = db
		.prepare(sql)
		.run(...columns.map((column) => values[column] ?? null));
	return Number(result.lastInsertRowid);
};

export const updateRowById = (
	db: Database,
	table: string,
	id: number,
	values: RowValues,
) => {
	const columns = Object.keys(values);
	const assignments = columns.map((column) => `${column} = ?`).join(", ");
	db.prepare(`UPDATE ${table} SET ${assignments} WHERE id = ?`).run(
		...columns.map((column) => values[column] ?? null),
		id,
	);
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

export const withErrorHandling = <T extends Request>(
	handler: (req: T) => Response | Promise<Response>,
) => {
	return (req: Request) =>
		Promise.resolve(handler(req as T)).catch(handleError);
};

export const handleFallback = (req: Request) => {
	const url = new URL(req.url);
	if (url.pathname === "/health") {
		return new Response("ok");
	}
	return json(404, { error: "Route not found" });
};

export type RouteHandler<T extends Request = Request> = (
	req: T,
) => Response | Promise<Response>;
export type BunRouteHandler<T extends string = string> = (
	req: BunRequest<T>,
) => Response | Promise<Response>;
