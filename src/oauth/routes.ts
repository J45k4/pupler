import { createHash } from "node:crypto"
import type { BunRequest } from "bun"
import { z } from "zod"
import { db } from "../db"
import { HttpError } from "../api/core"
import { browserUser, expires, hash, oauthOrigin, readLimited, scopes, secret, sessionHash, transaction, trustedOrigin } from "./core"
import { consentPage } from "./pages"
import type { Prisma } from "../generated/prisma/client"

class OAuthError extends HttpError {
	constructor(readonly code: string, message: string, status = 400) { super(status, message) }
}

const reply = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } })
const redirect = (url: string) => new Response(null, { status: 303, headers: { Location: url, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } })
const rates = new Map<string, { count: number; until: number }>()
const rateLimit = (key: string, maximum: number) => {
	let rate = rates.get(key)
	if (!rate || rate.until < Date.now()) { rate = { count: 0, until: Date.now() + 60_000 }; rates.set(key, rate) }
	if (++rate.count > maximum) throw new OAuthError("temporarily_unavailable", "Too many requests. Try again shortly.", 429)
}
const form = async (req: Request) => {
	if (!req.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) throw new OAuthError("invalid_request", "Use application/x-www-form-urlencoded")
	const params = new URLSearchParams((await readLimited(req, 16_384)).toString())
	for (const key of new Set(params.keys())) if (key !== "scope" && params.getAll(key).length > 1) throw new OAuthError("invalid_request", "Duplicate parameter")
	return params
}
const validScope = (input: string) => {
	const requested = [...new Set(input.split(" ").filter(Boolean))]
	if (!requested.length || requested.some(scope => !Object.hasOwn(scopes, scope))) throw new OAuthError("invalid_scope", "Unsupported permissions")
	return requested.join(" ")
}
const callback = (authorization: { redirect_uri: string; state: string }, values: Record<string, string>, issuer: string) => {
	const url = new URL(authorization.redirect_uri)
	for (const [key, value] of Object.entries({ ...values, state: authorization.state, iss: issuer })) url.searchParams.set(key, value)
	return redirect(url.href)
}

const register = async (req: Request) => {
	if (req.method !== "POST") throw new HttpError(405, "Method not allowed")
	rateLimit("register", 20)
	const input = z.object({
		client_name: z.string().trim().min(1).max(100).default("MCP client"),
		redirect_uris: z.array(z.string().max(2048).url()).min(1).max(10),
		token_endpoint_auth_method: z.literal("none").default("none"),
		grant_types: z.array(z.enum(["authorization_code", "refresh_token"])).min(1).max(2).refine(values => values.includes("authorization_code")).default(["authorization_code", "refresh_token"]),
		response_types: z.array(z.literal("code")).length(1).default(["code"]),
	}).parse(JSON.parse((await readLimited(req, 16_384)).toString()))
	for (const uri of input.redirect_uris) {
		const url = new URL(uri)
		if (url.hash || url.username || url.password || (url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "[::1]", "localhost"].includes(url.hostname)))) throw new OAuthError("invalid_redirect_uri", "Use HTTPS or a loopback HTTP callback")
	}
	const client = await db.client.oAuthClient.create({ data: { id: secret(), name: input.client_name, redirect_uris: JSON.stringify(input.redirect_uris), created_at: new Date().toISOString() } })
	return reply({ ...input, client_id: client.id, client_id_issued_at: Math.floor(Date.now() / 1000) }, 201)
}

const authorize = async (req: Request) => {
	const origin = oauthOrigin(req)
	if (req.method === "POST") {
		trustedOrigin(req, true)
		const user = await browserUser(req)
		if (!user) throw new HttpError(401, "Sign in again")
		const params = await form(req)
		const pending = await db.client.oAuthAuthorization.findUnique({ where: { id: params.get("request") ?? "" } })
		if (!pending || pending.consumed || pending.code_hash || pending.expires_at <= new Date().toISOString() || pending.user_id !== user.id || pending.session_hash !== sessionHash(req) || pending.csrf_hash !== hash(params.get("csrf") ?? "")) throw new OAuthError("invalid_request", "This approval has expired. Start the connection again.")
		if (params.get("decision") === "deny") {
			await db.client.oAuthAuthorization.update({ where: { id: pending.id }, data: { consumed: true } })
			return callback(pending, { error: "access_denied" }, origin)
		}
		if (params.get("decision") !== "allow") throw new OAuthError("invalid_request", "Choose Allow or Cancel")
		const scope = validScope(params.getAll("scope").join(" "))
		if (scope.split(" ").some(value => !pending.scope.split(" ").includes(value))) throw new OAuthError("invalid_scope", "Permission was not requested")
		const code = secret()
		await transaction(async tx => {
			const grant = await tx.oAuthGrant.create({ data: { id: secret(), client_id: pending.client_id, user_id: user.id, scope, resource: pending.resource, created_at: new Date().toISOString() } })
			const changed = await tx.oAuthAuthorization.updateMany({ where: { id: pending.id, consumed: false, code_hash: null, csrf_hash: pending.csrf_hash }, data: { code_hash: hash(code), grant_id: grant.id, expires_at: expires(300), csrf_hash: null } })
			if (!changed.count) throw new OAuthError("invalid_request", "Approval was already used")
		})
		return callback(pending, { code }, origin)
	}
	if (req.method !== "GET") throw new HttpError(405, "Method not allowed")
	const params = new URL(req.url).searchParams
	let id = params.get("request")
	if (!id) {
		rateLimit("authorize", 100)
		for (const key of params.keys()) if (params.getAll(key).length !== 1) throw new OAuthError("invalid_request", "Duplicate parameter")
		const client = await db.client.oAuthClient.findUnique({ where: { id: params.get("client_id") ?? "" } })
		const uri = params.get("redirect_uri") ?? ""
		if (!client || !(JSON.parse(client.redirect_uris) as string[]).includes(uri)) throw new OAuthError("invalid_request", "Unknown client or callback URL")
		if (params.get("response_type") !== "code" || params.get("code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(params.get("code_challenge") ?? "")) throw new OAuthError("invalid_request", "Authorization code with PKCE S256 is required")
		if (params.get("resource") !== `${origin}/mcp`) throw new OAuthError("invalid_target", "Resource must be Pupler's MCP URL")
		if ((params.get("state")?.length ?? 0) > 2048) throw new OAuthError("invalid_request", "State is too long")
		await db.client.oAuthAuthorization.deleteMany({ where: { expires_at: { lt: new Date().toISOString() } } })
		const pending = await db.client.oAuthAuthorization.create({ data: { id: secret(), client_id: client.id, redirect_uri: uri, scope: validScope(params.get("scope") ?? Object.keys(scopes).join(" ")), resource: `${origin}/mcp`, state: params.get("state") ?? "", challenge: params.get("code_challenge")!, expires_at: expires(600) } })
		return redirect(`/oauth/authorize?request=${pending.id}`)
	}
	const pending = await db.client.oAuthAuthorization.findUnique({ where: { id } })
	if (!pending || pending.consumed || pending.code_hash || pending.expires_at <= new Date().toISOString()) throw new OAuthError("invalid_request", "This connection request has expired. Start again from your app.")
	const user = await browserUser(req)
	if (!user) return redirect(`/login?redirect=${encodeURIComponent(`/oauth/authorize?request=${id}`)}`)
	const client = await db.client.oAuthClient.findUniqueOrThrow({ where: { id: pending.client_id } })
	const csrf = secret()
	await db.client.oAuthAuthorization.update({ where: { id }, data: { user_id: user.id, session_hash: sessionHash(req), csrf_hash: hash(csrf) } })
	return consentPage({ id, csrf, name: client.name, user: user.name, redirect: pending.redirect_uri, scope: pending.scope })
}

const issueTokens = async (tx: Prisma.TransactionClient, grant: { id: string; scope: string }, refreshExpiry = expires(60 * 60 * 24 * 30)) => {
	const access = `pmcp_${secret()}`
	const refresh = `prfr_${secret()}`
	await tx.oAuthToken.createMany({ data: [
		{ hash: hash(access), grant_id: grant.id, kind: "access", expires_at: expires(900) },
		{ hash: hash(refresh), grant_id: grant.id, kind: "refresh", expires_at: refreshExpiry },
	] })
	return { access_token: access, token_type: "Bearer", expires_in: 900, refresh_token: refresh, scope: grant.scope }
}

const token = async (req: Request) => {
	if (req.method !== "POST") throw new HttpError(405, "Method not allowed")
	rateLimit("token", 300)
	const params = await form(req)
	const invalid = () => new OAuthError("invalid_grant", "Invalid, expired or already used credentials")
	if (params.get("grant_type") === "authorization_code") {
		const result = await transaction(async tx => {
			const code = await tx.oAuthAuthorization.findUnique({ where: { code_hash: hash(params.get("code") ?? "") } })
			const verifier = params.get("code_verifier") ?? ""
			if (!code || code.consumed || !code.grant_id || code.expires_at <= new Date().toISOString() || code.client_id !== params.get("client_id") || code.redirect_uri !== params.get("redirect_uri") || code.resource !== params.get("resource") || code.resource !== `${oauthOrigin(req)}/mcp` || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) || createHash("sha256").update(verifier).digest("base64url") !== code.challenge) throw invalid()
			const grant = await tx.oAuthGrant.findUnique({ where: { id: code.grant_id } })
			if (!grant || grant.revoked_at) throw invalid()
			const changed = await tx.oAuthAuthorization.updateMany({ where: { id: code.id, consumed: false }, data: { consumed: true } })
			if (!changed.count) throw invalid()
			return issueTokens(tx, grant)
		})
		return reply(result)
	}
	if (params.get("grant_type") === "refresh_token") {
		const result = await transaction(async tx => {
			const record = await tx.oAuthToken.findUnique({ where: { hash: hash(params.get("refresh_token") ?? "") }, include: { grant: true } })
			if (!record || record.kind !== "refresh" || record.grant.revoked_at || record.expires_at <= new Date().toISOString() || record.grant.client_id !== params.get("client_id") || record.grant.resource !== `${oauthOrigin(req)}/mcp` || (params.has("resource") && params.get("resource") !== record.grant.resource)) throw invalid()
			if (record.used_at) {
				await tx.oAuthGrant.update({ where: { id: record.grant_id }, data: { revoked_at: new Date().toISOString() } })
				return null
			}
			if (params.has("scope") && params.get("scope") !== record.grant.scope) throw new OAuthError("invalid_scope", "Reconnect to change permissions")
			const changed = await tx.oAuthToken.updateMany({ where: { hash: record.hash, used_at: null }, data: { used_at: new Date().toISOString() } })
			if (!changed.count) throw invalid()
			return issueTokens(tx, record.grant, record.expires_at)
		})
		if (!result) throw invalid()
		return reply(result)
	}
	throw new OAuthError("unsupported_grant_type", "Use authorization_code or refresh_token")
}

const revoke = async (req: Request) => {
	if (req.method !== "POST") throw new HttpError(405, "Method not allowed")
	const params = await form(req)
	const record = await db.client.oAuthToken.findUnique({ where: { hash: hash(params.get("token") ?? "") }, include: { grant: true } })
	if (record && params.get("client_id") === record.grant.client_id) await db.client.oAuthGrant.update({ where: { id: record.grant_id }, data: { revoked_at: new Date().toISOString() } })
	return reply({})
}

export const connectionsRoute = async (req: BunRequest<string>) => {
	const user = await browserUser(req)
	if (!user) throw new HttpError(401, "Sign in to manage connected apps")
	if (req.method === "GET" && !req.params?.id) return reply(await db.client.oAuthGrant.findMany({ where: { user_id: user.id, revoked_at: null }, select: { id: true, scope: true, created_at: true, last_used_at: true, client: { select: { name: true } } }, orderBy: { created_at: "desc" } }))
	if (req.method !== "DELETE" || !req.params?.id) throw new HttpError(405, "Method not allowed")
	const changed = await db.client.oAuthGrant.updateMany({ where: { id: req.params.id, user_id: user.id, revoked_at: null }, data: { revoked_at: new Date().toISOString() } })
	if (!changed.count) throw new HttpError(404, "Connection not found")
	return new Response(null, { status: 204 })
}

export const oauthRoute = async (req: Request) => {
	try {
		const origin = oauthOrigin(req)
		trustedOrigin(req)
		const path = new URL(req.url).pathname
		if (path.startsWith("/.well-known/")) {
			if (req.method !== "GET") throw new HttpError(405, "Method not allowed")
			if (path.includes("oauth-protected-resource")) return reply({ resource: `${origin}/mcp`, authorization_servers: [origin], scopes_supported: Object.keys(scopes) })
			return reply({ issuer: origin, authorization_endpoint: `${origin}/oauth/authorize`, token_endpoint: `${origin}/oauth/token`, registration_endpoint: `${origin}/oauth/register`, revocation_endpoint: `${origin}/oauth/revoke`, response_types_supported: ["code"], grant_types_supported: ["authorization_code", "refresh_token"], token_endpoint_auth_methods_supported: ["none"], revocation_endpoint_auth_methods_supported: ["none"], code_challenge_methods_supported: ["S256"], scopes_supported: Object.keys(scopes), authorization_response_iss_parameter_supported: true })
		}
		if (path === "/oauth/register") return await register(req)
		if (path === "/oauth/authorize") return await authorize(req)
		if (path === "/oauth/token") return await token(req)
		if (path === "/oauth/revoke") return await revoke(req)
		throw new HttpError(404, "Not found")
	} catch (error) {
		const status = error instanceof HttpError ? error.status : error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 500
		return reply({ error: error instanceof OAuthError ? error.code : status === 500 ? "server_error" : "invalid_request", error_description: status === 500 ? "Unable to complete OAuth request" : error instanceof z.ZodError ? "Invalid client metadata" : (error as Error).message }, status)
	}
}
