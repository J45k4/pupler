import type { BunRequest } from "bun"

import { db } from "../db"
import { TodoListRole } from "../todo-list-role"
import type { PrismaClient } from "../generated/prisma/client"
import { requireAuthenticatedUser } from "./auth"
import { assertKnownFields, empty, expectBoolean, expectInteger, expectString, HttpError, json, parseIdParam, readJsonObject, requireBodyField, utcNow, type Database, type JsonValue } from "./core"

const memberSelect = {
	user_id: true,
	role: true,
	created_at: true,
	user: { select: { id: true, name: true, username: true } },
} as const

const parseRole = (value: JsonValue, field: string) => {
	const role = expectInteger(value, field)
	if (role !== TodoListRole.Viewer && role !== TodoListRole.Editor) throw new HttpError(400, "Role must be 1 (viewer) or 2 (editor)")
	return role
}

export const requireTodoListMember = async (database: Database, userId: number, listId: number, write = false) => {
	const member = await database.client.todoListMember.findUnique({ where: { todo_list_id_user_id: { todo_list_id: listId, user_id: userId } } })
	if (!member) throw new HttpError(404, "Todo list not found")
	if (write && member.role !== TodoListRole.Editor) throw new HttpError(403, "Editor access required")
	return member
}

const listDetail = (id: number) => db.client.todoList.findUnique({ where: { id }, include: { members: { select: memberSelect, orderBy: { user_id: "asc" } } } })

export const todoListsCollectionRoute = async (req: Request) => {
	const user = await requireAuthenticatedUser(req)
	if (req.method === "GET") {
		const lists = await db.client.todoList.findMany({ where: { members: { some: { user_id: user.id } } }, orderBy: { id: "asc" }, include: { members: { where: { user_id: user.id }, select: { role: true, hidden: true } } } })
		return json(200, lists.map(({ members, ...list }) => ({ ...list, role: members[0]?.role ?? TodoListRole.Viewer, hidden: members[0]?.hidden ?? false })))
	}
	if (req.method === "POST") {
		const body = await readJsonObject(req)
		assertKnownFields(body, ["name"])
		const name = requireBodyField(body, "name", expectString).trim()
		if (!name) throw new HttpError(400, "List name is required")
		const now = utcNow()
		const list = await db.client.todoList.create({ data: { name, created_at: now, updated_at: now, members: { create: { user_id: user.id, role: TodoListRole.Editor, created_at: now } } } })
		return json(201, { ...list, role: TodoListRole.Editor, hidden: false })
	}
	throw new HttpError(405, "Method not allowed for this route")
}

export const todoListDetailRoute = async (req: BunRequest<string>) => {
	const user = await requireAuthenticatedUser(req)
	const id = parseIdParam(req.params.id ?? "")
	const member = req.method === "DELETE" ? null : await requireTodoListMember(db, user.id, id, req.method !== "GET" && req.method !== "PATCH")
	if (req.method === "GET") return json(200, { ...await listDetail(id), hidden: member!.hidden })
	if (req.method === "PATCH") {
		const body = await readJsonObject(req)
		assertKnownFields(body, ["name", "hidden"])
		if (Object.keys(body).length === 0) throw new HttpError(400, "Provide changes")
		const member = await requireTodoListMember(db, user.id, id, "name" in body)
		const name = "name" in body ? requireBodyField(body, "name", expectString).trim() : undefined
		const hidden = "hidden" in body ? requireBodyField(body, "hidden", expectBoolean) : undefined
		if (name !== undefined && !name) throw new HttpError(400, "List name is required")
		await (db.client as PrismaClient).$transaction(async (tx) => {
			if (name !== undefined) await tx.todoList.update({ where: { id }, data: { name, updated_at: utcNow() } })
			if (hidden !== undefined) await tx.todoListMember.update({ where: { todo_list_id_user_id: { todo_list_id: id, user_id: user.id } }, data: { hidden } })
		})
		return json(200, { ...await listDetail(id), hidden: hidden ?? member.hidden })
	}
	if (req.method === "DELETE") {
		await (db.client as PrismaClient).$transaction(async (tx) => {
			await requireTodoListMember({ ...db, client: tx }, user.id, id, true)
			await tx.todo.deleteMany({ where: { todo_list_id: id } })
			await tx.todoList.delete({ where: { id } })
		})
		return empty(204)
	}
	throw new HttpError(405, "Method not allowed for this route")
}

export const todoListMembersCollectionRoute = async (req: BunRequest<string>) => {
	const user = await requireAuthenticatedUser(req)
	const id = parseIdParam(req.params.id ?? "")
	await requireTodoListMember(db, user.id, id, true)
	if (req.method === "GET") {
		const users = await db.client.user.findMany({
			where: { username: { not: null }, todo_list_members: { none: { todo_list_id: id } } },
			select: { id: true, name: true, username: true },
			orderBy: [{ name: "asc" }, { id: "asc" }],
		})
		return json(200, { list_id: id, users })
	}
	if (req.method !== "POST") throw new HttpError(405, "Method not allowed for this route")
	const body = await readJsonObject(req)
	assertKnownFields(body, ["username", "role"])
	const username = requireBodyField(body, "username", expectString).trim()
	const role = requireBodyField(body, "role", parseRole)
	if (!username) throw new HttpError(400, "Username is required")
	const recipient = await db.client.user.findUnique({ where: { username }, select: { id: true } })
	if (!recipient) throw new HttpError(404, "User not found")
	const where = { todo_list_id_user_id: { todo_list_id: id, user_id: recipient.id } }
	if (await db.client.todoListMember.findUnique({ where })) throw new HttpError(409, "User already has access")
	await db.client.todoListMember.create({ data: { todo_list_id: id, user_id: recipient.id, role, created_at: utcNow() } })
	return json(201, await listDetail(id))
}

export const todoListMemberDetailRoute = async (req: BunRequest<string>) => {
	const user = await requireAuthenticatedUser(req)
	const id = parseIdParam(req.params.id ?? "")
	const memberUserId = parseIdParam(req.params.userId ?? "")
	await requireTodoListMember(db, user.id, id, true)
	const where = { todo_list_id_user_id: { todo_list_id: id, user_id: memberUserId } }
	if (!await db.client.todoListMember.findUnique({ where })) throw new HttpError(404, "Member not found")
	if (memberUserId === user.id) throw new HttpError(400, "You cannot change your own access")
	if (req.method === "PATCH") {
		const body = await readJsonObject(req)
		assertKnownFields(body, ["role"])
		const role = requireBodyField(body, "role", parseRole)
		await db.client.todoListMember.update({ where, data: { role } })
		return json(200, await listDetail(id))
	}
	if (req.method === "DELETE") {
		await db.client.todoListMember.delete({ where })
		return empty(204)
	}
	throw new HttpError(405, "Method not allowed for this route")
}
