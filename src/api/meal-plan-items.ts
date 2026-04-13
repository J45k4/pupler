import type { BunRequest } from "bun";
import { Database } from "bun:sqlite";

import {
	assertKnownFields,
	empty,
	expectDate,
	expectInteger,
	expectString,
	HttpError,
	insertRow,
	json,
	parseDateQuery,
	parseIntegerQuery,
	parseSortOrder,
	parseIdParam,
	queryRow,
	queryRows,
	readJsonObject,
	readOptionalBodyField,
	requireBodyField,
	updateRowById,
	utcNow,
	withErrorHandling,
	type JsonObject,
	type RowValues,
} from "./core";

const TABLE = "meal_plan_items";
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
	queryRow(db, `SELECT * FROM ${TABLE} WHERE id = ?1`, id);

const parseSort = (url: URL) => {
	const sort = url.searchParams.get("sort");
	if (!sort) return "id ASC";
	if (!SORT_FIELDS.has(sort))
		throw new HttpError(400, `Unknown sort field \`${sort}\``);
	return `${sort} ${parseSortOrder(url)}`;
};

const parseFilters = (url: URL) => {
	const filters: string[] = [];
	const params: Array<string | number> = [];
	for (const [key, value] of url.searchParams.entries()) {
		if (key === "sort" || key === "order") continue;
		switch (key) {
			case "id":
			case "recipe_id":
			case "servings":
				filters.push(`${key} = ?`);
				params.push(parseIntegerQuery(key, value));
				break;
			case "planned_date":
				filters.push("planned_date = ?");
				params.push(parseDateQuery(key, value));
				break;
			case "meal_type":
			case "status":
			case "created_at":
			case "updated_at":
				if (value === "null") {
					filters.push(`${key} IS NULL`);
				} else {
					filters.push(`${key} = ?`);
					params.push(value);
				}
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
	existingRow: Record<string, unknown>,
): RowValues => {
	assertKnownFields(body, WRITABLE_FIELDS);
	return {
		recipe_id: requireBodyField(body, "recipe_id", expectInteger),
		planned_date: requireBodyField(body, "planned_date", expectDate),
		meal_type: requireBodyField(body, "meal_type", expectString),
		servings: requireBodyField(body, "servings", expectInteger),
		status: requireBodyField(body, "status", expectString),
		created_at: String(existingRow.created_at),
		updated_at: utcNow(),
	};
};

const parsePatchValues = (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	const values: RowValues = {};
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
		throw new HttpError(
			400,
			"PATCH request must contain at least one writable field",
		);
	}
	values.updated_at = utcNow();
	return values;
};

export const mealPlanItemsCollectionRoute = (db: Database) =>
	withErrorHandling(async (req: Request) => {
		if (req.method === "GET") {
			const url = new URL(req.url);
			const { filters, params } = parseFilters(url);
			const whereClause =
				filters.length > 0 ? ` WHERE ${filters.join(" AND ")}` : "";
			return json(
				200,
				queryRows(
					db,
					`SELECT * FROM ${TABLE}${whereClause} ORDER BY ${parseSort(url)}`,
					...params,
				),
			);
		}
		if (req.method === "POST") {
			const id = insertRow(
				db,
				TABLE,
				parseCreateValues(await readJsonObject(req)),
			);
			return json(201, fetchMealPlanItem(db, id) ?? {});
		}
		throw new HttpError(405, "Method not allowed for this route");
	});

export const mealPlanItemDetailRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		const id = parseIdParam(req.params.id);
		const existingRow = fetchMealPlanItem(db, id);
		if (!existingRow) throw new HttpError(404, "Resource not found");

		if (req.method === "GET") return json(200, existingRow);
		if (req.method === "PUT") {
			updateRowById(
				db,
				TABLE,
				id,
				parseReplaceValues(await readJsonObject(req), existingRow),
			);
			return json(200, fetchMealPlanItem(db, id) ?? {});
		}
		if (req.method === "PATCH") {
			updateRowById(
				db,
				TABLE,
				id,
				parsePatchValues(await readJsonObject(req)),
			);
			return json(200, fetchMealPlanItem(db, id) ?? {});
		}
		if (req.method === "DELETE") {
			db.prepare(`DELETE FROM ${TABLE} WHERE id = ?1`).run(id);
			return empty(204);
		}
		throw new HttpError(405, "Method not allowed for this route");
	});
