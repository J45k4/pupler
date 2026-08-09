import type { BunRequest } from "bun"

import { db } from "../db"
import {
	assertKnownFields,
	empty,
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

const DEFAULT_SORT = [{ name: "asc" as const }, { id: "asc" as const }]
const SORT_FIELDS = new Set(["id", "name", "created_at", "updated_at"])
const WRITABLE_FIELDS = ["name"]

export const normalizeGroupName = (name: string) => name.trim().toLowerCase()

const parseGroupName = (body: JsonObject, field = "name") => {
	const name = requireBodyField(body, field, expectString).trim()
	if (!name) {
		throw new HttpError(400, `Field \`${field}\` cannot be empty`)
	}
	return name
}

const parseOptionalGroupName = (body: JsonObject, field = "name") => {
	const rawName = readOptionalBodyField(body, field, expectString)
	if (rawName === undefined) {
		return undefined
	}
	const name = rawName.trim()
	if (!name) {
		throw new HttpError(400, `Field \`${field}\` cannot be empty`)
	}
	return name
}

const fetchGroup = (db: Database, id: number) =>
	db.client.group.findUnique({ where: { id } })

const groupNameMatches = (group: { name: string }, normalizedName: string) =>
	normalizeGroupName(group.name) === normalizedName

const findGroupByNormalizedName = async (
	db: Database,
	name: string,
	excludeId?: number,
) => {
	const normalizedName = normalizeGroupName(name)
	const groups = await db.client.group.findMany({
		select: { id: true, name: true },
	})
	return (
		groups.find(
			(group) =>
				group.id !== excludeId &&
				groupNameMatches(group, normalizedName),
		) ?? null
	)
}

const ensureUniqueGroupName = async (
	db: Database,
	name: string,
	excludeId?: number,
) => {
	if (await findGroupByNormalizedName(db, name, excludeId)) {
		throw new HttpError(409, "Group name already exists")
	}
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
	const filters: {
		normalizedName?: string
		where: Record<string, unknown>
	} = { where: {} }

	for (const [key, value] of url.searchParams.entries()) {
		if (key === "sort" || key === "order") continue

		switch (key) {
			case "id":
				filters.where.id = parseIntegerQuery(key, value)
				break
			case "name":
				if (value === "null") {
					throw new HttpError(
						400,
						"Query parameter `name` cannot be null",
					)
				}
				filters.normalizedName = normalizeGroupName(value)
				break
			case "created_at":
			case "updated_at":
				filters.where[key] = value
				break
			default:
				throw new HttpError(400, `Unknown query parameter \`${key}\``)
		}
	}

	return filters
}

const parseCreateValues = (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS)
	const name = parseGroupName(body)
	const now = utcNow()
	return {
		name,
		created_at: now,
		updated_at: now,
	}
}

const parseReplaceValues = (
	body: JsonObject,
	existingRow: Awaited<ReturnType<typeof fetchGroup>>,
) => {
	assertKnownFields(body, WRITABLE_FIELDS)
	const name = parseGroupName(body)
	return {
		name,
		created_at: existingRow?.created_at ?? utcNow(),
		updated_at: utcNow(),
	}
}

const parsePatchValues = (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS)
	const values: Record<string, unknown> = {}

	const name = parseOptionalGroupName(body)
	if (name !== undefined) {
		values.name = name
	}

	if (Object.keys(values).length === 0) {
		throw new HttpError(
			400,
			"PATCH request must contain at least one writable field",
		)
	}

	values.updated_at = utcNow()
	return values
}

export const groupsCollectionRoute = async (req: Request) => {
	if (req.method === "GET") {
		const url = new URL(req.url)
		const filters = parseFilters(url)
		const groups = await db.client.group.findMany({
			where: filters.where,
			orderBy: parseSort(url),
		})
		if (filters.normalizedName === undefined) {
			return json(200, groups)
		}

		const normalizedName = filters.normalizedName
		return json(
			200,
			groups.filter((group) => groupNameMatches(group, normalizedName)),
		)
	}

	if (req.method === "POST") {
		const values = parseCreateValues(await readJsonObject(req))
		await ensureUniqueGroupName(db, values.name)
		return json(
			201,
			await db.client.group.create({
				data: values,
			}),
		)
	}

	throw new HttpError(405, "Method not allowed for this route")
}

export const groupDetailRoute = async (req: BunRequest<string>) => {
	const id = parseIdParam(req.params.id ?? "")
	const existingRow = await fetchGroup(db, id)
	if (!existingRow) {
		throw new HttpError(404, "Resource not found")
	}

	if (req.method === "GET") return json(200, existingRow)
	if (req.method === "PUT") {
		const values = parseReplaceValues(
			await readJsonObject(req),
			existingRow,
		)
		await ensureUniqueGroupName(db, values.name, id)
		return json(
			200,
			await db.client.group.update({
				where: { id },
				data: values,
			}),
		)
	}
	if (req.method === "PATCH") {
		const values = parsePatchValues(await readJsonObject(req))
		if (typeof values.name === "string") {
			await ensureUniqueGroupName(db, values.name, id)
		}
		return json(
			200,
			await db.client.group.update({
				where: { id },
				data: values,
			}),
		)
	}
	if (req.method === "DELETE") {
		await db.client.$transaction([
			db.client.receipt.updateMany({
				where: { group_id: id },
				data: {
					group_id: null,
					updated_at: utcNow(),
				},
			}),
			db.client.group.delete({ where: { id } }),
		])
		return empty(204)
	}

	throw new HttpError(405, "Method not allowed for this route")
}
