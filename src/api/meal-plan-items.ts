import type { BunRequest } from "bun";

import {
	assertKnownFields,
	empty,
	expectDate,
	expectInteger,
	expectString,
	HttpError,
	json,
	parseDateQuery,
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
	"planned_date",
	"meal_type",
	"servings",
	"status",
	"created_at",
	"updated_at",
]);
const WRITABLE_FIELDS = [
	"recipe_id",
	"planned_date",
	"meal_type",
	"servings",
	"status",
];

const fetchMealPlanItem = (db: Database, id: number) =>
	db.client.mealPlanItem.findUnique({ where: { id } });

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
			case "servings":
				where[key] = parseIntegerQuery(key, value);
				break;
			case "planned_date":
				where.planned_date = parseDateQuery(key, value);
				break;
			case "meal_type":
			case "status":
			case "created_at":
			case "updated_at":
				where[key] = value === "null" ? null : value;
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
		recipe_id: requireBodyField(body, "recipe_id", expectInteger),
		planned_date: requireBodyField(body, "planned_date", expectDate),
		meal_type: requireBodyField(body, "meal_type", expectString),
		servings: requireBodyField(body, "servings", expectInteger),
		status: requireBodyField(body, "status", expectString),
		created_at: now,
		updated_at: now,
	};
};

const parseReplaceValues = (
	body: JsonObject,
	existingRow: Awaited<ReturnType<typeof fetchMealPlanItem>>,
) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	return {
		recipe_id: requireBodyField(body, "recipe_id", expectInteger),
		planned_date: requireBodyField(body, "planned_date", expectDate),
		meal_type: requireBodyField(body, "meal_type", expectString),
		servings: requireBodyField(body, "servings", expectInteger),
		status: requireBodyField(body, "status", expectString),
		created_at: existingRow?.created_at ?? utcNow(),
		updated_at: utcNow(),
	};
};

const parsePatchValues = (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	const values: Record<string, unknown> = {};
	const recipeId = readOptionalBodyField(body, "recipe_id", expectInteger);
	const plannedDate = readOptionalBodyField(body, "planned_date", expectDate);
	const mealType = readOptionalBodyField(body, "meal_type", expectString);
	const servings = readOptionalBodyField(body, "servings", expectInteger);
	const status = readOptionalBodyField(body, "status", expectString);

	if (recipeId !== undefined) values.recipe_id = recipeId;
	if (plannedDate !== undefined) values.planned_date = plannedDate;
	if (mealType !== undefined) values.meal_type = mealType;
	if (servings !== undefined) values.servings = servings;
	if (status !== undefined) values.status = status;

	if (Object.keys(values).length === 0) {
		throw new HttpError(400, "PATCH request must contain at least one writable field");
	}
	values.updated_at = utcNow();
	return values;
};

export const mealPlanItemsCollectionRoute = (db: Database) =>
	withErrorHandling(async (req: Request) => {
		if (req.method === "GET") {
			const url = new URL(req.url);
			return json(
				200,
				await db.client.mealPlanItem.findMany({
					where: parseFilters(url),
					orderBy: parseSort(url),
				}),
			);
		}
		if (req.method === "POST") {
			return json(
				201,
				await db.client.mealPlanItem.create({
					data: parseCreateValues(await readJsonObject(req)),
				}),
			);
		}
		throw new HttpError(405, "Method not allowed for this route");
	});

export const mealPlanItemDetailRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		const id = parseIdParam(req.params.id);
		const existingRow = await fetchMealPlanItem(db, id);
		if (!existingRow) throw new HttpError(404, "Resource not found");

		if (req.method === "GET") return json(200, existingRow);
		if (req.method === "PUT") {
			return json(
				200,
				await db.client.mealPlanItem.update({
					where: { id },
					data: parseReplaceValues(await readJsonObject(req), existingRow),
				}),
			);
		}
		if (req.method === "PATCH") {
			return json(
				200,
				await db.client.mealPlanItem.update({
					where: { id },
					data: parsePatchValues(await readJsonObject(req)),
				}),
			);
		}
		if (req.method === "DELETE") {
			await db.client.mealPlanItem.delete({ where: { id } });
			return empty(204);
		}
		throw new HttpError(405, "Method not allowed for this route");
	});
