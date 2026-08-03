import type { BunRequest } from "bun";

import { db } from "../db";
import {
	assertKnownFields,
	empty,
	expectNullableInteger,
	expectNullableString,
	expectNullableTimestamp,
	expectString,
	expectTimestamp,
	HttpError,
	json,
	parseBooleanQuery,
	parseIdParam,
	parseIntegerQuery,
	parseSortOrder,
	parseTimestampQuery,
	readJsonObject,
	readOptionalBodyField,
	requireBodyField,
	utcNow,
	type Database,
	type JsonObject,
} from "./core";

const DEFAULT_SORT = [
	{ started_at: "desc" as const },
	{ id: "desc" as const },
];
const SORT_FIELDS = [
	"id",
	"user_id",
	"project_id",
	"description",
	"started_at",
	"ended_at",
	"created_at",
	"updated_at",
];
const WRITABLE_FIELDS = ["user_id", "project_id", "description", "started_at", "ended_at"];
const START_FIELDS = ["user_id", "project_id", "description", "started_at"];
const STOP_FIELDS = ["ended_at"];

const ENTRY_INCLUDE = {
	user: {
		select: {
			id: true,
			name: true,
			email: true,
		},
	},
	project: {
		select: {
			id: true,
			client_id: true,
			name: true,
			color: true,
			archived_at: true,
			client: {
				select: {
					id: true,
					name: true,
					color: true,
					archived_at: true,
				},
			},
		},
	},
} as const;

const fetchTimeEntry = (db: Database, id: number) =>
	db.client.timeEntry.findUnique({
		where: { id },
		include: ENTRY_INCLUDE,
	});

const assertChronologicalRange = (
	startedAt: string,
	endedAt: string | null,
) => {
	if (endedAt !== null && Date.parse(endedAt) <= Date.parse(startedAt)) {
		throw new HttpError(400, "Field `ended_at` must be after `started_at`");
	}
};

const assertProjectBeforeStop = (projectId: number | null | undefined) => {
	if (projectId === null || projectId === undefined) {
		throw new HttpError(400, "Project is required before stopping timer");
	}
};

const normalizeDescription = (value: string | null) => {
	if (value === null) return null;
	const description = value.trim();
	return description ? description : null;
};

const parseSort = (url: URL) => {
	const sort = url.searchParams.get("sort");
	if (!sort) return DEFAULT_SORT;
	if (!SORT_FIELDS.includes(sort)) {
		throw new HttpError(400, `Unknown sort field \`${sort}\``);
	}
	return [{ [sort]: parseSortOrder(url) }];
};

const parseFilters = (url: URL) => {
	const where: Record<string, unknown> = {};
	const andFilters: Record<string, unknown>[] = [];

	for (const [key, value] of url.searchParams.entries()) {
		if (key === "sort" || key === "order") continue;
		switch (key) {
			case "id":
			case "user_id":
			case "project_id":
				where[key] = value === "null" ? null : parseIntegerQuery(key, value);
				break;
			case "description":
				where.description = value === "null" ? null : { contains: value };
				break;
			case "started_at":
				where.started_at = value === "null" ? null : parseTimestampQuery(key, value);
				break;
			case "ended_at":
				where.ended_at = value === "null" ? null : parseTimestampQuery(key, value);
				break;
			case "running":
				where.ended_at = parseBooleanQuery(key, value) ? null : { not: null };
				break;
			case "from": {
				const from = parseTimestampQuery(key, value);
				andFilters.push({
					OR: [
						{ ended_at: null },
						{ ended_at: { gte: from } },
					],
				});
				break;
			}
			case "to": {
				const to = parseTimestampQuery(key, value);
				andFilters.push({ started_at: { lte: to } });
				break;
			}
			default:
				throw new HttpError(400, `Unknown query parameter \`${key}\``);
		}
	}

	if (andFilters.length) {
		where.AND = andFilters;
	}
	return where;
};

const parseCreateValues = (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	const now = utcNow();
	const startedAt = requireBodyField(body, "started_at", expectTimestamp);
	const endedAt = readOptionalBodyField(body, "ended_at", expectNullableTimestamp) ?? null;
	const userId = readOptionalBodyField(body, "user_id", expectNullableInteger) ?? null;
	const projectId = readOptionalBodyField(body, "project_id", expectNullableInteger) ?? null;
	assertChronologicalRange(startedAt, endedAt);
	if (endedAt !== null) {
		assertProjectBeforeStop(projectId);
	}
	return {
		user_id: userId,
		project_id: projectId,
		description: normalizeDescription(
			readOptionalBodyField(body, "description", expectNullableString) ?? null,
		),
		started_at: startedAt,
		ended_at: endedAt,
		created_at: now,
		updated_at: now,
	};
};

const parseReplaceValues = (
	body: JsonObject,
	existingRow: Awaited<ReturnType<typeof fetchTimeEntry>>,
) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	const now = utcNow();
	const startedAt = requireBodyField(body, "started_at", expectTimestamp);
	const endedAt = readOptionalBodyField(body, "ended_at", expectNullableTimestamp) ?? null;
	const userId = readOptionalBodyField(body, "user_id", expectNullableInteger) ?? null;
	const projectId = readOptionalBodyField(body, "project_id", expectNullableInteger) ?? null;
	assertChronologicalRange(startedAt, endedAt);
	if (endedAt !== null) {
		assertProjectBeforeStop(projectId);
	}
	return {
		user_id: userId,
		project_id: projectId,
		description: normalizeDescription(
			readOptionalBodyField(body, "description", expectNullableString) ?? null,
		),
		started_at: startedAt,
		ended_at: endedAt,
		created_at: existingRow?.created_at ?? now,
		updated_at: now,
	};
};

const parsePatchValues = (
	body: JsonObject,
	existingRow: Awaited<ReturnType<typeof fetchTimeEntry>>,
) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	const values: Record<string, unknown> = {};

	const userId = readOptionalBodyField(body, "user_id", expectNullableInteger);
	const projectId = readOptionalBodyField(body, "project_id", expectNullableInteger);
	const description = readOptionalBodyField(
		body,
		"description",
		expectNullableString,
	);
	const startedAt = readOptionalBodyField(body, "started_at", expectTimestamp);
	const endedAt = readOptionalBodyField(body, "ended_at", expectNullableTimestamp);

	if (userId !== undefined) values.user_id = userId;
	if (projectId !== undefined) values.project_id = projectId;
	if (description !== undefined) values.description = normalizeDescription(description);
	if (startedAt !== undefined) values.started_at = startedAt;
	if (endedAt !== undefined) values.ended_at = endedAt;

	if (Object.keys(values).length === 0) {
		throw new HttpError(400, "PATCH request must contain at least one writable field");
	}

	assertChronologicalRange(
		(typeof values.started_at === "string" ? values.started_at : existingRow?.started_at) ?? "",
		values.ended_at === undefined
			? (existingRow?.ended_at ?? null)
			: (values.ended_at as string | null),
	);
	const nextEndedAt = values.ended_at === undefined
		? (existingRow?.ended_at ?? null)
		: (values.ended_at as string | null);
	const nextProjectId = values.project_id === undefined
		? existingRow?.project_id
		: (values.project_id as number | null);
	if (nextEndedAt !== null) {
		assertProjectBeforeStop(nextProjectId);
	}
	values.updated_at = utcNow();
	return values;
};

const parseStartValues = (body: JsonObject) => {
	assertKnownFields(body, START_FIELDS);
	const startedAt = readOptionalBodyField(body, "started_at", expectTimestamp) ?? utcNow();
	return {
		user_id: readOptionalBodyField(body, "user_id", expectNullableInteger) ?? null,
		project_id: readOptionalBodyField(body, "project_id", expectNullableInteger) ?? null,
		description: normalizeDescription(
			readOptionalBodyField(body, "description", expectNullableString) ?? null,
		),
		started_at: startedAt,
		ended_at: null,
		created_at: utcNow(),
		updated_at: utcNow(),
	};
};

const parseStopValues = (body: JsonObject) => {
	assertKnownFields(body, STOP_FIELDS);
	return readOptionalBodyField(body, "ended_at", expectString) === undefined
		? utcNow()
		: requireBodyField(body, "ended_at", expectTimestamp);
};

const stopOtherRunningEntries = async (
	db: Database,
	stopAt: string,
	userId: number | null,
	excludeId?: number,
) => {
	const unassignedRunning = await db.client.timeEntry.findFirst({
		where: {
			ended_at: null,
			user_id: userId,
			project_id: null,
			...(excludeId === undefined ? {} : { id: { not: excludeId } }),
		},
	});
	if (unassignedRunning) {
		throw new HttpError(400, "Project is required before stopping timer");
	}

	const laterRunning = await db.client.timeEntry.findFirst({
		where: {
			ended_at: null,
			user_id: userId,
			...(excludeId === undefined ? {} : { id: { not: excludeId } }),
			started_at: { gt: stopAt },
		},
	});
	if (laterRunning) {
		throw new HttpError(
			400,
			"Cannot start a timer before an existing running entry",
		);
	}

	await db.client.timeEntry.updateMany({
		where: {
			ended_at: null,
			user_id: userId,
			...(excludeId === undefined ? {} : { id: { not: excludeId } }),
		},
		data: {
			ended_at: stopAt,
			updated_at: utcNow(),
		},
	});
};

const createEntry = async (db: Database, values: ReturnType<typeof parseCreateValues>) => {
	if (values.ended_at === null) {
		await stopOtherRunningEntries(db, values.started_at, values.user_id);
	}
	return db.client.timeEntry.create({ data: values, include: ENTRY_INCLUDE });
};

const updateEntry = async (
	db: Database,
	id: number,
	values: Record<string, unknown>,
	existingRow: Awaited<ReturnType<typeof fetchTimeEntry>>,
) => {
	const startedAt = typeof values.started_at === "string"
		? values.started_at
		: existingRow?.started_at;
	const nextEndedAt = values.ended_at === undefined
		? (existingRow?.ended_at ?? null)
		: (values.ended_at as string | null);
	const nextUserId = values.user_id === undefined
		? (existingRow?.user_id ?? null)
		: (values.user_id as number | null);
	if (nextEndedAt === null && startedAt) {
		await stopOtherRunningEntries(db, startedAt, nextUserId, id);
	}
	return db.client.timeEntry.update({
		where: { id },
		data: values,
		include: ENTRY_INCLUDE,
	});
};

export const timeEntriesCollectionRoute = async (req: Request) => {
	if (req.method === "GET") {
		const url = new URL(req.url);
		return json(
			200,
			await db.client.timeEntry.findMany({
				where: parseFilters(url),
				orderBy: parseSort(url),
				include: ENTRY_INCLUDE,
			}),
		);
	}
	if (req.method === "POST") {
		return json(201, await createEntry(db, parseCreateValues(await readJsonObject(req))));
	}
	throw new HttpError(405, "Method not allowed for this route");
};

export const timeEntryDetailRoute = async (req: BunRequest<string>) => {
	const id = parseIdParam(req.params.id ?? "");
	const existingRow = await fetchTimeEntry(db, id);
	if (!existingRow) throw new HttpError(404, "Resource not found");

	if (req.method === "GET") return json(200, existingRow);
	if (req.method === "PUT") {
		return json(
			200,
			await updateEntry(
				db,
				id,
				parseReplaceValues(await readJsonObject(req), existingRow),
				existingRow,
			),
		);
	}
	if (req.method === "PATCH") {
		return json(
			200,
			await updateEntry(
				db,
				id,
				parsePatchValues(await readJsonObject(req), existingRow),
				existingRow,
			),
		);
	}
	if (req.method === "DELETE") {
		await db.client.timeEntry.delete({ where: { id } });
		return empty(204);
	}
	throw new HttpError(405, "Method not allowed for this route");
};

export const timeEntryStartRoute = async (req: Request) => {
	if (req.method !== "POST") {
		throw new HttpError(405, "Method not allowed for this route");
	}

	const values = parseStartValues(await readJsonObject(req));
	return json(201, await createEntry(db, values));
};

export const timeEntryStopRoute = async (req: BunRequest<string>) => {
	if (req.method !== "POST") {
		throw new HttpError(405, "Method not allowed for this route");
	}

	const id = parseIdParam(req.params.id ?? "");
	const existingRow = await fetchTimeEntry(db, id);
	if (!existingRow) throw new HttpError(404, "Resource not found");
	if (existingRow.ended_at !== null) {
		throw new HttpError(400, "Time entry is already stopped");
	}

	const endedAt = parseStopValues(await readJsonObject(req));
	assertProjectBeforeStop(existingRow.project_id);
	assertChronologicalRange(existingRow.started_at, endedAt);
	return json(
		200,
		await db.client.timeEntry.update({
			where: { id },
			data: {
				ended_at: endedAt,
				updated_at: utcNow(),
			},
			include: ENTRY_INCLUDE,
		}),
	);
};
