import type { BunRequest } from "bun";
import { Database } from "bun:sqlite";

import {
	assertKnownFields,
	empty,
	expectBoolean,
	expectDecimal,
	expectInteger,
	expectNullableString,
	expectString,
	HttpError,
	insertRow,
	json,
	parseBooleanQuery,
	parseDecimalQuery,
	parseIntegerQuery,
	parseSortOrder,
	parseIdParam,
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

const TABLE = "recipe_ingredients";
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

const serializeRecipeIngredient = (row: Record<string, unknown> | null) =>
	serializeBooleanFields(row, ["is_optional"]);

const fetchRecipeIngredient = (db: Database, id: number) =>
	serializeRecipeIngredient(
		queryRow(db, `SELECT * FROM ${TABLE} WHERE id = ?1`, id),
	);

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
			case "product_id":
				filters.push(`${key} = ?`);
				params.push(parseIntegerQuery(key, value));
				break;
			case "quantity":
				filters.push("quantity = ?");
				params.push(parseDecimalQuery(key, value));
				break;
			case "unit":
			case "notes":
			case "created_at":
				if (value === "null") {
					filters.push(`${key} IS NULL`);
				} else {
					filters.push(`${key} = ?`);
					params.push(value);
				}
				break;
			case "is_optional":
				filters.push("is_optional = ?");
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
	return {
		recipe_id: requireBodyField(body, "recipe_id", expectInteger),
		product_id: requireBodyField(body, "product_id", expectInteger),
		quantity: requireBodyField(body, "quantity", expectDecimal),
		unit: requireBodyField(body, "unit", expectString),
		is_optional: requireBodyField(body, "is_optional", expectBoolean),
		notes:
			readOptionalBodyField(body, "notes", expectNullableString) ?? null,
		created_at: utcNow(),
	};
};

const parseReplaceValues = (
	body: JsonObject,
	existingRow: Record<string, unknown>,
): RowValues => {
	assertKnownFields(body, WRITABLE_FIELDS);
	return {
		recipe_id: requireBodyField(body, "recipe_id", expectInteger),
		product_id: requireBodyField(body, "product_id", expectInteger),
		quantity: requireBodyField(body, "quantity", expectDecimal),
		unit: requireBodyField(body, "unit", expectString),
		is_optional: requireBodyField(body, "is_optional", expectBoolean),
		notes:
			readOptionalBodyField(body, "notes", expectNullableString) ?? null,
		created_at: String(existingRow.created_at),
	};
};

const parsePatchValues = (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	const values: RowValues = {};
	const recipeId = readOptionalBodyField(body, "recipe_id", expectInteger);
	const productId = readOptionalBodyField(body, "product_id", expectInteger);
	const quantity = readOptionalBodyField(body, "quantity", expectDecimal);
	const unit = readOptionalBodyField(body, "unit", expectString);
	const isOptional = readOptionalBodyField(
		body,
		"is_optional",
		expectBoolean,
	);
	const notes = readOptionalBodyField(body, "notes", expectNullableString);

	if (recipeId !== undefined) values.recipe_id = recipeId;
	if (productId !== undefined) values.product_id = productId;
	if (quantity !== undefined) values.quantity = quantity;
	if (unit !== undefined) values.unit = unit;
	if (isOptional !== undefined) values.is_optional = isOptional;
	if (notes !== undefined) values.notes = notes;

	if (Object.keys(values).length === 0) {
		throw new HttpError(
			400,
			"PATCH request must contain at least one writable field",
		);
	}
	return values;
};

export const recipeIngredientsCollectionRoute = (db: Database) =>
	withErrorHandling(async (req: Request) => {
		if (req.method === "GET") {
			const url = new URL(req.url);
			const { filters, params } = parseFilters(url);
			const whereClause =
				filters.length > 0 ? ` WHERE ${filters.join(" AND ")}` : "";
			const rows = queryRows(
				db,
				`SELECT * FROM ${TABLE}${whereClause} ORDER BY ${parseSort(url)}`,
				...params,
			);
			return json(
				200,
				rows.map((row) => serializeRecipeIngredient(row) ?? {}),
			);
		}
		if (req.method === "POST") {
			const id = insertRow(
				db,
				TABLE,
				parseCreateValues(await readJsonObject(req)),
			);
			return json(201, fetchRecipeIngredient(db, id) ?? {});
		}
		throw new HttpError(405, "Method not allowed for this route");
	});

export const recipeIngredientDetailRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		const id = parseIdParam(req.params.id);
		const existingRow = queryRow(
			db,
			`SELECT * FROM ${TABLE} WHERE id = ?1`,
			id,
		);
		if (!existingRow) throw new HttpError(404, "Resource not found");

		if (req.method === "GET")
			return json(200, serializeRecipeIngredient(existingRow) ?? {});
		if (req.method === "PUT") {
			updateRowById(
				db,
				TABLE,
				id,
				parseReplaceValues(await readJsonObject(req), existingRow),
			);
			return json(200, fetchRecipeIngredient(db, id) ?? {});
		}
		if (req.method === "PATCH") {
			updateRowById(
				db,
				TABLE,
				id,
				parsePatchValues(await readJsonObject(req)),
			);
			return json(200, fetchRecipeIngredient(db, id) ?? {});
		}
		if (req.method === "DELETE") {
			db.prepare(`DELETE FROM ${TABLE} WHERE id = ?1`).run(id);
			return empty(204);
		}
		throw new HttpError(405, "Method not allowed for this route");
	});
