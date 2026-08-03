import type { BunRequest } from "bun";

import { db } from "../db";
import {
	assertKnownFields,
	empty,
	expectBoolean,
	expectNullableString,
	expectString,
	HttpError,
	json,
	parseIdParam,
	parseIntegerQuery,
	parseSortOrder,
	readJsonObject,
	readOptionalBodyField,
	requireBodyField,
	utcNow,
	type Database,
	type JsonObject,
} from "./core";

const DEFAULT_SORT = [
	{ name: "asc" as const },
	{ id: "asc" as const },
];
const SORT_FIELDS = new Set([
	"id",
	"name",
	"username",
	"email",
	"is_admin",
	"created_at",
	"updated_at",
]);
const WRITABLE_FIELDS = ["name", "username", "email", "password_hash", "password", "is_admin"];

const USER_SELECT = {
	id: true,
	name: true,
	username: true,
	email: true,
	is_admin: true,
	created_at: true,
	updated_at: true,
} as const;

const fetchUser = (db: Database, id: number) =>
	db.client.user.findUnique({ where: { id }, select: USER_SELECT });

const parseUserName = (body: JsonObject, field = "name") => {
	const name = requireBodyField(body, field, expectString).trim();
	if (!name) {
		throw new HttpError(400, `Field \`${field}\` cannot be empty`);
	}
	return name;
};

const parseOptionalUserName = (body: JsonObject, field = "name") => {
	const rawName = readOptionalBodyField(body, field, expectString);
	if (rawName === undefined) return undefined;
	const name = rawName.trim();
	if (!name) {
		throw new HttpError(400, `Field \`${field}\` cannot be empty`);
	}
	return name;
};

const normalizeNullableString = (value: string | null) => {
	if (value === null) return null;
	const normalized = value.trim();
	return normalized ? normalized : null;
};

const parseSort = (url: URL) => {
	const sort = url.searchParams.get("sort");
	if (!sort) return DEFAULT_SORT;
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
			case "name":
				where.name = { contains: value };
				break;
			case "username":
				where.username = value === "null" ? null : { contains: value };
				break;
			case "email":
				where.email = value === "null" ? null : { contains: value };
				break;
			case "is_admin":
				where.is_admin = value === "true";
				break;
			case "created_at":
			case "updated_at":
				where[key] = value;
				break;
			default:
				throw new HttpError(400, `Unknown query parameter \`${key}\``);
		}
	}
	return where;
};

const passwordHashFromBody = async (body: JsonObject) => {
	const passwordHash = readOptionalBodyField(body, "password_hash", expectNullableString);
	const password = readOptionalBodyField(body, "password", expectNullableString);
	if (passwordHash !== undefined && password !== undefined) {
		throw new HttpError(400, "Provide either `password` or `password_hash`, not both");
	}
	if (password === undefined) return normalizeNullableString(passwordHash ?? null);
	if (password === null || !password.trim()) return null;
	if (password.length < 8) {
		throw new HttpError(400, "Password must be at least 8 characters");
	}
	return Bun.password.hash(password);
};

const parseCreateValues = async (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	const now = utcNow();
	return {
		name: parseUserName(body),
		username: normalizeNullableString(
			readOptionalBodyField(body, "username", expectNullableString) ?? null,
		),
		email: normalizeNullableString(
			readOptionalBodyField(body, "email", expectNullableString) ?? null,
		),
		password_hash: await passwordHashFromBody(body),
		is_admin: readOptionalBodyField(body, "is_admin", expectBoolean) ?? false,
		created_at: now,
		updated_at: now,
	};
};

const parseReplaceValues = async (
	body: JsonObject,
	existingRow: Awaited<ReturnType<typeof fetchUser>>,
) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	return {
		name: parseUserName(body),
		username: normalizeNullableString(
			readOptionalBodyField(body, "username", expectNullableString) ?? null,
		),
		email: normalizeNullableString(
			readOptionalBodyField(body, "email", expectNullableString) ?? null,
		),
		password_hash: await passwordHashFromBody(body),
		is_admin: readOptionalBodyField(body, "is_admin", expectBoolean) ?? existingRow?.is_admin ?? false,
		created_at: existingRow?.created_at ?? utcNow(),
		updated_at: utcNow(),
	};
};

const parsePatchValues = async (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	const values: Record<string, unknown> = {};
	const name = parseOptionalUserName(body);
	const username = readOptionalBodyField(body, "username", expectNullableString);
	const email = readOptionalBodyField(body, "email", expectNullableString);
	const passwordHash = readOptionalBodyField(body, "password_hash", expectNullableString);
	const password = readOptionalBodyField(body, "password", expectNullableString);
	const isAdmin = readOptionalBodyField(body, "is_admin", expectBoolean);

	if (name !== undefined) values.name = name;
	if (username !== undefined) values.username = normalizeNullableString(username);
	if (email !== undefined) values.email = normalizeNullableString(email);
	if (passwordHash !== undefined || password !== undefined) values.password_hash = await passwordHashFromBody(body);
	if (isAdmin !== undefined) values.is_admin = isAdmin;

	if (Object.keys(values).length === 0) {
		throw new HttpError(400, "PATCH request must contain at least one writable field");
	}

	values.updated_at = utcNow();
	return values;
};

export const usersCollectionRoute = async (req: Request) => {
	if (req.method === "GET") {
		const url = new URL(req.url);
		return json(
			200,
			await db.client.user.findMany({
				where: parseFilters(url),
				orderBy: parseSort(url),
				select: USER_SELECT,
			}),
		);
	}
	if (req.method === "POST") {
		return json(
			201,
			await db.client.user.create({
			data: await parseCreateValues(await readJsonObject(req)),
				select: USER_SELECT,
			}),
		);
	}
	throw new HttpError(405, "Method not allowed for this route");
};

export const userDetailRoute = async (req: BunRequest<string>) => {
	const id = parseIdParam(req.params.id ?? "");
	const existingRow = await fetchUser(db, id);
	if (!existingRow) throw new HttpError(404, "Resource not found");

	if (req.method === "GET") return json(200, existingRow);
	if (req.method === "PUT") {
		return json(
			200,
			await db.client.user.update({
				where: { id },
			data: await parseReplaceValues(await readJsonObject(req), existingRow),
				select: USER_SELECT,
			}),
		);
	}
	if (req.method === "PATCH") {
		return json(
			200,
			await db.client.user.update({
				where: { id },
			data: await parsePatchValues(await readJsonObject(req)),
				select: USER_SELECT,
			}),
		);
	}
	if (req.method === "DELETE") {
		await db.client.user.delete({ where: { id } });
		return empty(204);
	}
	throw new HttpError(405, "Method not allowed for this route");
};
