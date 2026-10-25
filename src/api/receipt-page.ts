import { db } from "../db"
import { HttpError, json, parseTimestampQuery } from "./core"
import { receiptDetailSelect } from "./reference-details"

type ReceiptCursor = { at: number; id: number }
const FILTER_FIELDS = ["view", "group_id", "before", "q"]
const PAGE_FIELDS = new Set([...FILTER_FIELDS, "cursor", "limit"])
const TOTAL_FIELDS = new Set(FILTER_FIELDS)

const positiveInteger = (value: string, field: string, maximum = Number.MAX_SAFE_INTEGER) => {
	const number = /^[1-9]\d*$/.test(value) ? Number(value) : NaN
	if (!Number.isSafeInteger(number) || number > maximum) throw new HttpError(400, `Query parameter \`${field}\` must be an integer between 1 and ${maximum}`)
	return number
}

const parseCursor = (value: string): ReceiptCursor => {
	try {
		if (value.length > 256 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error()
		const cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8"))
		if (!cursor || Object.keys(cursor).length !== 2 || !Number.isFinite(cursor.at) || !Number.isSafeInteger(cursor.id) || cursor.id <= 0) throw new Error()
		return { at: cursor.at, id: cursor.id }
	} catch {
		throw new HttpError(400, "Invalid receipt cursor")
	}
}

const receiptFilters = (req: Request, fields: Set<string>) => {
	if (req.method !== "GET") throw new HttpError(405, "Method not allowed for this route")
	const url = new URL(req.url)
	for (const key of url.searchParams.keys()) if (!fields.has(key)) throw new HttpError(400, `Unknown query parameter \`${key}\``)
	const group = url.searchParams.get("group_id")
	const before = url.searchParams.get("before")
	const search = (url.searchParams.get("q") ?? "").trim().toLowerCase()
	if (search.length > 200) throw new HttpError(400, "Receipt search must be at most 200 characters")
	const conditions = ["julianday(purchased_at) IS NOT NULL"]
	const values: Array<string | number | null> = []
	if (group !== null) {
		conditions.push("group_id IS ?")
		values.push(group === "null" ? null : positiveInteger(group, "group_id"))
	}
	if (before !== null) {
		conditions.push("julianday(purchased_at) < julianday(?)")
		values.push(new Date(parseTimestampQuery("before", before)).toISOString())
	}
	if (search) {
		// SQLite lower() only folds ASCII, so also fold the Finnish letters.
		conditions.push("(instr(lower(replace(replace(replace(store_name, 'Ä', 'ä'), 'Ö', 'ö'), 'Å', 'å')), ?) > 0 OR CAST(id AS TEXT) = ?)")
		values.push(search, search.replace(/^#/, ""))
	}
	return { url, conditions, values }
}

export const receiptTotalsRoute = async (req: Request) => {
	const { conditions, values } = receiptFilters(req, TOTAL_FIELDS)
	const rows = await db.client.$queryRawUnsafe<Array<{ group_id: number | bigint | null; currency: string; total_amount: number | null; receipt_count: number | bigint; unknown_count: number | bigint }>>(`
		SELECT group_id, currency, SUM(total_amount) AS total_amount, COUNT(*) AS receipt_count,
			COUNT(*) - COUNT(total_amount) AS unknown_count
		FROM receipts WHERE ${conditions.join(" AND ")}
		GROUP BY group_id, currency ORDER BY group_id, currency
	`, ...values)
	return json(200, rows.map(row => ({ ...row, group_id: row.group_id === null ? null : Number(row.group_id), receipt_count: Number(row.receipt_count), unknown_count: Number(row.unknown_count) })))
}

export const receiptPageRoute = async (req: Request) => {
	const { url, conditions, values } = receiptFilters(req, PAGE_FIELDS)
	const limit = positiveInteger(url.searchParams.get("limit") ?? "40", "limit", 100)
	const rawCursor = url.searchParams.get("cursor")
	const cursor = rawCursor === null ? null : parseCursor(rawCursor)
	if (cursor) {
		conditions.push("(julianday(purchased_at), id) < (?, ?)")
		values.push(cursor.at, cursor.id)
	}
	// Only fixed SQL fragments are combined; all query values are bound parameters.
	const rows = await db.client.$queryRawUnsafe<Array<{ id: number | bigint; at: number }>>(`
		SELECT id, julianday(purchased_at) AS at FROM receipts
		WHERE ${conditions.join(" AND ")}
		ORDER BY julianday(purchased_at) DESC, id DESC LIMIT ?
	`, ...values, limit + 1)
	const page = rows.slice(0, limit).map((row) => ({ at: Number(row.at), id: Number(row.id) }))
	const details = await db.client.receipt.findMany({ where: { id: { in: page.map((row) => row.id) } }, select: receiptDetailSelect })
	const byId = new Map(details.map((receipt) => [receipt.id, receipt]))
	const last = page.at(-1)
	return json(200, {
		receipts: page.flatMap((row) => byId.has(row.id) ? [byId.get(row.id)!] : []),
		next_cursor: rows.length > limit && last ? Buffer.from(JSON.stringify(last)).toString("base64url") : null,
	})
}
