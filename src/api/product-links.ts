import type { BunRequest } from "bun";

import {
	assertKnownFields,
	empty,
	expectInteger,
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

const SORT_FIELDS = new Set(["id", "product_id", "label", "url", "created_at"]);
const WRITABLE_FIELDS = ["product_id", "label", "url"];

const fetchProductLink = (db: Database, id: number) =>
	db.client.productLink.findUnique({ where: { id } });

const parseSort = (url: URL) => {
	const sort = url.searchParams.get("sort");
	if (!sort) {
		return [{ id: "asc" }] as const;
	}
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
			case "product_id":
				where[key] = parseIntegerQuery(key, value);
				break;
			case "label":
			case "url":
			case "created_at":
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
	return {
		product_id: requireBodyField(body, "product_id", expectInteger),
		label: requireBodyField(body, "label", expectString),
		url: requireBodyField(body, "url", expectString),
		created_at: utcNow(),
	};
};

const parseReplaceValues = (
	body: JsonObject,
	existingRow: Awaited<ReturnType<typeof fetchProductLink>>,
) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	return {
		product_id: requireBodyField(body, "product_id", expectInteger),
		label: requireBodyField(body, "label", expectString),
		url: requireBodyField(body, "url", expectString),
		created_at: existingRow?.created_at ?? utcNow(),
	};
};

const parsePatchValues = (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	const values: Record<string, unknown> = {};

	const productId = readOptionalBodyField(body, "product_id", expectInteger);
	const label = readOptionalBodyField(body, "label", expectString);
	const url = readOptionalBodyField(body, "url", expectString);

	if (productId !== undefined) values.product_id = productId;
	if (label !== undefined) values.label = label;
	if (url !== undefined) values.url = url;

	if (Object.keys(values).length === 0) {
		throw new HttpError(400, "PATCH request must contain at least one writable field");
	}

	return values;
};

export const productLinksCollectionRoute = (db: Database) =>
	withErrorHandling(async (req: Request) => {
		if (req.method === "GET") {
			return json(
				200,
				await db.client.productLink.findMany({
					where: parseFilters(new URL(req.url)),
					orderBy: parseSort(new URL(req.url)),
				}),
			);
		}

		if (req.method === "POST") {
			return json(
				201,
				await db.client.productLink.create({
					data: parseCreateValues(await readJsonObject(req)),
				}),
			);
		}

		throw new HttpError(405, "Method not allowed for this route");
	});

export const productLinkDetailRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		const id = parseIdParam(req.params.id);
		const existingRow = await fetchProductLink(db, id);
		if (!existingRow) {
			throw new HttpError(404, "Resource not found");
		}

		if (req.method === "GET") {
			return json(200, existingRow);
		}

		if (req.method === "PUT") {
			return json(
				200,
				await db.client.productLink.update({
					where: { id },
					data: parseReplaceValues(await readJsonObject(req), existingRow),
				}),
			);
		}

		if (req.method === "PATCH") {
			return json(
				200,
				await db.client.productLink.update({
					where: { id },
					data: parsePatchValues(await readJsonObject(req)),
				}),
			);
		}

		if (req.method === "DELETE") {
			await db.client.productLink.delete({ where: { id } });
			return empty(204);
		}

		throw new HttpError(405, "Method not allowed for this route");
	});
