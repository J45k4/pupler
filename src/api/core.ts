import type { BunRequest } from "bun";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PrismaLibSql } from "@prisma/adapter-libsql";

import {
	Prisma,
	PrismaClient,
} from "../generated/prisma/client";

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
type QueryClient = PrismaClient | Prisma.TransactionClient;
export type SortDirection = "asc" | "desc";

export type Database = {
	client: QueryClient;
	dbPath: string;
	tempDir?: string;
};

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
	return value;
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
		return true;
	}
	if (["false", "0", "no"].includes(normalized)) {
		return false;
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
	const order = (url.searchParams.get("order") ?? "asc").toLowerCase();
	if (!["asc", "desc"].includes(order)) {
		throw new HttpError(
			400,
			"Query parameter `order` must be `asc` or `desc`",
		);
	}
	return order as SortDirection;
};

export const parseIdParam = (value: string) => {
	const id = Number.parseInt(value, 10);
	if (!Number.isInteger(id)) {
		throw new HttpError(400, "Resource id must be an integer");
	}
	return id;
};

const toDatabaseUrl = (dbPath: string) =>
	dbPath.startsWith("file:") ? dbPath : `file:${dbPath}`;

const prepareDatabasePath = (dbPath: string) => {
	if (dbPath !== ":memory:") {
		return { dbPath, tempDir: undefined };
	}

	const tempDir = mkdtempSync(join(tmpdir(), "pupler-db-"));
	return {
		dbPath: join(tempDir, "pupler.sqlite"),
		tempDir,
	};
};

export const openDatabase = (dbPath = "pupler.db") => {
	const prepared = prepareDatabasePath(dbPath);
	const databaseUrl = toDatabaseUrl(prepared.dbPath);

	const adapter = new PrismaLibSql({ url: databaseUrl });
	const client = new PrismaClient({ adapter });

	return {
		client,
		dbPath: prepared.dbPath,
		tempDir: prepared.tempDir,
	} satisfies Database;
};

export const closeDatabase = async (db: Database) => {
	await db.client.$disconnect?.();
	if (db.tempDir) {
		rmSync(db.tempDir, { force: true, recursive: true });
	}
};

export const handleError = (error: unknown) => {
	if (error instanceof HttpError) {
		return json(error.status, { error: error.message });
	}

	if (error instanceof Prisma.PrismaClientKnownRequestError) {
		if (error.code === "P2002") {
			return json(409, { error: error.message });
		}
		if (error.code === "P2003") {
			return json(409, {
				error: "Resource is still referenced by another record",
			});
		}
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
