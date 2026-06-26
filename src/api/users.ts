import type { BunRequest } from "bun";

import {
	assertKnownFields,
	empty,
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
	withErrorHandling,
	type Database,
	type JsonObject,
} from "./core";

const DEFAULT_SORT = [
	{ name: "asc" as const },
	{ id: "asc" as const },
];
const SORT_FIELDS = new Set(["id", "name", "username", "email", "created_at", "updated_at"]);
const WRITABLE_FIELDS = ["name", "username", "email", "password_hash"];

const USER_SELECT = {
	id: true,
	name: true,
	username: true,
	email: true,
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

const parseCreateValues = (body: JsonObject) => {
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
		password_hash: normalizeNullableString(
			readOptionalBodyField(body, "password_hash", expectNullableString) ?? null,
		),
		created_at: now,
		updated_at: now,
	};
};

const parseReplaceValues = (
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
		password_hash: normalizeNullableString(
			readOptionalBodyField(body, "password_hash", expectNullableString) ?? null,
		),
		created_at: existingRow?.created_at ?? utcNow(),
		updated_at: utcNow(),
	};
};

const parsePatchValues = (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	const values: Record<string, unknown> = {};
	const name = parseOptionalUserName(body);
	const username = readOptionalBodyField(body, "username", expectNullableString);
	const email = readOptionalBodyField(body, "email", expectNullableString);
	const passwordHash = readOptionalBodyField(body, "password_hash", expectNullableString);

	if (name !== undefined) values.name = name;
	if (username !== undefined) values.username = normalizeNullableString(username);
	if (email !== undefined) values.email = normalizeNullableString(email);
	if (passwordHash !== undefined) {
		values.password_hash = normalizeNullableString(passwordHash);
	}

	if (Object.keys(values).length === 0) {
		throw new HttpError(400, "PATCH request must contain at least one writable field");
	}

	values.updated_at = utcNow();
	return values;
};

export const usersCollectionRoute = (db: Database) =>
	withErrorHandling(async (req: Request) => {
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
					data: parseCreateValues(await readJsonObject(req)),
					select: USER_SELECT,
				}),
			);
		}
		throw new HttpError(405, "Method not allowed for this route");
	});

export const userDetailRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		const id = parseIdParam(req.params.id ?? "");
		const existingRow = await fetchUser(db, id);
		if (!existingRow) throw new HttpError(404, "Resource not found");

		if (req.method === "GET") return json(200, existingRow);
		if (req.method === "PUT") {
			return json(
				200,
				await db.client.user.update({
					where: { id },
					data: parseReplaceValues(await readJsonObject(req), existingRow),
					select: USER_SELECT,
				}),
			);
		}
		if (req.method === "PATCH") {
			return json(
				200,
				await db.client.user.update({
					where: { id },
					data: parsePatchValues(await readJsonObject(req)),
					select: USER_SELECT,
				}),
			);
		}
		if (req.method === "DELETE") {
			await db.client.user.delete({ where: { id } });
			return empty(204);
		}
		throw new HttpError(405, "Method not allowed for this route");
	});
