import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import type { ImageContent } from "@modelcontextprotocol/sdk/types.js"
import type { BunRequest } from "bun"
import { z } from "zod"
import { db } from "../db"
import { HttpError } from "../api/core"
import { receiptDetailRoute, receiptPictureRoute } from "../api/purchase-receipts"
import { receiptItemDetailRoute } from "../api/receipt-items"
import { receiptDetailSelect } from "../api/reference-details"
import { authenticateMcp, challenge, oauthOrigin, readLimited, requireScope, trustedOrigin, type McpIdentity, type Scope } from "../oauth/core"
import { amount, appendLines, createReceipt, createReceiptSchema, idSchema, lineSchema, receiptFields, receiptResult } from "./receipts"
import { imageTypes, prepareUpload, replaceImage, uploadedImage } from "./uploads"

const toolsScopes = new Map<string, Scope>()
const requestFor = (id: number, method: string, body?: unknown) => Object.assign(new Request(`http://pupler.internal/resource/${id}`, { method, ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) }), { params: { id: String(id) } }) as unknown as BunRequest<string>
const bodyOf = async (response: Response) => response.status === 204 ? { success: true } : response.json()
const page = { limit: z.number().int().min(1).max(100).default(30), before_id: idSchema.optional() }

const createServer = (identity: McpIdentity, origin: string) => {
	const server = new McpServer({ name: "pupler", version: "1.0.0" }, { instructions: "Manage Pupler receipts and their product-linked lines. Search products before matching; ask about ambiguous products or unreadable receipt amounts. Upload original image bytes using prepare_receipt_image_upload, then create_receipt with all lines and image_id. Reuse the same idempotency_key when retrying an import. Receipts and products are shared across this Pupler instance." })
	const register = <S extends z.ZodType>(name: string, description: string, scope: Scope, schema: S, handler: (args: z.output<S>) => Promise<unknown>, image = false, destructive = false) => {
		toolsScopes.set(name, scope)
		server.registerTool(name, { description, inputSchema: schema as z.ZodType, annotations: { readOnlyHint: /^(get_|list_|search_)/.test(name), destructiveHint: destructive, openWorldHint: false }, _meta: { securitySchemes: [{ type: "oauth2", scopes: [scope] }] } }, async args => {
			try {
				requireScope(identity, scope)
				const result = await handler(args as z.output<S>)
				if (image) return { content: [result as ImageContent] }
				const object = result as Record<string, unknown>
				return { content: [{ type: "text" as const, text: JSON.stringify(object) }], structuredContent: object }
			} catch (error) {
				const message = error instanceof HttpError ? error.message : error instanceof Error && "code" in error && error.code === "P2002" ? "A product with this barcode already exists. Search products and use its product_id." : "The operation failed. Check the input and retry with the same idempotency key."
				return { isError: true, content: [{ type: "text" as const, text: message }] }
			}
		})
	}
	register("get_account", "Show the connected Pupler account and granted permissions.", "receipts:read", z.object({}), async () => ({ user: identity.user, scopes: identity.scope.split(" "), shared_receipts: true }))
	register("list_receipts", "Find receipts by store, purchase date, or group. Returns a bounded page; use next_before_id for the next page.", "receipts:read", z.object({ ...page, store_name: z.string().max(300).optional(), group_id: idSchema.nullable().optional(), from: z.iso.datetime({ offset: true }).optional(), to: z.iso.datetime({ offset: true }).optional() }).strict(), async input => {
		const rows = await db.client.receipt.findMany({ where: { ...(input.before_id ? { id: { lt: input.before_id } } : {}), ...(input.store_name ? { store_name: { contains: input.store_name } } : {}), ...(input.group_id !== undefined ? { group_id: input.group_id } : {}), ...((input.from || input.to) ? { purchased_at: { gte: input.from, lte: input.to } } : {}) }, orderBy: { id: "desc" }, take: input.limit + 1, select: receiptDetailSelect })
		return { receipts: rows.slice(0, input.limit), next_before_id: rows.length > input.limit ? rows[input.limit - 1]!.id : null }
	})
	register("get_receipt", "Get a receipt, all product-linked lines, image metadata, printed total and total discrepancy.", "receipts:read", z.object({ receipt_id: idSchema }).strict(), async ({ receipt_id }) => receiptResult(db.client, receipt_id, origin))
	register("search_products", "Search existing products by name or exact barcode before assigning receipt lines. Resolve ambiguous matches with the user.", "products:read", z.object({ ...page, query: z.string().max(300).default(""), barcode: z.string().max(300).optional() }).strict(), async input => {
		const products = await db.client.product.findMany({ where: { name: { contains: input.query }, ...(input.barcode ? { barcode: input.barcode } : {}), ...(input.before_id ? { id: { lt: input.before_id } } : {}) }, orderBy: { id: "desc" }, take: input.limit + 1, select: { id: true, name: true, barcode: true, category: true, default_unit: true, is_perishable: true } })
		return { products: products.slice(0, input.limit), next_before_id: products.length > input.limit ? products[input.limit - 1]!.id : null }
	})
	register("list_receipt_groups", "Find an existing group to organize a receipt.", "products:read", z.object({ ...page, query: z.string().max(300).default("") }).strict(), async input => {
		const groups = await db.client.group.findMany({ where: { name: { contains: input.query }, ...(input.before_id ? { id: { lt: input.before_id } } : {}) }, orderBy: { id: "desc" }, take: input.limit + 1, select: { id: true, name: true } })
		return { groups: groups.slice(0, input.limit), next_before_id: groups.length > input.limit ? groups[input.limit - 1]!.id : null }
	})
	register("create_receipt", "Atomically create a receipt with all lines and an optional uploaded image_id. Each line requires product_id OR new_product (requires products:write). Preserve the printed total and resolve unreadable values. Reuse idempotency_key for retries.", "receipts:write", createReceiptSchema, async input => createReceipt(identity, input, origin))
	register("update_receipt", "Edit receipt header fields, keeping its existing lines and image.", "receipts:write", z.object({ receipt_id: idSchema, changes: z.object(receiptFields).partial().strict().refine(value => Object.keys(value).length > 0, "Provide changes") }).strict(), async ({ receipt_id, changes }) => {
		await receiptDetailRoute(requestFor(receipt_id, "PATCH", changes))
		return receiptResult(db.client, receipt_id, origin)
	})
	register("add_receipt_lines", "Append lines atomically. Reuse idempotency_key on retry. New products require products:write.", "receipts:write", z.object({ receipt_id: idSchema, lines: z.array(lineSchema).min(1).max(300), idempotency_key: z.string().min(1).max(100) }).strict(), async input => appendLines(identity, input, origin))
	register("update_receipt_line", "Edit one receipt line by ID. Prices may be null if unknown; negative prices can represent discounts.", "receipts:write", z.object({ line_id: idSchema, changes: z.object({ product_id: idSchema, quantity: z.number().positive().max(1_000_000), unit: z.string().trim().min(1).max(300), unit_price: amount.nullable(), line_total: amount.nullable() }).partial().strict().refine(value => Object.keys(value).length > 0, "Provide changes") }).strict(), async ({ line_id, changes }) => bodyOf(await receiptItemDetailRoute(requestFor(line_id, "PATCH", changes))))
	register("delete_receipt_line", "Delete a receipt line and unlink inventory references to it. Inventory items are preserved.", "receipts:write", z.object({ line_id: idSchema }).strict(), async ({ line_id }) => bodyOf(await receiptItemDetailRoute(requestFor(line_id, "DELETE"))), false, true)
	register("delete_receipt", "Delete a receipt, its lines and image, unlinking inventory references. Inventory items are preserved.", "receipts:write", z.object({ receipt_id: idSchema }).strict(), async ({ receipt_id }) => bodyOf(await receiptDetailRoute(requestFor(receipt_id, "DELETE"))), false, true)
	register("prepare_receipt_image_upload", "Prepare a single-use URL for uploading original image bytes (maximum 10 MB). Use PUT from the environment that holds the file. The returned image_id can be attached to a new or existing receipt within 15 minutes.", "receipts:write", z.object({ filename: z.string().min(1).max(255), content_type: z.enum(imageTypes) }).strict(), async ({ filename, content_type }) => prepareUpload(identity, origin, filename, content_type))
	register("get_uploaded_receipt_image", "View an uploaded image before extracting its store, date, amounts and product lines. Only images uploaded through this connection are accessible.", "receipts:write", z.object({ image_id: z.string().max(100) }).strict(), async ({ image_id }) => uploadedImage(identity, image_id), true)
	register("get_receipt_image", "View the original image attached to a saved receipt.", "receipts:read", z.object({ receipt_id: idSchema }).strict(), async ({ receipt_id }) => {
		const response = await receiptPictureRoute(requestFor(receipt_id, "GET"))
		return { type: "image", data: Buffer.from(await response.arrayBuffer()).toString("base64"), mimeType: response.headers.get("content-type")! }
	}, true)
	register("replace_receipt_image", "Attach an uploaded image_id to a receipt, replacing any previous image.", "receipts:write", z.object({ receipt_id: idSchema, image_id: z.string().max(100) }).strict(), async ({ receipt_id, image_id }) => replaceImage(identity, receipt_id, image_id), false, true)
	register("remove_receipt_image", "Remove the saved receipt image while keeping its header and lines.", "receipts:write", z.object({ receipt_id: idSchema }).strict(), async ({ receipt_id }) => bodyOf(await receiptPictureRoute(requestFor(receipt_id, "DELETE"))), false, true)
	return server
}

export const mcpRoute = async (req: Request) => {
	let server: McpServer | undefined
	try {
		const origin = oauthOrigin(req)
		trustedOrigin(req)
		const identity = await authenticateMcp(req)
		if (req.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } })
		const body = JSON.parse((await readLimited(req, 1024 * 1024)).toString())
		server = createServer(identity, origin)
		if (body?.method === "tools/call") {
			const scope = toolsScopes.get(body.params?.name)
			if (scope && !identity.scope.split(" ").includes(scope)) return Response.json({ error: "insufficient_scope", scope }, { status: 403, headers: { "WWW-Authenticate": `Bearer error="insufficient_scope", resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp", scope="${scope}"`, "Cache-Control": "no-store" } })
		}
		const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
		await server.connect(transport)
		const response = await transport.handleRequest(req, { parsedBody: body })
		response.headers.set("Cache-Control", "no-store")
		return response
	} catch (error) {
		if (error instanceof HttpError && error.status === 401) return challenge(req)
		return Response.json({ error: error instanceof HttpError ? error.message : "Invalid MCP request" }, { status: error instanceof HttpError ? error.status : error instanceof SyntaxError ? 400 : 500, headers: { "Cache-Control": "no-store" } })
	} finally {
		await server?.close()
	}
}
