import type { BunRequest } from "bun";
import { Database } from "bun:sqlite";

import {
	assertKnownFields,
	empty,
	expectInteger,
	expectString,
	HttpError,
	insertRow,
	json,
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

const TABLE = "product_links";
const SORT_FIELDS = new Set(["id", "product_id", "label", "url", "created_at"]);
const WRITABLE_FIELDS = ["product_id", "label", "url"];

const fetchProductLink = (db: Database, id: number) =>
	queryRow(db, `SELECT * FROM ${TABLE} WHERE id = ?1`, id);

const parseSort = (url: URL) => {
	const sort = url.searchParams.get("sort");
	if (!sort) {
		return "id ASC";
	}
	if (!SORT_FIELDS.has(sort)) {
		throw new HttpError(400, `Unknown sort field \`${sort}\``);
	}
	return `${sort} ${parseSortOrder(url)}`;
};

const parseFilters = (url: URL) => {
	const filters: string[] = [];
	const params: Array<string | number> = [];

	for (const [key, value] of url.searchParams.entries()) {
		if (key === "sort" || key === "order") continue;

		switch (key) {
			case "id":
			case "product_id":
				filters.push(`${key} = ?`);
				params.push(parseIntegerQuery(key, value));
				break;
			case "label":
			case "url":
			case "created_at":
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
	return {
		product_id: requireBodyField(body, "product_id", expectInteger),
		label: requireBodyField(body, "label", expectString),
		url: requireBodyField(body, "url", expectString),
		created_at: utcNow(),
	};
};

const parseReplaceValues = (
	body: JsonObject,
	existingRow: Record<string, unknown>,
): RowValues => {
	assertKnownFields(body, WRITABLE_FIELDS);
	return {
		product_id: requireBodyField(body, "product_id", expectInteger),
		label: requireBodyField(body, "label", expectString),
		url: requireBodyField(body, "url", expectString),
		created_at: String(existingRow.created_at),
	};
};

const parsePatchValues = (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	const values: RowValues = {};

	const productId = readOptionalBodyField(body, "product_id", expectInteger);
	const label = readOptionalBodyField(body, "label", expectString);
	const url = readOptionalBodyField(body, "url", expectString);

	if (productId !== undefined) values.product_id = productId;
	if (label !== undefined) values.label = label;
	if (url !== undefined) values.url = url;

	if (Object.keys(values).length === 0) {
		throw new HttpError(
			400,
			"PATCH request must contain at least one writable field",
		);
	}

	return values;
};

export const productLinksCollectionRoute = (db: Database) =>
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
			return json(201, fetchProductLink(db, id) ?? {});
		}

		throw new HttpError(405, "Method not allowed for this route");
	});

export const productLinkDetailRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		const id = parseIdParam(req.params.id);
		const existingRow = fetchProductLink(db, id);
		if (!existingRow) {
			throw new HttpError(404, "Resource not found");
		}

		if (req.method === "GET") {
			return json(200, existingRow);
		}

		if (req.method === "PUT") {
			updateRowById(
				db,
				TABLE,
				id,
				parseReplaceValues(await readJsonObject(req), existingRow),
			);
			return json(200, fetchProductLink(db, id) ?? {});
		}

		if (req.method === "PATCH") {
			updateRowById(
				db,
				TABLE,
				id,
				parsePatchValues(await readJsonObject(req)),
			);
			return json(200, fetchProductLink(db, id) ?? {});
		}

		if (req.method === "DELETE") {
			db.prepare(`DELETE FROM ${TABLE} WHERE id = ?1`).run(id);
			return empty(204);
		}

		throw new HttpError(405, "Method not allowed for this route");
	});
