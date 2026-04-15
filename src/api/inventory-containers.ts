import type { BunRequest } from "bun";

import {
	assertKnownFields,
	empty,
	expectNullableInteger,
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
	"parent_container_id",
	"notes",
	"created_at",
	"updated_at",
]);
const WRITABLE_FIELDS = ["name", "parent_container_id", "notes"];

const fetchInventoryContainer = (db: Database, id: number) =>
	db.client.inventoryContainer.findUnique({ where: { id } });

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
			case "parent_container_id":
				where[key] = value === "null" ? null : parseIntegerQuery(key, value);
				break;
			case "name":
			case "notes":
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
		name: requireBodyField(body, "name", expectString),
		parent_container_id:
			readOptionalBodyField(body, "parent_container_id", expectNullableInteger) ??
			null,
		notes: readOptionalBodyField(body, "notes", expectNullableString) ?? null,
		created_at: now,
		updated_at: now,
	};
};

const parseReplaceValues = (
	body: JsonObject,
	existingRow: Awaited<ReturnType<typeof fetchInventoryContainer>>,
) => {
	assertKnownFields(body, WRITABLE_FIELDS);

	return {
		name: requireBodyField(body, "name", expectString),
		parent_container_id:
			readOptionalBodyField(body, "parent_container_id", expectNullableInteger) ??
			null,
		notes: readOptionalBodyField(body, "notes", expectNullableString) ?? null,
		created_at: existingRow?.created_at ?? utcNow(),
		updated_at: utcNow(),
	};
};

const parsePatchValues = (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	const values: Record<string, unknown> = {};

	const name = readOptionalBodyField(body, "name", expectString);
	const parentContainerId = readOptionalBodyField(
		body,
		"parent_container_id",
		expectNullableInteger,
	);
	const notes = readOptionalBodyField(body, "notes", expectNullableString);

	if (name !== undefined) values.name = name;
	if (parentContainerId !== undefined) values.parent_container_id = parentContainerId;
	if (notes !== undefined) values.notes = notes;

	if (Object.keys(values).length === 0) {
		throw new HttpError(400, "PATCH request must contain at least one writable field");
	}

	values.updated_at = utcNow();
	return values;
};

const ensureNoContainerCycle = async (
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

		const parentRow = await fetchInventoryContainer(db, currentParentId);
		currentParentId = parentRow?.parent_container_id ?? null;
	}
};

export const inventoryContainersCollectionRoute = (db: Database) =>
	withErrorHandling(async (req: Request) => {
		if (req.method === "GET") {
			const url = new URL(req.url);
			return json(
				200,
				await db.client.inventoryContainer.findMany({
					where: parseFilters(url),
					orderBy: parseSort(url),
				}),
			);
		}

		if (req.method === "POST") {
			return json(
				201,
				await db.client.inventoryContainer.create({
					data: parseCreateValues(await readJsonObject(req)),
				}),
			);
		}

		throw new HttpError(405, "Method not allowed for this route");
	});

export const inventoryContainerDetailRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		const id = parseIdParam(req.params.id);
		const existingRow = await fetchInventoryContainer(db, id);
		if (!existingRow) {
			throw new HttpError(404, "Resource not found");
		}

		if (req.method === "GET") {
			return json(200, existingRow);
		}

		if (req.method === "PUT") {
			const values = parseReplaceValues(await readJsonObject(req), existingRow);
			await ensureNoContainerCycle(db, id, values.parent_container_id as number | null);
			return json(
				200,
				await db.client.inventoryContainer.update({
					where: { id },
					data: values,
				}),
			);
		}

		if (req.method === "PATCH") {
			const values = parsePatchValues(await readJsonObject(req));
			if ("parent_container_id" in values) {
				await ensureNoContainerCycle(
					db,
					id,
					values.parent_container_id as number | null,
				);
			}
			return json(
				200,
				await db.client.inventoryContainer.update({
					where: { id },
					data: values,
				}),
			);
		}

		if (req.method === "DELETE") {
			await db.client.$transaction([
				db.client.inventoryContainer.updateMany({
					where: { parent_container_id: id },
					data: {
						parent_container_id: null,
						updated_at: utcNow(),
					},
				}),
				db.client.inventoryItem.updateMany({
					where: { container_id: id },
					data: {
						container_id: null,
						updated_at: utcNow(),
					},
				}),
				db.client.inventoryContainer.delete({ where: { id } }),
			]);
			return empty(204);
		}

		throw new HttpError(405, "Method not allowed for this route");
	});
