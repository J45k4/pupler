import type { BunRequest } from "bun";
import { Database } from "bun:sqlite";

import {
	assertKnownFields,
	empty,
	expectInteger,
	expectNullableInteger,
	expectNullableString,
	expectString,
	HttpError,
	insertRow,
	json,
	parseIdParam,
	parseIntegerQuery,
	parseSortOrder,
	queryRow,
	queryRows,
	readJsonObject,
	readOptionalBodyField,
	requireBodyField,
	updateRowById,
	utcNow,
	withErrorHandling,
	type JsonObject,
	type Row,
	type RowValues,
} from "./core";

const TABLE = "inventory_containers";
const DEFAULT_SORT = "name ASC, id ASC";
const SORT_FIELDS = new Set([
	"id",
	"name",
	"parent_container_id",
	"notes",
	"created_at",
	"updated_at",
]);
const WRITABLE_FIELDS = ["name", "parent_container_id", "notes"];

const fetchInventoryContainer = (db: Database, id: number) =>
	queryRow(db, `SELECT * FROM ${TABLE} WHERE id = ?1`, id);

const parseSort = (url: URL) => {
	const sort = url.searchParams.get("sort");
	if (!sort) return DEFAULT_SORT;
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
			case "parent_container_id":
				if (value === "null") {
					filters.push(`${key} IS NULL`);
				} else {
					filters.push(`${key} = ?`);
					params.push(parseIntegerQuery(key, value));
				}
				break;
			case "name":
			case "notes":
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
		name: requireBodyField(body, "name", expectString),
		parent_container_id:
			readOptionalBodyField(
				body,
				"parent_container_id",
				expectNullableInteger,
			) ?? null,
		notes:
			readOptionalBodyField(body, "notes", expectNullableString) ?? null,
		created_at: now,
		updated_at: now,
	};
};

const parseReplaceValues = (body: JsonObject, existingRow: Row): RowValues => {
	assertKnownFields(body, WRITABLE_FIELDS);

	return {
		name: requireBodyField(body, "name", expectString),
		parent_container_id:
			readOptionalBodyField(
				body,
				"parent_container_id",
				expectNullableInteger,
			) ?? null,
		notes:
			readOptionalBodyField(body, "notes", expectNullableString) ?? null,
		created_at: String(existingRow.created_at),
		updated_at: utcNow(),
	};
};

const parsePatchValues = (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	const values: RowValues = {};

	const name = readOptionalBodyField(body, "name", expectString);
	const parentContainerId = readOptionalBodyField(
		body,
		"parent_container_id",
		expectNullableInteger,
	);
	const notes = readOptionalBodyField(body, "notes", expectNullableString);

	if (name !== undefined) values.name = name;
	if (parentContainerId !== undefined) {
		values.parent_container_id = parentContainerId;
	}
	if (notes !== undefined) values.notes = notes;

	if (Object.keys(values).length === 0) {
		throw new HttpError(
			400,
			"PATCH request must contain at least one writable field",
		);
	}

	values.updated_at = utcNow();
	return values;
};

const ensureNoContainerCycle = (
	db: Database,
	containerId: number,
	parentContainerId: number | null | undefined,
) => {
	if (parentContainerId === undefined || parentContainerId === null) {
		return;
	}
	if (parentContainerId === containerId) {
		throw new HttpError(400, "Container cannot be its own parent");
	}

	let currentParentId: number | null = parentContainerId;

	while (currentParentId !== null) {
		if (currentParentId === containerId) {
			throw new HttpError(400, "Container parent would create a cycle");
		}

		const parentRow = fetchInventoryContainer(db, currentParentId);
		currentParentId = parentRow
			? ((parentRow.parent_container_id as number | null) ?? null)
			: null;
	}
};

export const inventoryContainersCollectionRoute = (db: Database) =>
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
			const values = parseCreateValues(await readJsonObject(req));
			const id = insertRow(db, TABLE, values);
			return json(201, fetchInventoryContainer(db, id) ?? {});
		}

		throw new HttpError(405, "Method not allowed for this route");
	});

export const inventoryContainerDetailRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		const id = parseIdParam(req.params.id);
		const existingRow = fetchInventoryContainer(db, id);
		if (!existingRow) {
			throw new HttpError(404, "Resource not found");
		}

		if (req.method === "GET") {
			return json(200, existingRow);
		}

		if (req.method === "PUT") {
			const values = parseReplaceValues(
				await readJsonObject(req),
				existingRow,
			);
			ensureNoContainerCycle(
				db,
				id,
				(values.parent_container_id as number | null | undefined) ??
					null,
			);
			updateRowById(db, TABLE, id, values);
			return json(200, fetchInventoryContainer(db, id) ?? {});
		}

		if (req.method === "PATCH") {
			const values = parsePatchValues(await readJsonObject(req));
			if ("parent_container_id" in values) {
				ensureNoContainerCycle(
					db,
					id,
					(values.parent_container_id as number | null | undefined) ??
						null,
				);
			}
			updateRowById(db, TABLE, id, values);
			return json(200, fetchInventoryContainer(db, id) ?? {});
		}

		if (req.method === "DELETE") {
			db.transaction(() => {
				db.prepare(
					`UPDATE ${TABLE} SET parent_container_id = NULL, updated_at = ?1 WHERE parent_container_id = ?2`,
				).run(utcNow(), id);
				db.prepare(
					"UPDATE inventory_items SET container_id = NULL, updated_at = ?1 WHERE container_id = ?2",
				).run(utcNow(), id);
				db.prepare(`DELETE FROM ${TABLE} WHERE id = ?1`).run(id);
			})();
			return empty(204);
		}

		throw new HttpError(405, "Method not allowed for this route");
	});
