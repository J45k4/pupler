import type { BunRequest } from "bun";

import {
	assertKnownFields,
	empty,
	expectBoolean,
	expectNullableTimestamp,
	expectNullableInteger,
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

const DEFAULT_PROJECT_COLORS = [
	"#ba5a31",
	"#2d7c6f",
	"#6f5aa8",
	"#b7791f",
	"#3f6f9f",
];

const DEFAULT_SORT = [
	{ archived_at: "asc" as const },
	{ name: "asc" as const },
	{ id: "asc" as const },
];
const SORT_FIELDS = new Set(["id", "client_id", "name", "color", "archived_at", "created_at", "updated_at"]);
const WRITABLE_FIELDS = ["client_id", "name", "color", "archived_at"];
const MERGE_FIELDS = ["source_id", "archive_source", "delete_source"];

const PROJECT_INCLUDE = {
	client: {
		select: {
			id: true,
			name: true,
			color: true,
			archived_at: true,
		},
	},
} as const;

const fetchProject = (db: Database, id: number) =>
	db.client.project.findUnique({
		where: { id },
		include: PROJECT_INCLUDE,
	});

const parseProjectName = (body: JsonObject, field = "name") => {
	const name = requireBodyField(body, field, expectString).trim();
	if (!name) {
		throw new HttpError(400, `Field \`${field}\` cannot be empty`);
	}
	return name;
};

const parseOptionalProjectName = (body: JsonObject, field = "name") => {
	const rawName = readOptionalBodyField(body, field, expectString);
	if (rawName === undefined) return undefined;
	const name = rawName.trim();
	if (!name) {
		throw new HttpError(400, `Field \`${field}\` cannot be empty`);
	}
	return name;
};

const parseProjectColor = (value: string) => {
	const color = value.trim();
	if (!color) {
		throw new HttpError(400, "Field `color` cannot be empty");
	}
	return color;
};

const parseOptionalProjectColor = (body: JsonObject, field = "color") => {
	const rawColor = readOptionalBodyField(body, field, expectString);
	if (rawColor === undefined) return undefined;
	return parseProjectColor(rawColor);
};

const defaultProjectColor = (name: string) => {
	const total = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
	return DEFAULT_PROJECT_COLORS[total % DEFAULT_PROJECT_COLORS.length]!;
};

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
				where.id = parseIntegerQuery(key, value);
				break;
			case "client_id":
				where.client_id = value === "null" ? null : parseIntegerQuery(key, value);
				break;
			case "name":
				where.name = { contains: value };
				break;
			case "archived_at":
				where.archived_at = value === "null" ? null : value;
				break;
			case "color":
			case "created_at":
			case "updated_at":
				where[key] = value;
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
	const name = parseProjectName(body);
	const color = parseOptionalProjectColor(body) ?? defaultProjectColor(name);
	return {
		client_id: readOptionalBodyField(body, "client_id", expectNullableInteger) ?? null,
		name,
		color,
		archived_at: readOptionalBodyField(body, "archived_at", expectNullableTimestamp) ?? null,
		created_at: now,
		updated_at: now,
	};
};

const parseReplaceValues = (
	body: JsonObject,
	existingRow: Awaited<ReturnType<typeof fetchProject>>,
) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	const name = parseProjectName(body);
	const color = parseOptionalProjectColor(body) ?? defaultProjectColor(name);
	return {
		client_id: readOptionalBodyField(body, "client_id", expectNullableInteger) ?? null,
		name,
		color,
		archived_at: readOptionalBodyField(body, "archived_at", expectNullableTimestamp) ?? null,
		created_at: existingRow?.created_at ?? utcNow(),
		updated_at: utcNow(),
	};
};

const parsePatchValues = (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	const values: Record<string, unknown> = {};
	const name = parseOptionalProjectName(body);
	const color = parseOptionalProjectColor(body);
	const clientId = readOptionalBodyField(body, "client_id", expectNullableInteger);
	const archivedAt = readOptionalBodyField(body, "archived_at", expectNullableTimestamp);

	if (clientId !== undefined) values.client_id = clientId;
	if (name !== undefined) values.name = name;
	if (color !== undefined) values.color = color;
	if (archivedAt !== undefined) values.archived_at = archivedAt;

	if (Object.keys(values).length === 0) {
		throw new HttpError(400, "PATCH request must contain at least one writable field");
	}

	values.updated_at = utcNow();
	return values;
};

const parseMergeValues = (body: JsonObject) => {
	assertKnownFields(body, MERGE_FIELDS);
	const sourceId = requireBodyField(body, "source_id", expectNullableInteger);
	if (sourceId === null) {
		throw new HttpError(400, "Field `source_id` must be an integer");
	}

	const archiveSource = readOptionalBodyField(body, "archive_source", expectBoolean) ?? true;
	const deleteSource = readOptionalBodyField(body, "delete_source", expectBoolean) ?? false;
	if (archiveSource && deleteSource) {
		throw new HttpError(400, "`archive_source` and `delete_source` cannot both be true");
	}

	return {
		sourceId,
		archiveSource,
		deleteSource,
	};
};

export const projectMergeRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		if (req.method !== "POST") {
			throw new HttpError(405, "Method not allowed for this route");
		}

		const targetId = parseIdParam(req.params.id ?? "");
		const { sourceId, archiveSource, deleteSource } = parseMergeValues(await readJsonObject(req));
		if (sourceId === targetId) {
			throw new HttpError(400, "Cannot merge a project into itself");
		}

		const result = await db.client.$transaction(async (tx) => {
			const [target, source] = await Promise.all([
				tx.project.findUnique({ where: { id: targetId }, include: PROJECT_INCLUDE }),
				tx.project.findUnique({ where: { id: sourceId }, include: PROJECT_INCLUDE }),
			]);
			if (!target || !source) {
				throw new HttpError(404, "Resource not found");
			}

			const now = utcNow();
			const moved = await tx.timeEntry.updateMany({
				where: { project_id: sourceId },
				data: {
					project_id: targetId,
					updated_at: now,
				},
			});

			const updatedTarget = await tx.project.update({
				where: { id: targetId },
				data: { updated_at: now },
				include: PROJECT_INCLUDE,
			});

			let updatedSource = source;
			if (deleteSource) {
				await tx.project.delete({ where: { id: sourceId } });
				updatedSource = {
					...source,
					archived_at: source.archived_at ?? now,
					updated_at: now,
				};
			} else if (archiveSource) {
				updatedSource = await tx.project.update({
					where: { id: sourceId },
					data: {
						archived_at: source.archived_at ?? now,
						updated_at: now,
					},
					include: PROJECT_INCLUDE,
				});
			}

			return {
				target: updatedTarget,
				source: updatedSource,
				moved_time_entry_count: moved.count,
				source_deleted: deleteSource,
				source_archived: !deleteSource && archiveSource,
			};
		});

		return json(200, result);
	});

export const projectsCollectionRoute = (db: Database) =>
	withErrorHandling(async (req: Request) => {
		if (req.method === "GET") {
			const url = new URL(req.url);
			return json(
				200,
				await db.client.project.findMany({
					where: parseFilters(url),
					orderBy: parseSort(url),
					include: PROJECT_INCLUDE,
				}),
			);
		}
		if (req.method === "POST") {
			return json(
				201,
				await db.client.project.create({
					data: parseCreateValues(await readJsonObject(req)),
					include: PROJECT_INCLUDE,
				}),
			);
		}
		throw new HttpError(405, "Method not allowed for this route");
	});

export const projectDetailRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		const id = parseIdParam(req.params.id ?? "");
		const existingRow = await fetchProject(db, id);
		if (!existingRow) throw new HttpError(404, "Resource not found");

		if (req.method === "GET") return json(200, existingRow);
		if (req.method === "PUT") {
			return json(
				200,
				await db.client.project.update({
					where: { id },
					data: parseReplaceValues(await readJsonObject(req), existingRow),
					include: PROJECT_INCLUDE,
				}),
			);
		}
		if (req.method === "PATCH") {
			return json(
				200,
				await db.client.project.update({
					where: { id },
					data: parsePatchValues(await readJsonObject(req)),
					include: PROJECT_INCLUDE,
				}),
			);
		}
		if (req.method === "DELETE") {
			await db.client.project.delete({ where: { id } });
			return empty(204);
		}
		throw new HttpError(405, "Method not allowed for this route");
	});
