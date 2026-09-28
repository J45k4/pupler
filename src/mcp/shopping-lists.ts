import { z } from "zod"
import { HttpError, utcNow } from "../api/core"
import { shoppingListItemDetailSelect, validateIngredientProductRefs } from "../api/reference-details"
import { requireShoppingListMember } from "../api/shopping-lists"
import { db } from "../db"
import { transaction, type McpIdentity, type Scope } from "../oauth/core"
import { idSchema } from "./receipts"

type Register = <S extends z.ZodType>(name: string, description: string, scope: Scope | null, schema: S, handler: (args: z.output<S>) => Promise<unknown>, image?: boolean, destructive?: boolean) => void
const page = { limit: z.number().int().min(1).max(100).default(30), before_id: idSchema.optional() }
const role = z.enum(["viewer", "editor"])
const itemFields = { name: z.string().trim().min(1).max(300), quantity: z.number().positive().max(1_000_000), unit: z.string().trim().min(1).max(100), done: z.boolean(), notes: z.string().max(2000).nullable(), ingredient_id: idSchema.nullable(), product_id: idSchema.nullable() }
const memberSelect = { user_id: true, role: true, created_at: true, user: { select: { id: true, name: true, username: true } } } as const

export const registerShoppingListTools = (register: Register, identity: McpIdentity) => {
	const userId = identity.user_id
	const requireList = (listId: number, write = false) => requireShoppingListMember(db, userId, listId, write)
	const listDetail = (listId: number) => db.client.shoppingList.findUnique({ where: { id: listId }, include: { members: { select: memberSelect, orderBy: { user_id: "asc" } } } })
	const itemDetail = (itemId: number) => db.client.shoppingListItem.findUnique({ where: { id: itemId }, select: shoppingListItemDetailSelect })
	const requireItem = async (itemId: number, write = false) => {
		const item = await db.client.shoppingListItem.findUnique({ where: { id: itemId } })
		if (!item) throw new HttpError(404, "Shopping list item not found")
		await requireList(item.shopping_list_id, write)
		return item
	}

	register("list_shopping_lists", "List the connected user's shopping lists, including their role in each list. Use next_before_id for the next page.", "shopping_lists:read", z.object(page).strict(), async input => {
		const rows = await db.client.shoppingList.findMany({ where: { members: { some: { user_id: userId } }, ...(input.before_id ? { id: { lt: input.before_id } } : {}) }, orderBy: { id: "desc" }, take: input.limit + 1, include: { members: { where: { user_id: userId }, select: { role: true } } } })
		return { shopping_lists: rows.slice(0, input.limit).map(({ members, ...list }) => ({ ...list, role: members[0]?.role })), next_before_id: rows.length > input.limit ? rows[input.limit - 1]!.id : null }
	})
	register("get_shopping_list", "Get one accessible shopping list and its members.", "shopping_lists:read", z.object({ list_id: idSchema }).strict(), async ({ list_id }) => {
		const member = await requireList(list_id)
		return { ...await listDetail(list_id), role: member.role }
	})
	register("list_shopping_list_items", "List items in an accessible shopping list. Active items are shown by default; use removed to include removed items.", "shopping_lists:read", z.object({ list_id: idSchema, ...page, removed: z.enum(["active", "removed", "all"]).default("active"), done: z.boolean().optional() }).strict(), async input => {
		await requireList(input.list_id)
		const rows = await db.client.shoppingListItem.findMany({ where: { shopping_list_id: input.list_id, ...(input.before_id ? { id: { lt: input.before_id } } : {}), ...(input.removed === "all" ? {} : { removed_at: input.removed === "active" ? null : { not: null } }), ...(input.done === undefined ? {} : { done: input.done }) }, orderBy: { id: "desc" }, take: input.limit + 1, select: shoppingListItemDetailSelect })
		return { items: rows.slice(0, input.limit), next_before_id: rows.length > input.limit ? rows[input.limit - 1]!.id : null }
	})
	register("get_shopping_list_item", "Get one item from an accessible shopping list.", "shopping_lists:read", z.object({ item_id: idSchema }).strict(), async ({ item_id }) => {
		await requireItem(item_id)
		return itemDetail(item_id)
	})
	register("create_shopping_list", "Create a shopping list with the connected user as an editor.", "shopping_lists:write", z.object({ name: z.string().trim().min(1).max(300) }).strict(), async ({ name }) => {
		const now = utcNow()
		const list = await db.client.shoppingList.create({ data: { name, created_at: now, updated_at: now, members: { create: { user_id: userId, role: "editor", created_at: now } } } })
		return { ...list, role: "editor" }
	})
	register("rename_shopping_list", "Rename a shopping list. Editor access is required.", "shopping_lists:write", z.object({ list_id: idSchema, name: z.string().trim().min(1).max(300) }).strict(), async ({ list_id, name }) => {
		await requireList(list_id, true)
		await db.client.shoppingList.update({ where: { id: list_id }, data: { name, updated_at: utcNow() } })
		return listDetail(list_id)
	})
	register("delete_shopping_list", "Permanently delete a shopping list and its items. Editor access is required.", "shopping_lists:write", z.object({ list_id: idSchema }).strict(), async ({ list_id }) => {
		await transaction(async tx => {
			await requireShoppingListMember({ ...db, client: tx }, userId, list_id, true)
			await tx.shoppingListItem.deleteMany({ where: { shopping_list_id: list_id } })
			await tx.shoppingList.delete({ where: { id: list_id } })
		})
		return { success: true }
	}, false, true)
	register("create_shopping_list_item", "Add an item to a shopping list. Editor access is required.", "shopping_lists:write", z.object({ list_id: idSchema, name: itemFields.name, quantity: itemFields.quantity.default(1), unit: itemFields.unit.default("pcs"), done: itemFields.done.default(false), notes: itemFields.notes.optional(), ingredient_id: itemFields.ingredient_id.optional(), product_id: itemFields.product_id.optional() }).strict(), async input => {
		await requireList(input.list_id, true)
		await validateIngredientProductRefs(db, input)
		const now = utcNow()
		const item = await db.client.shoppingListItem.create({ data: { shopping_list_id: input.list_id, name: input.name, quantity: input.quantity, unit: input.unit, done: input.done, notes: input.notes ?? null, ingredient_id: input.ingredient_id ?? null, product_id: input.product_id ?? null, created_at: now, updated_at: now } })
		return itemDetail(item.id)
	})
	register("update_shopping_list_item", "Edit an item, including its bought status. Marking it bought restores it if removed. Editor access is required.", "shopping_lists:write", z.object({ item_id: idSchema, changes: z.object(itemFields).partial().strict().refine(value => Object.keys(value).length > 0, "Provide changes") }).strict(), async ({ item_id, changes }) => {
		const existing = await requireItem(item_id, true)
		await validateIngredientProductRefs(db, { ingredient_id: changes.ingredient_id === undefined ? existing.ingredient_id : changes.ingredient_id, product_id: changes.product_id === undefined ? existing.product_id : changes.product_id })
		await db.client.shoppingListItem.update({ where: { id: item_id }, data: { ...changes, ...(changes.done === true ? { removed_at: null } : {}), updated_at: utcNow() } })
		return itemDetail(item_id)
	})
	register("remove_shopping_list_item", "Hide an item from the active list while keeping its history. Editor access is required.", "shopping_lists:write", z.object({ item_id: idSchema }).strict(), async ({ item_id }) => {
		const item = await requireItem(item_id, true)
		await db.client.shoppingListItem.update({ where: { id: item_id }, data: { removed_at: item.removed_at ?? utcNow(), done: false, updated_at: utcNow() } })
		return itemDetail(item_id)
	})
	register("restore_shopping_list_item", "Show a removed item in the active list again. Editor access is required.", "shopping_lists:write", z.object({ item_id: idSchema }).strict(), async ({ item_id }) => {
		await requireItem(item_id, true)
		await db.client.shoppingListItem.update({ where: { id: item_id }, data: { removed_at: null, updated_at: utcNow() } })
		return itemDetail(item_id)
	})
	register("list_shopping_list_members", "List people who can access a shopping list and their viewer or editor roles.", "shopping_lists:read", z.object({ list_id: idSchema }).strict(), async ({ list_id }) => {
		await requireList(list_id)
		return { members: (await listDetail(list_id))?.members ?? [] }
	})
	register("share_shopping_list", "Give an existing Pupler user viewer or editor access. Editor access is required.", "shopping_lists:write", z.object({ list_id: idSchema, username: z.string().trim().min(1).max(300), role }).strict(), async ({ list_id, username, role }) => {
		await requireList(list_id, true)
		const recipient = await db.client.user.findUnique({ where: { username }, select: { id: true } })
		if (!recipient) throw new HttpError(404, "User not found")
		const where = { shopping_list_id_user_id: { shopping_list_id: list_id, user_id: recipient.id } }
		if (await db.client.shoppingListMember.findUnique({ where })) throw new HttpError(409, "User already has access")
		await db.client.shoppingListMember.create({ data: { shopping_list_id: list_id, user_id: recipient.id, role, created_at: utcNow() } })
		return listDetail(list_id)
	})
	register("set_shopping_list_member_role", "Change another member's viewer or editor role. Editor access is required.", "shopping_lists:write", z.object({ list_id: idSchema, user_id: idSchema, role }).strict(), async ({ list_id, user_id, role }) => {
		await requireList(list_id, true)
		if (user_id === userId) throw new HttpError(400, "You cannot change your own access")
		const where = { shopping_list_id_user_id: { shopping_list_id: list_id, user_id } }
		if (!await db.client.shoppingListMember.findUnique({ where })) throw new HttpError(404, "Member not found")
		await db.client.shoppingListMember.update({ where, data: { role } })
		return listDetail(list_id)
	})
	register("remove_shopping_list_member", "Revoke another member's access. Editor access is required.", "shopping_lists:write", z.object({ list_id: idSchema, user_id: idSchema }).strict(), async ({ list_id, user_id }) => {
		await requireList(list_id, true)
		if (user_id === userId) throw new HttpError(400, "You cannot change your own access")
		const where = { shopping_list_id_user_id: { shopping_list_id: list_id, user_id } }
		if (!await db.client.shoppingListMember.findUnique({ where })) throw new HttpError(404, "Member not found")
		await db.client.shoppingListMember.delete({ where })
		return { success: true }
	}, false, true)
}
