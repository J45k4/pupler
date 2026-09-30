import { z } from "zod"
import { HttpError, utcNow } from "../api/core"
import { inventoryContainerDetailRoute, inventoryContainersCollectionRoute } from "../api/inventory-containers"
import { inventoryItemDetailRoute, inventoryItemsCollectionRoute } from "../api/inventory-items"
import { inventoryItemDetailSelect } from "../api/reference-details"
import { db } from "../db"
import type { Scope } from "../oauth/core"
import { idSchema } from "./receipts"
import { bodyOf, requestFor } from "./requests"

type Register = <S extends z.ZodType>(name: string, description: string, scope: Scope | null, schema: S, handler: (args: z.output<S>) => Promise<unknown>, image?: boolean, destructive?: boolean) => void
const page = { limit: z.number().int().min(1).max(100).default(30), before_id: idSchema.optional() }
const timestamp = z.iso.datetime({ offset: true })
const itemFields = { name: z.string().trim().min(1).max(300), quantity: z.number().finite().positive().max(1_000_000), unit: z.string().trim().min(1).max(100), container_id: idSchema.nullable(), ingredient_id: idSchema.nullable(), product_id: idSchema.nullable(), receipt_item_id: idSchema.nullable(), purchased_at: timestamp.nullable(), expires_at: timestamp.nullable(), consumed_at: timestamp.nullable(), notes: z.string().max(2000).nullable() }
const containerFields = { name: z.string().trim().min(1).max(300), parent_container_id: idSchema.nullable(), notes: z.string().max(2000).nullable() }
const changes = <T extends z.ZodRawShape>(fields: T) => z.object(fields).partial().strict().refine(value => Object.keys(value).length > 0, "Provide changes")

const validateRefs = async (refs: { container_id?: number | null, parent_container_id?: number | null, receipt_item_id?: number | null }) => {
	for (const id of [refs.container_id, refs.parent_container_id]) if (id && !await db.client.inventoryContainer.findUnique({ where: { id } })) throw new HttpError(404, "Inventory container not found")
	if (refs.receipt_item_id && !await db.client.receiptItem.findUnique({ where: { id: refs.receipt_item_id } })) throw new HttpError(404, "Receipt line not found")
}
const collectionRequest = (body: unknown) => new Request("http://pupler.internal/resource", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
const itemDetail = (itemId: number) => db.client.inventoryItem.findUnique({ where: { id: itemId }, select: inventoryItemDetailSelect })

export const registerInventoryTools = (register: Register) => {
	register("list_inventory_items", "Find inventory items by name, container, product or ingredient. Unconsumed items are shown by default; use status to include consumed items. Use next_before_id for the next page.", "inventory:read", z.object({ ...page, query: z.string().max(300).default(""), status: z.enum(["available", "consumed", "all"]).default("available"), container_id: idSchema.nullable().optional(), product_id: idSchema.optional(), ingredient_id: idSchema.optional() }).strict(), async input => {
		const rows = await db.client.inventoryItem.findMany({ where: { name: { contains: input.query }, ...(input.before_id ? { id: { lt: input.before_id } } : {}), ...(input.status === "all" ? {} : { consumed_at: input.status === "available" ? null : { not: null } }), ...(input.container_id !== undefined ? { container_id: input.container_id } : {}), ...(input.product_id ? { product_id: input.product_id } : {}), ...(input.ingredient_id ? { ingredient_id: input.ingredient_id } : {}) }, orderBy: { id: "desc" }, take: input.limit + 1, select: inventoryItemDetailSelect })
		return { items: rows.slice(0, input.limit), next_before_id: rows.length > input.limit ? rows[input.limit - 1]!.id : null }
	})
	register("get_inventory_item", "Get one inventory item with its product, ingredient and image metadata.", "inventory:read", z.object({ item_id: idSchema }).strict(), async ({ item_id }) => bodyOf(await inventoryItemDetailRoute(requestFor(item_id, "GET"))))
	register("create_inventory_item", "Add an item to the inventory. Search products and containers first and link them when they match. Timestamps are ISO 8601 with an offset.", "inventory:write", z.object({ name: itemFields.name, quantity: itemFields.quantity.default(1), unit: itemFields.unit.default("pcs"), container_id: itemFields.container_id.optional(), ingredient_id: itemFields.ingredient_id.optional(), product_id: itemFields.product_id.optional(), receipt_item_id: itemFields.receipt_item_id.optional(), purchased_at: itemFields.purchased_at.optional(), expires_at: itemFields.expires_at.optional(), notes: itemFields.notes.optional() }).strict(), async input => {
		await validateRefs(input)
		return bodyOf(await inventoryItemsCollectionRoute(collectionRequest(input)))
	})
	register("update_inventory_item", "Edit an inventory item, for example to move it to another container, change its quantity or set its expiry date.", "inventory:write", z.object({ item_id: idSchema, changes: changes(itemFields) }).strict(), async ({ item_id, changes }) => {
		await validateRefs(changes)
		return bodyOf(await inventoryItemDetailRoute(requestFor(item_id, "PATCH", changes)))
	})
	register("consume_inventory_item", "Record that an inventory item was used. Without quantity, or when quantity covers the remaining amount, the item is marked consumed; otherwise its quantity is reduced.", "inventory:write", z.object({ item_id: idSchema, quantity: itemFields.quantity.optional() }).strict(), async ({ item_id, quantity }) => {
		const now = utcNow()
		const amount = quantity ?? null
		const updated = await db.client.$queryRaw<Array<{ id: number }>>`
			UPDATE inventory_items
			SET quantity = CASE WHEN ${amount} IS NOT NULL AND quantity > ${amount} THEN quantity - ${amount} ELSE quantity END,
				consumed_at = CASE WHEN ${amount} IS NULL OR quantity <= ${amount} THEN ${now} ELSE NULL END,
				updated_at = ${now}
			WHERE id = ${item_id} AND consumed_at IS NULL
			RETURNING id
		`
		if (updated.length === 0) {
			if (!await db.client.inventoryItem.findUnique({ where: { id: item_id } })) throw new HttpError(404, "Resource not found")
			throw new HttpError(409, "Inventory item is already consumed")
		}
		return itemDetail(item_id)
	})
	register("delete_inventory_item", "Permanently delete an inventory item and its images. Prefer consume_inventory_item for items that were used.", "inventory:write", z.object({ item_id: idSchema }).strict(), async ({ item_id }) => bodyOf(await inventoryItemDetailRoute(requestFor(item_id, "DELETE"))), false, true)
	register("list_inventory_containers", "Find inventory containers such as fridges, shelves or boxes. Filter by name or parent_container_id (null for top-level containers).", "inventory:read", z.object({ ...page, query: z.string().max(300).default(""), parent_container_id: idSchema.nullable().optional() }).strict(), async input => {
		const rows = await db.client.inventoryContainer.findMany({ where: { name: { contains: input.query }, ...(input.before_id ? { id: { lt: input.before_id } } : {}), ...(input.parent_container_id !== undefined ? { parent_container_id: input.parent_container_id } : {}) }, orderBy: { id: "desc" }, take: input.limit + 1, include: { _count: { select: { inventory_items: { where: { consumed_at: null } }, child_containers: true } } } })
		return { containers: rows.slice(0, input.limit).map(({ _count, ...container }) => ({ ...container, available_item_count: _count.inventory_items, child_container_count: _count.child_containers })), next_before_id: rows.length > input.limit ? rows[input.limit - 1]!.id : null }
	})
	register("get_inventory_container", "Get one inventory container and its direct child containers.", "inventory:read", z.object({ container_id: idSchema }).strict(), async ({ container_id }) => {
		const container = await db.client.inventoryContainer.findUnique({ where: { id: container_id }, include: { child_containers: { orderBy: { name: "asc" } } } })
		if (!container) throw new HttpError(404, "Inventory container not found")
		return container
	})
	register("create_inventory_container", "Create an inventory container, optionally inside a parent container.", "inventory:write", z.object({ name: containerFields.name, parent_container_id: containerFields.parent_container_id.optional(), notes: containerFields.notes.optional() }).strict(), async input => {
		await validateRefs(input)
		return bodyOf(await inventoryContainersCollectionRoute(collectionRequest(input)))
	})
	register("update_inventory_container", "Rename, move or annotate an inventory container. Moves that would create a cycle are rejected.", "inventory:write", z.object({ container_id: idSchema, changes: changes(containerFields) }).strict(), async ({ container_id, changes }) => {
		await validateRefs(changes)
		return bodyOf(await inventoryContainerDetailRoute(requestFor(container_id, "PATCH", changes)))
	})
	register("delete_inventory_container", "Delete an inventory container. Its items and child containers are kept and become unassigned or top-level.", "inventory:write", z.object({ container_id: idSchema }).strict(), async ({ container_id }) => bodyOf(await inventoryContainerDetailRoute(requestFor(container_id, "DELETE"))), false, true)
}
