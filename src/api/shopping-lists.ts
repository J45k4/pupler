import type { BunRequest } from "bun"

import { db } from "../db"
import type { PrismaClient } from "../generated/prisma/client"
import { requireAuthenticatedUser } from "./auth"
import { assertKnownFields, empty, expectString, HttpError, json, parseIdParam, readJsonObject, requireBodyField, utcNow, type Database } from "./core"

const memberSelect = {
	user_id: true,
	role: true,
	created_at: true,
	user: { select: { id: true, name: true, username: true } },
} as const

const parseRole = (value: string) => {
	if (value !== "viewer" && value !== "editor") throw new HttpError(400, "Role must be viewer or editor")
	return value
}

export const requireShoppingListMember = async (database: Database, userId: number, listId: number, write = false) => {
	const member = await database.client.shoppingListMember.findUnique({ where: { shopping_list_id_user_id: { shopping_list_id: listId, user_id: userId } } })
	if (!member) throw new HttpError(404, "Shopping list not found")
	if (write && member.role !== "editor") throw new HttpError(403, "Editor access required")
	return member
}

const listDetail = (id: number) => db.client.shoppingList.findUnique({ where: { id }, include: { members: { select: memberSelect, orderBy: { user_id: "asc" } } } })

export const shoppingListsCollectionRoute = async (req: Request) => {
	const user = await requireAuthenticatedUser(req)
	if (req.method === "GET") {
		const lists = await db.client.shoppingList.findMany({ where: { members: { some: { user_id: user.id } } }, orderBy: { id: "asc" }, include: { members: { where: { user_id: user.id }, select: { role: true } } } })
		return json(200, lists.map(({ members, ...list }) => ({ ...list, role: members[0]?.role ?? "viewer" })))
	}
	if (req.method === "POST") {
		const body = await readJsonObject(req)
		assertKnownFields(body, ["name"])
		const name = requireBodyField(body, "name", expectString).trim()
		if (!name) throw new HttpError(400, "List name is required")
		const now = utcNow()
		const list = await db.client.shoppingList.create({ data: { name, created_at: now, updated_at: now, members: { create: { user_id: user.id, role: "editor", created_at: now } } } })
		return json(201, { ...list, role: "editor" })
	}
	throw new HttpError(405, "Method not allowed for this route")
}

export const shoppingListDetailRoute = async (req: BunRequest<string>) => {
	const user = await requireAuthenticatedUser(req)
	const id = parseIdParam(req.params.id ?? "")
	if (req.method !== "DELETE") await requireShoppingListMember(db, user.id, id, req.method !== "GET")
	if (req.method === "GET") return json(200, await listDetail(id))
	if (req.method === "PATCH") {
		const body = await readJsonObject(req)
		assertKnownFields(body, ["name"])
		const name = requireBodyField(body, "name", expectString).trim()
		if (!name) throw new HttpError(400, "List name is required")
		await db.client.shoppingList.update({ where: { id }, data: { name, updated_at: utcNow() } })
		return json(200, await listDetail(id))
	}
	if (req.method === "DELETE") {
		await (db.client as PrismaClient).$transaction(async (tx) => {
			await requireShoppingListMember({ ...db, client: tx }, user.id, id, true)
			await tx.shoppingListItem.deleteMany({ where: { shopping_list_id: id } })
			await tx.shoppingList.delete({ where: { id } })
		})
		return empty(204)
	}
	throw new HttpError(405, "Method not allowed for this route")
}

export const shoppingListMembersCollectionRoute = async (req: BunRequest<string>) => {
	const user = await requireAuthenticatedUser(req)
	const id = parseIdParam(req.params.id ?? "")
	await requireShoppingListMember(db, user.id, id, true)
	if (req.method === "GET") {
		const users = await db.client.user.findMany({
			where: { username: { not: null }, shopping_list_members: { none: { shopping_list_id: id } } },
			select: { id: true, name: true, username: true },
			orderBy: [{ name: "asc" }, { id: "asc" }],
		})
		return json(200, { list_id: id, users })
	}
	if (req.method !== "POST") throw new HttpError(405, "Method not allowed for this route")
	const body = await readJsonObject(req)
	assertKnownFields(body, ["username", "role"])
	const username = requireBodyField(body, "username", expectString).trim()
	const role = parseRole(requireBodyField(body, "role", expectString))
	if (!username) throw new HttpError(400, "Username is required")
	const recipient = await db.client.user.findUnique({ where: { username }, select: { id: true } })
	if (!recipient) throw new HttpError(404, "User not found")
	const where = { shopping_list_id_user_id: { shopping_list_id: id, user_id: recipient.id } }
	if (await db.client.shoppingListMember.findUnique({ where })) throw new HttpError(409, "User already has access")
	await db.client.shoppingListMember.create({ data: { shopping_list_id: id, user_id: recipient.id, role, created_at: utcNow() } })
	return json(201, await listDetail(id))
}

export const shoppingListMemberDetailRoute = async (req: BunRequest<string>) => {
	const user = await requireAuthenticatedUser(req)
	const id = parseIdParam(req.params.id ?? "")
	const memberUserId = parseIdParam(req.params.userId ?? "")
	await requireShoppingListMember(db, user.id, id, true)
	const where = { shopping_list_id_user_id: { shopping_list_id: id, user_id: memberUserId } }
	if (!await db.client.shoppingListMember.findUnique({ where })) throw new HttpError(404, "Member not found")
	if (memberUserId === user.id) throw new HttpError(400, "You cannot change your own access")
	if (req.method === "PATCH") {
		const body = await readJsonObject(req)
		assertKnownFields(body, ["role"])
		const role = parseRole(requireBodyField(body, "role", expectString))
		await db.client.shoppingListMember.update({ where, data: { role } })
		return json(200, await listDetail(id))
	}
	if (req.method === "DELETE") {
		await db.client.shoppingListMember.delete({ where })
		return empty(204)
	}
	throw new HttpError(405, "Method not allowed for this route")
}
