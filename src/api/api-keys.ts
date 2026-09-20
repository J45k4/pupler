import type { BunRequest } from "bun"
import { createHash, randomBytes } from "node:crypto"
import { db } from "../db"
import { requireAuthenticatedUser } from "./auth"
import { assertKnownFields, empty, expectString, HttpError, json, parseIdParam, readJsonObject, requireBodyField, utcNow } from "./core"

const publicFields = { id: true, name: true, prefix: true, created_at: true, last_used_at: true } as const

const accountUser = async (req: Request) => {
	if (req.headers.has("authorization")) throw new HttpError(403, "Sign in with your password to manage API keys")
	return requireAuthenticatedUser(req)
}

export const apiKeysCollectionRoute = async (req: Request) => {
	const user = await accountUser(req)
	if (req.method === "GET") {
		return json(200, await db.client.userApiKey.findMany({ where: { user_id: user.id }, select: publicFields, orderBy: { id: "desc" } }))
	}
	if (req.method !== "POST") throw new HttpError(405, "Method not allowed for this route")
	const body = await readJsonObject(req)
	assertKnownFields(body, ["name"])
	const name = requireBodyField(body, "name", expectString).trim()
	if (!name || name.length > 100) throw new HttpError(400, "Name must be between 1 and 100 characters")
	const key = `pupler_${randomBytes(32).toString("base64url")}`
	const record = await db.client.userApiKey.create({
		data: { user_id: user.id, name, key_hash: createHash("sha256").update(key).digest("hex"), prefix: key.slice(0, 15), created_at: utcNow() },
		select: publicFields,
	})
	return new Response(JSON.stringify({ ...record, key }), { status: 201, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } })
}

export const apiKeyDetailRoute = async (req: BunRequest<string>) => {
	const user = await accountUser(req)
	if (req.method !== "DELETE") throw new HttpError(405, "Method not allowed for this route")
	const result = await db.client.userApiKey.deleteMany({ where: { id: parseIdParam(req.params.id ?? ""), user_id: user.id } })
	if (!result.count) throw new HttpError(404, "API key not found")
	return empty(204)
}
