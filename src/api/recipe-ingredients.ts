import type { BunRequest } from "bun";

import {
	assertKnownFields,
	empty,
	expectBoolean,
	expectDecimal,
	expectInteger,
	expectNullableString,
	expectString,
	HttpError,
	json,
	parseBooleanQuery,
	parseDecimalQuery,
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
	"recipe_id",
	"product_id",
	"quantity",
	"unit",
	"is_optional",
	"notes",
	"created_at",
]);
const WRITABLE_FIELDS = [
	"recipe_id",
	"product_id",
	"quantity",
	"unit",
	"is_optional",
	"notes",
];

const fetchRecipeIngredient = (db: Database, id: number) =>
	db.client.recipeIngredient.findUnique({ where: { id } });

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
			case "recipe_id":
			case "product_id":
				where[key] = parseIntegerQuery(key, value);
				break;
			case "quantity":
				where.quantity = parseDecimalQuery(key, value);
				break;
			case "unit":
			case "notes":
			case "created_at":
				where[key] = value === "null" ? null : value;
				break;
			case "is_optional":
				where.is_optional = parseBooleanQuery(key, value);
				break;
			default:
				throw new HttpError(400, `Unknown query parameter \`${key}\``);
		}
	}
	return where;
};

const parseCreateValues = (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	return {
		recipe_id: requireBodyField(body, "recipe_id", expectInteger),
		product_id: requireBodyField(body, "product_id", expectInteger),
		quantity: requireBodyField(body, "quantity", expectDecimal),
		unit: requireBodyField(body, "unit", expectString),
		is_optional: requireBodyField(body, "is_optional", expectBoolean),
		notes: readOptionalBodyField(body, "notes", expectNullableString) ?? null,
		created_at: utcNow(),
	};
};

const parseReplaceValues = (
	body: JsonObject,
	existingRow: Awaited<ReturnType<typeof fetchRecipeIngredient>>,
) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	return {
		recipe_id: requireBodyField(body, "recipe_id", expectInteger),
		product_id: requireBodyField(body, "product_id", expectInteger),
		quantity: requireBodyField(body, "quantity", expectDecimal),
		unit: requireBodyField(body, "unit", expectString),
		is_optional: requireBodyField(body, "is_optional", expectBoolean),
		notes: readOptionalBodyField(body, "notes", expectNullableString) ?? null,
		created_at: existingRow?.created_at ?? utcNow(),
	};
};

const parsePatchValues = (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	const values: Record<string, unknown> = {};
	const recipeId = readOptionalBodyField(body, "recipe_id", expectInteger);
	const productId = readOptionalBodyField(body, "product_id", expectInteger);
	const quantity = readOptionalBodyField(body, "quantity", expectDecimal);
	const unit = readOptionalBodyField(body, "unit", expectString);
	const isOptional = readOptionalBodyField(body, "is_optional", expectBoolean);
	const notes = readOptionalBodyField(body, "notes", expectNullableString);

	if (recipeId !== undefined) values.recipe_id = recipeId;
	if (productId !== undefined) values.product_id = productId;
	if (quantity !== undefined) values.quantity = quantity;
	if (unit !== undefined) values.unit = unit;
	if (isOptional !== undefined) values.is_optional = isOptional;
	if (notes !== undefined) values.notes = notes;

	if (Object.keys(values).length === 0) {
		throw new HttpError(400, "PATCH request must contain at least one writable field");
	}
	return values;
};

export const recipeIngredientsCollectionRoute = (db: Database) =>
	withErrorHandling(async (req: Request) => {
		if (req.method === "GET") {
			const url = new URL(req.url);
			return json(
				200,
				await db.client.recipeIngredient.findMany({
					where: parseFilters(url),
					orderBy: parseSort(url),
				}),
			);
		}
		if (req.method === "POST") {
			return json(
				201,
				await db.client.recipeIngredient.create({
					data: parseCreateValues(await readJsonObject(req)),
				}),
			);
		}
		throw new HttpError(405, "Method not allowed for this route");
	});

export const recipeIngredientDetailRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		const id = parseIdParam(req.params.id);
		const existingRow = await fetchRecipeIngredient(db, id);
		if (!existingRow) throw new HttpError(404, "Resource not found");

		if (req.method === "GET") return json(200, existingRow);
		if (req.method === "PUT") {
			return json(
				200,
				await db.client.recipeIngredient.update({
					where: { id },
					data: parseReplaceValues(await readJsonObject(req), existingRow),
				}),
			);
		}
		if (req.method === "PATCH") {
			return json(
				200,
				await db.client.recipeIngredient.update({
					where: { id },
					data: parsePatchValues(await readJsonObject(req)),
				}),
			);
		}
		if (req.method === "DELETE") {
			await db.client.recipeIngredient.delete({ where: { id } });
			return empty(204);
		}
		throw new HttpError(405, "Method not allowed for this route");
	});
