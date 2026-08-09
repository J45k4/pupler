import type { BunRequest } from "bun"

import { db } from "../db"
import {
	assertKnownFields,
	empty,
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
	type Database,
	type JsonObject,
} from "./core"

const DEFAULT_CLIENT_COLORS = [
	"#ba5a31",
	"#2d7c6f",
	"#6f5aa8",
	"#b7791f",
	"#3f6f9f",
]

const DEFAULT_SORT = [
	{ archived_at: "asc" as const },
	{ name: "asc" as const },
	{ id: "asc" as const },
]
const SORT_FIELDS = new Set([
	"id",
	"name",
	"color",
	"archived_at",
	"created_at",
	"updated_at",
])
const WRITABLE_FIELDS = ["name", "color", "archived_at"]

const fetchClient = (db: Database, id: number) =>
	db.client.client.findUnique({ where: { id } })

const parseClientName = (body: JsonObject, field = "name") => {
	const name = requireBodyField(body, field, expectString).trim()
	if (!name) {
		throw new HttpError(400, `Field \`${field}\` cannot be empty`)
	}
	return name
}

const parseOptionalClientName = (body: JsonObject, field = "name") => {
	const rawName = readOptionalBodyField(body, field, expectString)
	if (rawName === undefined) return undefined
	const name = rawName.trim()
	if (!name) {
		throw new HttpError(400, `Field \`${field}\` cannot be empty`)
	}
	return name
}

const parseClientColor = (value: string) => {
	const color = value.trim()
	if (!color) {
		throw new HttpError(400, "Field `color` cannot be empty")
	}
	return color
}

const parseOptionalClientColor = (body: JsonObject, field = "color") => {
	const rawColor = readOptionalBodyField(body, field, expectString)
	if (rawColor === undefined) return undefined
	return parseClientColor(rawColor)
}

const defaultClientColor = (name: string) => {
	const total = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0)
	return DEFAULT_CLIENT_COLORS[total % DEFAULT_CLIENT_COLORS.length]!
}

const parseSort = (url: URL) => {
	const sort = url.searchParams.get("sort")
	if (!sort) return DEFAULT_SORT
	if (!SORT_FIELDS.has(sort)) {
		throw new HttpError(400, `Unknown sort field \`${sort}\``)
	}
	return [{ [sort]: parseSortOrder(url) }]
}

const parseFilters = (url: URL) => {
	const where: Record<string, unknown> = {}
	for (const [key, value] of url.searchParams.entries()) {
		if (key === "sort" || key === "order") continue
		switch (key) {
			case "id":
				where.id = parseIntegerQuery(key, value)
				break
			case "name":
				where.name = { contains: value }
				break
			case "archived_at":
				where.archived_at = value === "null" ? null : value
				break
			case "color":
			case "created_at":
			case "updated_at":
				where[key] = value
				break
			default:
				throw new HttpError(400, `Unknown query parameter \`${key}\``)
		}
	}
	return where
}

const parseCreateValues = (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS)
	const now = utcNow()
	const name = parseClientName(body)
	const color = parseOptionalClientColor(body) ?? defaultClientColor(name)
	return {
		name,
		color,
		archived_at:
			readOptionalBodyField(
				body,
				"archived_at",
				expectNullableTimestamp,
			) ?? null,
		created_at: now,
		updated_at: now,
	}
}

const parseReplaceValues = (
	body: JsonObject,
	existingRow: Awaited<ReturnType<typeof fetchClient>>,
) => {
	assertKnownFields(body, WRITABLE_FIELDS)
	const name = parseClientName(body)
	const color = parseOptionalClientColor(body) ?? defaultClientColor(name)
	return {
		name,
		color,
		archived_at:
			readOptionalBodyField(
				body,
				"archived_at",
				expectNullableTimestamp,
			) ?? null,
		created_at: existingRow?.created_at ?? utcNow(),
		updated_at: utcNow(),
	}
}

const parsePatchValues = (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS)
	const values: Record<string, unknown> = {}
	const name = parseOptionalClientName(body)
	const color = parseOptionalClientColor(body)
	const archivedAt = readOptionalBodyField(
		body,
		"archived_at",
		expectNullableTimestamp,
	)

	if (name !== undefined) values.name = name
	if (color !== undefined) values.color = color
	if (archivedAt !== undefined) values.archived_at = archivedAt

	if (Object.keys(values).length === 0) {
		throw new HttpError(
			400,
			"PATCH request must contain at least one writable field",
		)
	}

	values.updated_at = utcNow()
	return values
}

export const clientsCollectionRoute = async (req: Request) => {
	if (req.method === "GET") {
		const url = new URL(req.url)
		return json(
			200,
			await db.client.client.findMany({
				where: parseFilters(url),
				orderBy: parseSort(url),
			}),
		)
	}
	if (req.method === "POST") {
		return json(
			201,
			await db.client.client.create({
				data: parseCreateValues(await readJsonObject(req)),
			}),
		)
	}
	throw new HttpError(405, "Method not allowed for this route")
}

export const clientDetailRoute = async (req: BunRequest<string>) => {
	const id = parseIdParam(req.params.id ?? "")
	const existingRow = await fetchClient(db, id)
	if (!existingRow) throw new HttpError(404, "Resource not found")

	if (req.method === "GET") return json(200, existingRow)
	if (req.method === "PUT") {
		return json(
			200,
			await db.client.client.update({
				where: { id },
				data: parseReplaceValues(
					await readJsonObject(req),
					existingRow,
				),
			}),
		)
	}
	if (req.method === "PATCH") {
		return json(
			200,
			await db.client.client.update({
				where: { id },
				data: parsePatchValues(await readJsonObject(req)),
			}),
		)
	}
	if (req.method === "DELETE") {
		await db.client.client.delete({ where: { id } })
		return empty(204)
	}
	throw new HttpError(405, "Method not allowed for this route")
}
