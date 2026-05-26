import type { BunRequest } from "bun";

import {
	assertKnownFields,
	empty,
	expectInteger,
	expectNullableString,
	expectNullableTimestamp,
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

export enum TodoStatus {
	Open = 1,
	Done = 2,
	Archived = 3,
}

const TODO_STATUSES = new Set<number>([
	TodoStatus.Open,
	TodoStatus.Done,
	TodoStatus.Archived,
]);

const DEFAULT_SORT = [{ created_at: "desc" }, { id: "desc" }] as const;
const SORT_FIELDS = new Set([
	"id",
	"title",
	"status",
	"due_at",
	"completed_at",
	"created_at",
	"updated_at",
]);
const WRITABLE_FIELDS = [
	"title",
	"notes",
	"status",
	"due_at",
	"completed_at",
];

const expectTodoStatus = (value: unknown, field: string) => {
	const status = expectInteger(value, field);
	if (!TODO_STATUSES.has(status)) {
		throw new HttpError(
			400,
			`Field \`${field}\` must be a valid todo status`,
		);
	}
	return status;
};

const fetchTodo = (db: Database, id: number) =>
	db.client.todo.findUnique({ where: { id } });

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
			case "status":
				where[key] = parseIntegerQuery(key, value);
				break;
			case "title":
				where.title = { contains: value };
				break;
			case "notes":
			case "due_at":
			case "completed_at":
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
	const status = readOptionalBodyField(body, "status", expectTodoStatus) ?? TodoStatus.Open;
	return {
		title: requireBodyField(body, "title", expectString).trim(),
		notes: readOptionalBodyField(body, "notes", expectNullableString) ?? null,
		status,
		due_at: readOptionalBodyField(body, "due_at", expectNullableTimestamp) ?? null,
		completed_at:
			readOptionalBodyField(body, "completed_at", expectNullableTimestamp) ??
			(status === TodoStatus.Done ? now : null),
		created_at: now,
		updated_at: now,
	};
};

const parseReplaceValues = (
	body: JsonObject,
	existingRow: Awaited<ReturnType<typeof fetchTodo>>,
) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	const now = utcNow();
	const status = requireBodyField(body, "status", expectTodoStatus);
	return {
		title: requireBodyField(body, "title", expectString).trim(),
		notes: readOptionalBodyField(body, "notes", expectNullableString) ?? null,
		status,
		due_at: readOptionalBodyField(body, "due_at", expectNullableTimestamp) ?? null,
		completed_at:
			readOptionalBodyField(body, "completed_at", expectNullableTimestamp) ??
			(status === TodoStatus.Done ? now : null),
		created_at: existingRow?.created_at ?? now,
		updated_at: now,
	};
};

const parsePatchValues = (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	const values: Record<string, unknown> = {};
	const title = readOptionalBodyField(body, "title", expectString);
	const notes = readOptionalBodyField(body, "notes", expectNullableString);
	const status = readOptionalBodyField(body, "status", expectTodoStatus);
	const dueAt = readOptionalBodyField(body, "due_at", expectNullableTimestamp);
	const completedAt = readOptionalBodyField(
		body,
		"completed_at",
		expectNullableTimestamp,
	);

	if (title !== undefined) values.title = title.trim();
	if (notes !== undefined) values.notes = notes;
	if (status !== undefined) values.status = status;
	if (dueAt !== undefined) values.due_at = dueAt;
	if (completedAt !== undefined) values.completed_at = completedAt;

	if (Object.keys(values).length === 0) {
		throw new HttpError(400, "PATCH request must contain at least one writable field");
	}

	values.updated_at = utcNow();
	return values;
};

const ensureTodoTitle = (title: string) => {
	if (!title) {
		throw new HttpError(400, "Field `title` cannot be empty");
	}
};

export const todosCollectionRoute = (db: Database) =>
	withErrorHandling(async (req: Request) => {
		if (req.method === "GET") {
			const url = new URL(req.url);
			return json(
				200,
				await db.client.todo.findMany({
					where: parseFilters(url),
					orderBy: parseSort(url),
				}),
			);
		}
		if (req.method === "POST") {
			const values = parseCreateValues(await readJsonObject(req));
			ensureTodoTitle(values.title);
			const created = await db.client.todo.create({ data: values });
			return json(201, created);
		}
		throw new HttpError(405, "Method not allowed for this route");
	});

export const todoDetailRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		const id = parseIdParam(req.params.id);
		const existingRow = await fetchTodo(db, id);
		if (!existingRow) throw new HttpError(404, "Resource not found");

		if (req.method === "GET") {
			return json(200, existingRow);
		}
		if (req.method === "PUT") {
			const values = parseReplaceValues(await readJsonObject(req), existingRow);
			ensureTodoTitle(values.title);
			return json(
				200,
				await db.client.todo.update({
					where: { id },
					data: values,
				}),
			);
		}
		if (req.method === "PATCH") {
			const values = parsePatchValues(await readJsonObject(req));
			if (typeof values.title === "string") ensureTodoTitle(values.title);
			return json(
				200,
				await db.client.todo.update({
					where: { id },
					data: values,
				}),
			);
		}
		if (req.method === "DELETE") {
			await db.client.todo.delete({ where: { id } });
			return empty(204);
		}
		throw new HttpError(405, "Method not allowed for this route");
	});
