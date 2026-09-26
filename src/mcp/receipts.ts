import { z } from "zod"
import { db } from "../db"
import { HttpError } from "../api/core"
import { receiptDetailSelect } from "../api/reference-details"
import { hash, requireScope, transaction, type McpIdentity } from "../oauth/core"
import { claimImage } from "./uploads"
import type { Prisma } from "../generated/prisma/client"

export const idSchema = z.number().int().positive()
const text = z.string().trim().min(1).max(300)
export const amount = z.number().finite().min(-1_000_000_000).max(1_000_000_000)
export const productSchema = z.object({ name: text, category: text, barcode: text.nullable().optional(), default_unit: text.nullable().optional(), is_perishable: z.boolean() }).strict()
export const lineSchema = z.object({ product_id: idSchema.optional(), new_product: productSchema.optional(), quantity: z.number().finite().positive().max(1_000_000), unit: text, unit_price: amount.nullable().optional(), line_total: amount.nullable().optional() }).strict().refine(line => Boolean(line.product_id) !== Boolean(line.new_product), "Provide either product_id or new_product")
export const receiptFields = { store_name: text, purchased_at: z.iso.datetime({ offset: true }), currency: z.string().regex(/^[A-Z]{3}$/), total_amount: amount.nullable().optional(), group_id: idSchema.nullable().optional() }
export const createReceiptSchema = z.object({ ...receiptFields, lines: z.array(lineSchema).min(1).max(300), image_id: z.string().max(100).optional(), idempotency_key: z.string().min(1).max(100) }).strict()

const moneyDigits = (currency: string) => {
	try { return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2 } catch { return 2 }
}
export const receiptTotals = (currency: string, total: number | null, lines: { quantity: number; unit_price: number | null; line_total: number | null }[]) => {
	const scale = 10 ** moneyDigits(currency)
	const round = (value: number) => Math.round((value + Math.sign(value) * Number.EPSILON) * scale)
	const values = lines.map(line => line.line_total ?? (line.unit_price === null ? null : line.quantity * line.unit_price))
	const complete = values.every(value => value !== null)
	const lineTotal = complete ? values.reduce<number>((sum, value) => sum + round(value!), 0) / scale : null
	const difference = total !== null && lineTotal !== null ? (round(total) - round(lineTotal)) / scale : null
	return { calculated_total: lineTotal, reported_total: total, difference, warnings: !complete ? ["Some lines have no price; the total cannot be checked."] : difference ? ["The printed total differs from the sum of the lines. Check discounts, taxes or unreadable amounts."] : [] }
}

export const receiptResult = async (tx: Prisma.TransactionClient, id: number, origin: string) => {
	const receipt = await tx.receipt.findUnique({ where: { id }, select: { ...receiptDetailSelect, receipt_items: { orderBy: { id: "asc" }, include: { product: { select: { id: true, name: true, category: true, barcode: true } } } } } })
	if (!receipt) throw new HttpError(404, "Receipt not found")
	return { ...receipt, url: `${origin}/receipts/${receipt.id}`, totals: receiptTotals(receipt.currency, receipt.total_amount, receipt.receipt_items) }
}

const addLines = async (tx: Prisma.TransactionClient, identity: McpIdentity, receiptId: number, lines: z.infer<typeof lineSchema>[]) => {
	for (const line of lines) {
		let productId = line.product_id
		if (line.new_product) {
			requireScope(identity, "products:write")
			const now = new Date().toISOString()
			const product = await tx.product.create({ data: { ...line.new_product, created_at: now, updated_at: now } })
			productId = product.id
		} else if (!await tx.product.findUnique({ where: { id: productId } })) throw new HttpError(400, `Product ${productId} does not exist`)
		await tx.receiptItem.create({ data: { receipt_id: receiptId, product_id: productId!, quantity: line.quantity, unit: line.unit, unit_price: line.unit_price ?? null, line_total: line.line_total ?? null, created_at: new Date().toISOString() } })
	}
}

const canonical = (value: unknown): string => {
	if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
	if (value && typeof value === "object") return `{${Object.entries(value).filter(([, value]) => value !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${JSON.stringify(key)}:${canonical(value)}`).join(",")}}`
	return JSON.stringify(value)
}

const idempotent = async <T>(identity: McpIdentity, key: string, input: unknown, operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> => {
	const payloadHash = hash(canonical(input))
	const read = async (tx: Prisma.TransactionClient) => {
		const saved = await tx.mcpImport.findUnique({ where: { grant_id_key: { grant_id: identity.id, key } } })
		if (saved && saved.payload_hash !== payloadHash) throw new HttpError(409, "Idempotency key was already used with different input")
		if (!saved) return undefined
		return JSON.parse(saved.result_json) as T
	}
	try {
		return await transaction(async tx => {
			const previous = await read(tx)
			if (previous !== undefined) return previous
			const grant = await tx.oAuthGrant.findUnique({ where: { id: identity.id } })
			if (!grant || grant.revoked_at) throw new HttpError(401, "Connection was revoked")
			const result = await operation(tx)
			await tx.mcpImport.create({ data: { grant_id: identity.id, key, payload_hash: payloadHash, result_json: JSON.stringify(result) } })
			return result
		})
	} catch (error) {
		// A concurrent retry may have completed while this transaction waited for SQLite.
		const previous = await read(db.client)
		if (previous !== undefined) return previous
		throw error
	}
}

export const createReceipt = async (identity: McpIdentity, input: z.infer<typeof createReceiptSchema>, origin: string) => {
	requireScope(identity, "receipts:write")
	return idempotent(identity, input.idempotency_key, { operation: "create_receipt", ...input }, async tx => {
		const { lines, image_id, idempotency_key, ...fields } = input
		if (fields.group_id && !await tx.group.findUnique({ where: { id: fields.group_id } })) throw new HttpError(400, "Receipt group does not exist")
		const now = new Date().toISOString()
		const image = image_id ? await claimImage(tx, identity, image_id) : null
		const receipt = await tx.receipt.create({ data: { ...fields, picture_file_id: image?.id, created_at: now, updated_at: now } })
		await addLines(tx, identity, receipt.id, lines)
		return receiptResult(tx, receipt.id, origin)
	})
}

export const appendLines = async (identity: McpIdentity, input: { receipt_id: number; lines: z.infer<typeof lineSchema>[]; idempotency_key: string }, origin: string) => {
	requireScope(identity, "receipts:write")
	return idempotent(identity, input.idempotency_key, { operation: "add_receipt_lines", ...input }, async tx => {
		if (!await tx.receipt.findUnique({ where: { id: input.receipt_id } })) throw new HttpError(404, "Receipt not found")
		await addLines(tx, identity, input.receipt_id, input.lines)
		await tx.receipt.update({ where: { id: input.receipt_id }, data: { updated_at: new Date().toISOString() } })
		return receiptResult(tx, input.receipt_id, origin)
	})
}
