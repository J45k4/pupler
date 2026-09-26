import { createHash, randomBytes } from "node:crypto"
import { resolvePublicOrigin } from "../config"
import { db } from "../db"
import { HttpError } from "../api/core"
import { resolveAuthenticatedUser } from "../api/auth"
import type { Prisma, PrismaClient } from "../generated/prisma/client"

export const scopes = {
	"receipts:read": "View receipts, their lines and images",
	"receipts:write": "Create, edit and delete receipts, lines and images",
	"products:read": "Search products and receipt groups",
	"products:write": "Create products for receipt lines",
} as const
export type Scope = keyof typeof scopes
export const secret = () => randomBytes(32).toString("base64url")
export const hash = (value: string) => createHash("sha256").update(value).digest("hex")
export const expires = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString()
export const transaction = <T>(action: (tx: Prisma.TransactionClient) => Promise<T>) => (db.client as PrismaClient).$transaction(action)

export const oauthOrigin = (req: Request) => {
	const configured = resolvePublicOrigin()
	const url = new URL(configured ?? req.url)
	const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
	if ((!configured && (!loopback || process.env.NODE_ENV === "production")) || (url.protocol !== "https:" && !loopback)) {
		throw new HttpError(503, "Set PUBLIC_ORIGIN to Pupler's HTTPS origin to enable MCP")
	}
	return url.origin
}

export const trustedOrigin = (req: Request, required = false) => {
	const origin = req.headers.get("origin")
	if ((required || origin !== null) && origin !== oauthOrigin(req)) throw new HttpError(403, "Cross-origin requests are not allowed")
	if (req.headers.get("sec-fetch-site") === "cross-site" && req.method !== "GET") throw new HttpError(403, "Cross-site requests are not allowed")
}

export const readLimited = async (req: Request, limit: number) => {
	if (Number(req.headers.get("content-length")) > limit) throw new HttpError(413, "Request is too large")
	const chunks: Uint8Array[] = []
	let size = 0
	const reader = req.body?.getReader()
	if (reader) {
		try {
			while (true) {
				const { done, value } = await reader.read()
				if (done) break
				size += value.length
				if (size > limit) {
					await reader.cancel()
					throw new HttpError(413, "Request is too large")
				}
				chunks.push(value)
			}
		} finally { reader.releaseLock() }
	}
	return Buffer.concat(chunks)
}

export const browserUser = async (req: Request) => {
	if (req.headers.has("authorization")) throw new HttpError(403, "Use your browser session to manage connected apps")
	return resolveAuthenticatedUser(req)
}

export const sessionHash = (req: Request) => hash(req.headers.get("cookie")?.match(/(?:^|;\s*)pupler_session=([^;]+)/)?.[1] ?? "")

export const authenticateMcp = async (req: Request) => {
	const value = req.headers.get("authorization")?.match(/^Bearer (pmcp_[A-Za-z0-9_-]{43})$/)?.[1]
	const record = value ? await db.client.oAuthToken.findUnique({ where: { hash: hash(value) }, include: { grant: { include: { client: { select: { name: true } }, user: { select: { id: true, name: true, username: true } } } } } }) : null
	if (!record || record.kind !== "access" || record.expires_at <= new Date().toISOString() || record.grant.revoked_at || record.grant.resource !== `${oauthOrigin(req)}/mcp`) throw new HttpError(401, "Sign in to Pupler to use MCP")
	await db.client.oAuthGrant.update({ where: { id: record.grant_id }, data: { last_used_at: new Date().toISOString() } })
	return record.grant
}

export type McpIdentity = Awaited<ReturnType<typeof authenticateMcp>>
export const requireScope = (identity: McpIdentity, scope: Scope) => {
	if (!identity.scope.split(" ").includes(scope)) throw new HttpError(403, `Missing permission: ${scope}. Reconnect with this permission enabled.`)
}

export const challenge = (req: Request) => Response.json({ error: "unauthorized" }, {
	status: 401,
	headers: { "Cache-Control": "no-store", "WWW-Authenticate": `Bearer resource_metadata="${oauthOrigin(req)}/.well-known/oauth-protected-resource/mcp", scope="${Object.keys(scopes).join(" ")}"` },
})
