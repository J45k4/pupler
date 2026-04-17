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

const DEFAULT_SORT = [{ name: "asc" }, { id: "asc" }] as const;
const SORT_FIELDS = new Set([
	"id",
	"name",
	"default_unit",
	"created_at",
	"updated_at",
]);
const WRITABLE_FIELDS = ["name", "default_unit"];

const fetchIngredient = (db: Database, id: number) =>
	db.client.ingredient.findUnique({ where: { id } });

const parseIngredientSort = (url: URL) => {
	const sort = url.searchParams.get("sort");
	if (!sort) {
		return DEFAULT_SORT;
	}
	if (!SORT_FIELDS.has(sort)) {
		throw new HttpError(400, `Unknown sort field \`${sort}\``);
	}
	return [{ [sort]: parseSortOrder(url) }];
};

const parseIngredientFilters = (url: URL) => {
	const where: Record<string, unknown> = {};
	let nameExact: string | null | undefined;
	let nameContains: string | null | undefined;

	for (const [key, value] of url.searchParams.entries()) {
		if (key === "sort" || key === "order") {
			continue;
		}

		switch (key) {
			case "id":
				where.id = parseIntegerQuery(key, value);
				break;
			case "name":
				nameExact = value === "null" ? null : value;
				break;
			case "name_contains":
				nameContains = value === "null" ? null : value;
				break;
			case "default_unit":
			case "created_at":
			case "updated_at":
				where[key] = value === "null" ? null : value;
				break;
			default:
				throw new HttpError(400, `Unknown query parameter \`${key}\``);
		}
	}

	return { where, nameExact, nameContains };
};

const filterIngredientsByName = (
	rows: Array<{ name: string | null }>,
	nameExact: string | null | undefined,
	nameContains: string | null | undefined,
) =>
	rows.filter((row) => {
		if (nameExact !== undefined) {
			if (nameExact === null) {
				return row.name === null;
			}
			if (row.name?.toLowerCase() !== nameExact.toLowerCase()) {
				return false;
			}
		}

		if (nameContains !== undefined) {
			if (nameContains === null) {
				return row.name === null;
			}
			if (!row.name?.toLowerCase().includes(nameContains.toLowerCase())) {
				return false;
			}
		}

		return true;
	});

const parseCreateValues = (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	const now = utcNow();

	return {
		name: requireBodyField(body, "name", expectString),
		default_unit:
			readOptionalBodyField(body, "default_unit", expectNullableString) ?? null,
		created_at: now,
		updated_at: now,
	};
};

const parseReplaceValues = (
	body: JsonObject,
	existingRow: Awaited<ReturnType<typeof fetchIngredient>>,
) => {
	assertKnownFields(body, WRITABLE_FIELDS);

	return {
		name: requireBodyField(body, "name", expectString),
		default_unit:
			readOptionalBodyField(body, "default_unit", expectNullableString) ?? null,
		created_at: existingRow?.created_at ?? utcNow(),
		updated_at: utcNow(),
	};
};

const parsePatchValues = (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS);

	const values: Record<string, unknown> = {};
	const name = readOptionalBodyField(body, "name", expectString);
	const defaultUnit = readOptionalBodyField(
		body,
		"default_unit",
		expectNullableString,
	);

	if (name !== undefined) values.name = name;
	if (defaultUnit !== undefined) values.default_unit = defaultUnit;

	if (Object.keys(values).length === 0) {
		throw new HttpError(
			400,
			"PATCH request must contain at least one writable field",
		);
	}

	values.updated_at = utcNow();
	return values;
};

export const ingredientsCollectionRoute = (db: Database) =>
	withErrorHandling(async (req: Request) => {
		if (req.method === "GET") {
			const url = new URL(req.url);
			const { where, nameExact, nameContains } = parseIngredientFilters(url);
			const rows = await db.client.ingredient.findMany({
				where,
				orderBy: parseIngredientSort(url),
			});
			return json(
				200,
				filterIngredientsByName(rows, nameExact, nameContains),
			);
		}

		if (req.method === "POST") {
			return json(
				201,
				await db.client.ingredient.create({
					data: parseCreateValues(await readJsonObject(req)),
				}),
			);
		}

		throw new HttpError(405, "Method not allowed for this route");
	});

export const ingredientDetailRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		const id = parseIdParam(req.params.id);
		const existingRow = await fetchIngredient(db, id);
		if (!existingRow) {
			throw new HttpError(404, "Resource not found");
		}

		if (req.method === "GET") {
			return json(200, existingRow);
		}

		if (req.method === "PUT") {
			return json(
				200,
				await db.client.ingredient.update({
					where: { id },
					data: parseReplaceValues(await readJsonObject(req), existingRow),
				}),
			);
		}

		if (req.method === "PATCH") {
			return json(
				200,
				await db.client.ingredient.update({
					where: { id },
					data: parsePatchValues(await readJsonObject(req)),
				}),
			);
		}

		if (req.method === "DELETE") {
			await db.client.ingredient.delete({ where: { id } });
			return empty(204);
		}

		throw new HttpError(405, "Method not allowed for this route");
	});
