import type { BunRequest } from "bun";

import {
	assertKnownFields,
	empty,
	expectBoolean,
	expectNullableInteger,
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

const SORT_FIELDS = new Set([
	"id",
	"name",
	"description",
	"instructions",
	"servings",
	"is_active",
	"created_at",
	"updated_at",
]);
const WRITABLE_FIELDS = [
	"name",
	"description",
	"instructions",
	"servings",
	"is_active",
];

const fetchRecipe = (db: Database, id: number) =>
	db.client.recipe.findUnique({ where: { id } });

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
			case "servings":
				where[key] = value === "null" ? null : parseIntegerQuery(key, value);
				break;
			case "name":
			case "description":
			case "instructions":
			case "created_at":
			case "updated_at":
				where[key] = value === "null" ? null : value;
				break;
			case "is_active":
				where.is_active = parseBooleanQuery(key, value);
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
		description:
			readOptionalBodyField(body, "description", expectNullableString) ?? null,
		instructions:
			readOptionalBodyField(body, "instructions", expectNullableString) ?? null,
		servings:
			readOptionalBodyField(body, "servings", expectNullableInteger) ?? null,
		is_active: requireBodyField(body, "is_active", expectBoolean),
		created_at: now,
		updated_at: now,
	};
};

const parseReplaceValues = (
	body: JsonObject,
	existingRow: Awaited<ReturnType<typeof fetchRecipe>>,
) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	return {
		name: requireBodyField(body, "name", expectString),
		description:
			readOptionalBodyField(body, "description", expectNullableString) ?? null,
		instructions:
			readOptionalBodyField(body, "instructions", expectNullableString) ?? null,
		servings:
			readOptionalBodyField(body, "servings", expectNullableInteger) ?? null,
		is_active: requireBodyField(body, "is_active", expectBoolean),
		created_at: existingRow?.created_at ?? utcNow(),
		updated_at: utcNow(),
	};
};

const parsePatchValues = (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	const values: Record<string, unknown> = {};

	const name = readOptionalBodyField(body, "name", expectString);
	const description = readOptionalBodyField(
		body,
		"description",
		expectNullableString,
	);
	const instructions = readOptionalBodyField(
		body,
		"instructions",
		expectNullableString,
	);
	const servings = readOptionalBodyField(
		body,
		"servings",
		expectNullableInteger,
	);
	const isActive = readOptionalBodyField(body, "is_active", expectBoolean);

	if (name !== undefined) values.name = name;
	if (description !== undefined) values.description = description;
	if (instructions !== undefined) values.instructions = instructions;
	if (servings !== undefined) values.servings = servings;
	if (isActive !== undefined) values.is_active = isActive;

	if (Object.keys(values).length === 0) {
		throw new HttpError(400, "PATCH request must contain at least one writable field");
	}

	values.updated_at = utcNow();
	return values;
};

export const recipesCollectionRoute = (db: Database) =>
	withErrorHandling(async (req: Request) => {
		if (req.method === "GET") {
			const url = new URL(req.url);
			return json(
				200,
				await db.client.recipe.findMany({
					where: parseFilters(url),
					orderBy: parseSort(url),
				}),
			);
		}
		if (req.method === "POST") {
			return json(
				201,
				await db.client.recipe.create({
					data: parseCreateValues(await readJsonObject(req)),
				}),
			);
		}
		throw new HttpError(405, "Method not allowed for this route");
	});

export const recipeDetailRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		const id = parseIdParam(req.params.id);
		const existingRow = await fetchRecipe(db, id);
		if (!existingRow) throw new HttpError(404, "Resource not found");

		if (req.method === "GET") return json(200, existingRow);
		if (req.method === "PUT") {
			return json(
				200,
				await db.client.recipe.update({
					where: { id },
					data: parseReplaceValues(await readJsonObject(req), existingRow),
				}),
			);
		}
		if (req.method === "PATCH") {
			return json(
				200,
				await db.client.recipe.update({
					where: { id },
					data: parsePatchValues(await readJsonObject(req)),
				}),
			);
		}
		if (req.method === "DELETE") {
			await db.client.recipe.delete({ where: { id } });
			return empty(204);
		}
		throw new HttpError(405, "Method not allowed for this route");
	});
